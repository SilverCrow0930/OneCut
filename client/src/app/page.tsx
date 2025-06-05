"use client";

import { useState } from "react";
import HomeFirstSection from "@/components/home/HomeFirstSection";
import AutocutSection from "@/components/home/AutocutSection";
import HomeNavbar from "@/components/home/HomeNavbar";
import ConfidentialityButton from "@/components/layout/ConfidentialityButton";

export default function Home() {
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  return (
    <div className="relative flex flex-col items-center w-full h-full bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-x-hidden">

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

      {/* Main Content */}
      <div
        className="
          flex flex-col w-full px-4
          md:w-[90%] lg:w-[80%] xl:w-[70%]
        "
        style={{
          zIndex: 10
        }}
      >

        {/* Navbar */}
        <HomeNavbar />

        {/* Hero Section */}
        <HomeFirstSection />
        
        {/* Autocut Section */}
        <AutocutSection />

        {/* Bottom Spacing */}
        <div className="h-20" />

      </div>

    </div>
  );
}
