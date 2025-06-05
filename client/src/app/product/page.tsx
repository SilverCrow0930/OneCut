"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProductPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page and scroll to how-it-works section
    router.replace('/#how-it-works');
    
    // Small delay to ensure page loads before scrolling
    setTimeout(() => {
      const howItWorksSection = document.getElementById('how-it-works');
      if (howItWorksSection) {
        howItWorksSection.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  }, [router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to product information...</p>
      </div>
    </div>
  );
} 