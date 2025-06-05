"use client";

import { useState } from "react";
import HomeFirstSection from "@/components/home/HomeFirstSection";
import AutocutSection from "@/components/home/AutocutSection";
import HomeNavbar from "@/components/home/HomeNavbar";
import ConfidentialityButton from "@/components/layout/ConfidentialityButton";
import Demos from "@/components/home/Demos";

export default function Home() {
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  return (
    <div className="relative flex flex-col items-center w-full h-full bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-x-hidden">

      {/* Background */}
      {/* <div className="absolute top-0 left-0 w-full h-full opacity-30">
        <BubbleEffect />
      </div> */}

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
          flex flex-col w-full px-2 sm:px-4
          md:w-[95%] lg:w-[90%] xl:w-[85%]
        "
        style={{
          zIndex: 10
        }}
      >

        {/* Navbar */}
        <HomeNavbar />

        <div className="
          flex flex-col w-full min-h-screen
          overflow-y-auto overflow-x-hidden
        ">
          <HomeFirstSection />
          
          {/* New Autocut Section */}
          <AutocutSection />
        </div>

        <Demos />

        <div className="h-40" />

      </div>

    </div>
  );
}
