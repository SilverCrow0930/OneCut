'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/config';

export default function StripeScript() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      console.error('Error loading Stripe script:', error);
    }
  }, [error]);

  // Only render the script if we have a publishable key
  if (!STRIPE_PUBLISHABLE_KEY) {
    return null;
  }

  return (
    <Script
      src="https://js.stripe.com/v3/basil/"
      strategy="beforeInteractive"
      onError={(e) => setError(e)}
    />
  );
} 