'use client'

import Navbar from "@/components/layout/Navbar";
import BubbleEffect from "@/components/ui/backgrounds/BubbleEffect";
import ProjectsList from "@/components/create/ProjectsList";
import ProjectsHeader from "@/components/create/ProjectsHeader";

export default function CreatePage() {
    return (
        <div className="flex flex-col items-center w-screen h-screen bg-black/70">

            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-full z-[-1]">
                <BubbleEffect />
            </div>

            {/* Main Content */}
            <div className="
                flex flex-col w-[70%] h-full py-8 gap-12
            ">

                {/* Navbar */}
                <Navbar />

                {/* Projects Header */}
                <ProjectsHeader />

                {/* Projects */}
                <ProjectsList />

            </div>
        </div>
    )
}