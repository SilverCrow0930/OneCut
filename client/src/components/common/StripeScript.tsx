'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function StripeScript() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      console.error('Error loading Stripe script:', error);
    }
  }, [error]);

  return (
    <Script
      src="https://js.stripe.com/v3/?"
      strategy="beforeInteractive"
      onError={(e) => setError(e)}
    />
  );
} 