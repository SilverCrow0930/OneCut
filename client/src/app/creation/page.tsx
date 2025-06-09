'use client'

import { Suspense } from "react";
import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
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

                {/* Projects Grid */}
                <Suspense fallback={
                    <div className="flex items-center justify-center py-12">
                        <div className="flex items-center space-x-3 text-gray-600">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span>Loading projects...</span>
                        </div>
                    </div>
                }>
                    <ProjectsList />
                </Suspense>
            </main>
        </div>
    )
}