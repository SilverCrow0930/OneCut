'use client'

import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
import QuickClipsStatus from "@/components/creation/QuickClipsStatus";
import HomeNavbar from "@/components/home/HomeNavbar";

export default function CreatePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* Navigation */}
            <HomeNavbar />

            {/* Main Content */}
            <main className="max-w-[85%] mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
                {/* Header Section - More prominent and spacious */}
                <div className="mb-16 text-center">
                    <ProjectsHeader />
                </div>

                {/* QuickClips Status Section */}
                <div className="mb-12">
                    <QuickClipsStatus />
                </div>

                {/* Projects Grid */}
                <ProjectsList />
            </main>
        </div>
    )
}