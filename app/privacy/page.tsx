import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How TideeUp collects, uses, and protects your information.',
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" effectiveDate="October 22, 2026">
      <section>
        <h2>Who we are</h2>
        <p>
          TideeUp (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a household planning service operated
          from Soldotna, Alaska, USA. This policy explains what information we collect when you
          use tideeup.com and the TideeUp app, why we collect it, and the choices you have.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Quiz answers.</strong> Home size, home type, flooring, pets, household size,
            and time preference. We use these to generate your cleaning plan. You can complete
            the quiz without creating an account.
          </li>
          <li>
            <strong>Email address.</strong> If you choose to save your plan or sign in, we store
            your email. Sign-in is by one-time code; we never store a password.
          </li>
          <li>
            <strong>Account data (paid plans).</strong> Household member names you enter, custom
            tasks, task assignments, no-go days, completion history, and streaks.
          </li>
          <li>
            <strong>Billing data.</strong> Payments are processed by Stripe. We store a Stripe
            customer ID, subscription ID, and subscription status. We never see or store your
            full card number.
          </li>
          <li>
            <strong>Technical data.</strong> Standard server logs (IP address, browser type,
            pages requested) and a small number of strictly necessary cookies used to keep you
            signed in and to connect an anonymous plan to your account.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To generate and deliver your weekly plan.</li>
          <li>To send transactional email: sign-in codes, plan links, and, for paid
            subscribers, the weekly Sunday digest and a short onboarding series.</li>
          <li>To process payments and manage your subscription.</li>
          <li>To keep the service secure, debug problems, and understand aggregate usage.</li>
        </ul>
        <p>
          We do not sell your personal information, and we do not use it for third-party
          advertising.
        </p>
      </section>

      <section>
        <h2>Who we share it with</h2>
        <p>
          We use a small number of service providers who process data on our behalf and are
          contractually limited to that purpose:
        </p>
        <ul>
          <li><strong>Supabase</strong> &mdash; database and authentication hosting.</li>
          <li><strong>Stripe</strong> &mdash; payment processing and subscription billing.</li>
          <li><strong>Resend</strong> &mdash; transactional email delivery.</li>
          <li><strong>Vercel</strong> &mdash; application hosting.</li>
        </ul>
        <p>
          We may also disclose information if required by law or to protect the rights,
          property, or safety of TideeUp, our users, or others.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Anonymous plans that are never claimed are retained so the link keeps working, and
          may be purged periodically. Account data is kept while your account exists. When you
          delete your account from the Settings page, we cancel any active subscription and
          delete your account data; Stripe retains billing records as required for tax and
          accounting purposes.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>You can use the free plan without an account.</li>
          <li>You can delete your account at any time from Settings.</li>
          <li>You can manage or cancel a subscription at any time from the billing portal
            in Settings.</li>
          <li>You can email us to request a copy of your data or ask that it be deleted.</li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          TideeUp is intended for adults managing a household. We do not knowingly collect
          personal information from children under 13.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If we make material changes to this policy we will update the effective date above
          and, for account holders, notify you by email.
        </p>
      </section>
    </LegalShell>
  );
}
