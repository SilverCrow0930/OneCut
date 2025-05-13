"use client";

import Navbar from "@/components/layout/Navbar";
import BubbleEffect from "@/components/ui/backgrounds/BubbleEffect";
import HomeFirstSection from "@/components/home/HomeFirstSection";

export default function Home() {
  return (
    <div className="flex flex-col items-center w-screen h-screen bg-black/70">

      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full z-[-1]">
        <BubbleEffect />
      </div>

      <p className="opacity-0">
        AI-powered video editor for podcasters, educators, and content creators.<br />
        Lemona’s AI copilot cuts long recordings into short videos based on your needs.
      </p>

      {/* Main Content */}
      <div className="
        flex flex-col w-[70%] h-full py-8
      ">

        {/* Navbar */}
        <Navbar />

        <div className="
          flex flex-col w-full h-full
          overflow-y-scroll
        ">
          <HomeFirstSection />
        </div>

      </div>

    </div>
  );
}
