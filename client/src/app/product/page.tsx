"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProductPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page
    router.replace("/#how-it-works");
    
    // Small delay to ensure the page has loaded before scrolling
    setTimeout(() => {
      const howItWorksSection = document.getElementById("how-it-works");
      if (howItWorksSection) {
        howItWorksSection.scrollIntoView({ 
          behavior: "smooth",
          block: "start"
        });
      }
    }, 100);
  }, [router]);

  // Show a loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading product information...</p>
      </div>
    </div>
  );
} 