'use client'

import BubbleEffect from "@/components/ui/backgrounds/BubbleEffect";
import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
import HomeNavbar from "@/components/home/HomeNavbar";

export default function CreatePage() {
    return (
        <div className="flex flex-col items-center w-screen h-screen bg-black/70">

            {/* Background */}
            <div className="absolute top-0 left-0 w-full h-full z-[-1]">
                <BubbleEffect />
            </div>

            {/* Main Content */}
            <div className="
                flex flex-col w-[75%] h-full py-8 gap-12
            ">

                {/* Navbar */}
                <HomeNavbar />

                <div
                    className="h-16"
                />

                {/* Projects Header */}
                <ProjectsHeader />

                {/* Projects */}
                <ProjectsList />

            </div>
        </div>
    )
}