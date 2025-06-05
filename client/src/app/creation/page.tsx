'use client'

import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
import HomeNavbar from "@/components/home/HomeNavbar";

export default function CreatePage() {
    return (
        <div className="min-h-screen bg-black">
            {/* Navigation */}
            <HomeNavbar />

            {/* Main Content */}
            <main className="w-full px-4 sm:px-6 lg:px-8 pt-24 pb-12">
                {/* Header Section */}
                <div className="mb-8">
                    <ProjectsHeader />
                </div>

                {/* Projects Grid */}
                <ProjectsList />
            </main>
        </div>
    )
}