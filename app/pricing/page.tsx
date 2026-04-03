import { Suspense } from 'react';
import { PricingClient } from './PricingClient';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  return (
    <Suspense>
      <PricingClient />
    </Suspense>
  );
}
