'use client';

import Script from 'next/script';

export default function StripeScript() {
  return (
    <Script
      src="https://js.stripe.com/v3/?"
      strategy="beforeInteractive"
      onError={(e) => {
        console.error('Error loading Stripe script:', e);
      }}
    />
  );
} 