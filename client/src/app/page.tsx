"use client";

import { useState } from "react";
import HomeHeroSection from "@/components/home/HomeHeroSection";
import HomeSocialProof from "@/components/home/HomeSocialProof";
import HomeHowItWorks from "@/components/home/HomeHowItWorks";
import HomeNavbar from "@/components/home/HomeNavbar";
import ConfidentialityButton from "@/components/layout/ConfidentialityButton";
import Demos from "@/components/home/Demos";
import HomeCTA from "@/components/home/HomeCTA";

export default function Home() {
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  return (
    <div className="relative flex flex-col items-center w-full min-h-screen bg-white overflow-x-hidden">

      {/* SEO Content */}
      <p className="absolute opacity-0">
        AI-powered video editor for podcasters, educators, and content creators.<br />
        Lemona's AI copilot cuts long recordings into short videos based on your needs.
      </p>

      <div className="fixed right-2 bottom-2 z-50">
        <ConfidentialityButton
          showHelpModal={showHelpModal}
          setShowHelpModal={setShowHelpModal}
        />
      </div>

      {/* Navigation */}
      <HomeNavbar />

      {/* Main Content */}
      <main className="w-full">
        {/* Hero Section */}
        <HomeHeroSection />

        {/* Demos */}
        <Demos />

        {/* How It Works */}
        <HomeHowItWorks />

        {/* Social Proof */}
        <HomeSocialProof />

        {/* Final CTA */}
        <HomeCTA />
      </main>

    </div>
  );
}
