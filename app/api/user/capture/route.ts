import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server.js';
import type { CaptureUserResponse } from '@/types/api';

// ─── Input schema ─────────────────────────────────────────────────────────────

const schema = z.object({
  email: z.string().email('Invalid email address'),
  planId: z.string().min(1),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const { email, planId } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

  // Verify the caller actually generated this plan (cookie set by /api/plan/generate)
  const cookieStore = await cookies();
  const pendingPlanId = cookieStore.get('pending_plan_id')?.value;
  if (!pendingPlanId || pendingPlanId !== planId) {
    return NextResponse.json(
      { message: 'Plan does not match your session. Please regenerate your plan.' },
      { status: 403 },
    );
  }

  try {
    const supabase = createAdminClient();

    // 1. Check whether this email already exists — determines the entire branch below.
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const alreadyExisted = !!existingUser;

    if (alreadyExisted) {
      // ── Returning user ────────────────────────────────────────────────────────
      // Do not create a duplicate account or claim the plan here.
      // The plan is already stored with a pending_plan_id cookie (set by the
      // generate API); the auth callback will claim it once they sign in.

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: `${appUrl}/auth/callback?next=/dashboard` },
      });

      if (linkError || !linkData) {
        console.error('[capture] generateLink error (returning):', linkError?.message);
        throw new Error(linkError?.message ?? 'Failed to generate sign-in link');
      }

      const otpCode = linkData.properties.email_otp;
      const verifyUrl = `${appUrl}/auth/verify?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otpCode)}&next=${encodeURIComponent('/dashboard')}`;

      try {
        await sendSignInEmail({ email, otpCode, verifyUrl, appUrl });
      } catch (emailErr) {
        console.error('[capture] sign-in email failed:', emailErr);
        // Non-fatal
      }

      const response: CaptureUserResponse = {
        userId: existingUser.id,
        alreadyExisted: true,
        isReturningUser: true,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // ── New user ───────────────────────────────────────────────────────────────

    // 2. Generate auth link (creates auth.users entry, returns OTP code).
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/plan/${planId}`,
      },
    });

    if (linkError || !linkData) {
      console.error('[capture] generateLink error:', linkError?.message);
      throw new Error(linkError?.message ?? 'Failed to generate auth link');
    }

    const otpCode = linkData.properties.email_otp;

    // 3. Create the public.users row.
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({ email })
      .select('id')
      .single();

    if (insertError || !newUser) {
      throw new Error(insertError?.message ?? 'Failed to create user');
    }

    const userId = newUser.id;

    // 4. Associate plan with user and mark as claimed.
    await supabase
      .from('plans')
      .update({ user_id: userId, is_claimed: true })
      .eq('id', planId)
      .is('user_id', null);

    // 5. Upsert household config so the Sunday cron can find it.
    const { data: planRow } = await supabase
      .from('plans')
      .select('home_size, household_count, pets, kids, time_preference')
      .eq('id', planId)
      .single();

    if (planRow) {
      await supabase.from('households').upsert(
        {
          user_id: userId,
          home_size: planRow.home_size,
          household_count: planRow.household_count,
          pets: planRow.pets,
          kids: planRow.kids,
          time_preference: planRow.time_preference,
        },
        { onConflict: 'user_id' },
      );
    }

    // 6. Send welcome email with OTP and plan link.
    try {
      await sendWelcomeEmail({ email, planId, userId, otpCode, appUrl });
    } catch (emailErr) {
      console.error('[capture] welcome email failed:', emailErr);
      // Non-fatal — user can still access their plan via the URL
    }

    const response: CaptureUserResponse = { userId, alreadyExisted: false, isReturningUser: false };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[capture] error:', err);
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function sendSignInEmail({
  email,
  otpCode,
  verifyUrl,
  appUrl: _appUrl,
}: {
  email: string;
  otpCode: string;
  verifyUrl: string;
  appUrl: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'plans@tideeup.com';

  if (!resendKey) {
    console.warn('[capture] RESEND_API_KEY not set — skipping sign-in email');
    return;
  }

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Your TideeUp sign-in code',
    html: buildSignInHtml({ otpCode, verifyUrl }),
  });

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }
}

function buildSignInHtml({ otpCode, verifyUrl }: { otpCode: string; verifyUrl: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px; color: #1e293b;">
  <h1 style="color: #0D9488; font-size: 24px; margin-bottom: 8px;">Welcome back to TideeUp</h1>
  <p style="color: #64748b; margin-bottom: 24px;">
    Use the code below to sign in. Your new plan will be waiting on your dashboard.
  </p>

  <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
    <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">Your sign-in code</p>
    <p style="font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #0D9488; margin: 0; font-family: monospace;">
      ${otpCode}
    </p>
  </div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
    <tr>
      <td style="border-radius: 8px; background: #0D9488;">
        <a href="${verifyUrl}"
           target="_blank"
           style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; font-family: system-ui, sans-serif; border-radius: 8px; mso-padding-alt: 0;">
          <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
          Sign in to TideeUp &rarr;
          <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
        </a>
      </td>
    </tr>
  </table>

  <p style="color: #94a3b8; font-size: 12px; margin: 0 0 4px;">Button not showing? Copy and paste this link:</p>
  <p style="font-size: 12px; margin: 0 0 24px; word-break: break-all;">
    <a href="${verifyUrl}" style="color: #0D9488;">${verifyUrl}</a>
  </p>

  <p style="color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    If you didn't request this, you can safely ignore this email.
  </p>
</body>
</html>
  `.trim();
}

async function sendWelcomeEmail({
  email,
  planId,
  userId,
  otpCode,
  appUrl,
}: {
  email: string;
  planId: string;
  userId: string;
  otpCode: string;
  appUrl: string;
}): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'plans@tideeup.com';

  if (!resendKey) {
    console.warn('[capture] RESEND_API_KEY not set — skipping email');
    return;
  }

  const resend = new Resend(resendKey);
  const planUrl = `${appUrl}/plan/${planId}`;
  const verifyUrl = `${appUrl}/auth/verify?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otpCode)}&next=${encodeURIComponent(`/plan/${planId}`)}`;

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Your TideeUp plan is ready 🏠',
    html: buildWelcomeHtml({ otpCode, verifyUrl, planUrl }),
  });

  if (error) {
    console.error('[capture] Resend error:', JSON.stringify(error, null, 2));
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  console.log('[capture] email sent, id:', data?.id);

  // Record the email event (non-fatal)
  try {
    const supabase = createAdminClient();
    await supabase.from('email_events').insert({
      user_id: userId,
      event_type: 'sent',
      payload: { type: 'welcome', plan_id: planId },
    });
    await supabase.from('users').update({ email_status: 'sent' }).eq('id', userId);
  } catch (err) {
    console.warn('[capture] failed to record email event:', err);
  }
}

