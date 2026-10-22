import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of TideeUp.',
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" effectiveDate="October 22, 2026">
      <section>
        <h2>The service</h2>
        <p>
          TideeUp generates a personalized weekly household cleaning plan from the answers you
          give. The free tier lets you generate a plan without an account. TideeUp Pro is a paid
          subscription that adds rotation memory, household members and assignments, custom
          tasks, history, and a weekly email digest. By using TideeUp you agree to these terms.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You sign in with a one-time code sent to your email. You are responsible for keeping
          access to that email address secure and for activity under your account. You must be
          at least 18 to purchase a subscription.
        </p>
      </section>

      <section>
        <h2>Subscriptions and billing</h2>
        <ul>
          <li>TideeUp Pro is billed in advance, monthly or annually, through Stripe.</li>
          <li>Subscriptions renew automatically until you cancel.</li>
          <li>You can cancel at any time from the billing portal in Settings. Cancellation takes
            effect at the end of the current billing period; you keep Pro features until then.</li>
          <li>Except where required by law, payments are non-refundable. If something went
            wrong, email us and we will make it right.</li>
          <li>Prices may change; we will give account holders at least 30 days&rsquo; notice
            before a change affects a renewal.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>
          Don&rsquo;t misuse the service: no attempts to break, overload, or reverse-engineer
          it, no scraping, and no use that is unlawful or harms others. We may suspend or
          terminate accounts that violate these terms.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You own the information you enter (household details, member names, custom tasks).
          You grant us the license needed to store and process it to provide the service. The
          plans TideeUp generates for you are yours to use, print, and share.
        </p>
      </section>

      <section>
        <h2>Disclaimers</h2>
        <p>
          Plans are suggestions based on general household guidance and the answers you provide.
          They are not professional cleaning, safety, or health advice. Follow manufacturer
          instructions for your surfaces, appliances, and cleaning products. The service is
          provided &ldquo;as is&rdquo; without warranties of any kind.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, TideeUp&rsquo;s total liability for any claim
          arising from the service is limited to the amount you paid us in the 12 months before
          the claim. We are not liable for indirect, incidental, or consequential damages.
        </p>
      </section>

      <section>
        <h2>Termination</h2>
        <p>
          You can delete your account at any time from Settings. We may discontinue the service
          with reasonable notice; if we do, we will refund any prepaid portion of an annual
          subscription.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the State of Alaska, USA, without regard to
          conflict-of-law rules.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms. Material changes will be announced by updating the
          effective date above and emailing account holders. Continued use after a change
          means you accept the updated terms.
        </p>
      </section>
    </LegalShell>
  );
}
