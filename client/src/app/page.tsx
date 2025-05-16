"use client";

import { useState } from "react";
import BubbleEffect from "@/components/ui/backgrounds/BubbleEffect";
import HomeFirstSection from "@/components/home/HomeFirstSection";
import HomeNavbar from "@/components/home/HomeNavbar";
import ConfidentialityButton from "@/components/layout/ConfidentialityButton";

export default function Home() {
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  return (
    <div className="flex flex-col items-center w-screen h-screen bg-black">

      {/* Background */}
      {/* <div className="absolute top-0 left-0 w-full h-full opacity-30">
        <BubbleEffect />
      </div> */}

      <p className="absolute opacity-0">
        AI-powered video editor for podcasters, educators, and content creators.<br />
        Lemona's AI copilot cuts long recordings into short videos based on your needs.
      </p>

      <div className="absolute right-2 bottom-2">
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

        <div className="
          flex flex-col w-full
          overflow-y-auto
          min-h-screen
        ">
          <HomeFirstSection />
        </div>

      </div>

    </div>
  );
}