function buildWelcomeHtml({
  otpCode,
  verifyUrl,
  planUrl,
}: {
  otpCode: string;
  verifyUrl: string;
  planUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px; color: #1e293b;">
  <h1 style="color: #0D9488; font-size: 24px; margin-bottom: 8px;">Your cleaning plan is ready 🏠</h1>
  <p style="color: #64748b; margin-bottom: 24px;">
    Use the code below to sign in and save your plan. The code is valid for 24 hours.
  </p>

  <!-- OTP code -->
  <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
    <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">Your sign-in code</p>
    <p style="font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #0D9488; margin: 0; font-family: monospace;">
      ${otpCode}
    </p>
  </div>

  <!-- Table-based button: renders reliably in Gmail, Outlook, and all major clients -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
    <tr>
      <td style="border-radius: 8px; background: #0D9488;">
        <a href="${verifyUrl}"
           target="_blank"
           style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; font-family: system-ui, sans-serif; border-radius: 8px; mso-padding-alt: 0;">
          <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
          Enter code &amp; view my plan &rarr;
          <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
        </a>
      </td>
    </tr>
  </table>

  <p style="color: #94a3b8; font-size: 12px; margin: 0 0 4px;">Button not showing? Copy and paste this link into your browser:</p>
  <p style="font-size: 12px; margin: 0 0 24px; word-break: break-all;">
    <a href="${verifyUrl}" style="color: #0D9488;">${verifyUrl}</a>
  </p>

  <p style="color: #94a3b8; font-size: 13px; margin-top: 8px;">
    Or <a href="${planUrl}" style="color: #0D9488;">view your plan directly</a> without signing in.
  </p>

  <p style="color: #94a3b8; font-size: 13px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    You're receiving this because you used TideeUp to generate a cleaning plan.<br>
    <a href="${planUrl}" style="color: #0D9488;">Unsubscribe</a>
  </p>
</body>
</html>
  `.trim();
}
