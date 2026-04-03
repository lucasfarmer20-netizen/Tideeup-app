import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET(): Promise<NextResponse> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'plans@tideeup.com';
  const toEmail = process.env.DEBUG_EMAIL_TO ?? 'delivered@resend.dev';

  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not set' }, { status: 500 });
  }

  const resend = new Resend(resendKey);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: 'TideeUp debug test email',
    html: '<p>This is a debug test email from TideeUp. If you received this, Resend is working.</p>',
  });

  return NextResponse.json({
    config: {
      apiKeyPrefix: resendKey.slice(0, 8) + '…',
      from: fromEmail,
      to: toEmail,
    },
    resendData: data ?? null,
    resendError: error ?? null,
  });
}
