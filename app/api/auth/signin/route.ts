import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server.js';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

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

  const { email } = parsed.data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

  try {
    const supabase = createAdminClient();

    // Generate OTP — creates the auth user if it doesn't exist yet
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (linkError || !linkData) {
      console.error('[auth/signin] generateLink error:', linkError?.message);
      return NextResponse.json(
        { message: 'Failed to generate sign-in code. Please try again.' },
        { status: 500 },
      );
    }

    const otpCode = linkData.properties.email_otp;
    const verifyUrl = `${appUrl}/auth/verify?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otpCode)}&next=${encodeURIComponent('/dashboard')}`;

    // Send sign-in email
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'plans@tideeup.com';

      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Your TideeUp sign-in code',
        html: buildSignInHtml({ otpCode, verifyUrl }),
      });

      if (emailError) {
        console.error('[auth/signin] Resend error:', JSON.stringify(emailError));
        return NextResponse.json(
          { message: 'Failed to send sign-in email. Please try again.' },
          { status: 500 },
        );
      }
    } else {
      console.warn('[auth/signin] RESEND_API_KEY not set — skipping email');
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('[auth/signin] error:', err);
    return NextResponse.json(
      { message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}

function buildSignInHtml({
  otpCode,
  verifyUrl,
}: {
  otpCode: string;
  verifyUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 16px; color: #1e293b;">
  <h1 style="color: #0D9488; font-size: 24px; margin-bottom: 8px;">Sign in to TideeUp</h1>
  <p style="color: #64748b; margin-bottom: 24px;">
    Use the code below to sign in. The code is valid for 24 hours.
  </p>

  <!-- OTP code -->
  <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
    <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">Your sign-in code</p>
    <p style="font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #0D9488; margin: 0; font-family: monospace;">
      ${otpCode}
    </p>
  </div>

  <!-- Table-based button -->
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
