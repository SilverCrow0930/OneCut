'use client'

import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
import HomeNavbar from "@/components/home/HomeNavbar";

export default function CreatePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* Navigation */}
            <HomeNavbar />

            {/* Main Content */}
            <main className="max-w-[95%] mx-auto px-2 sm:px-4 lg:px-6 pt-24 pb-12">
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