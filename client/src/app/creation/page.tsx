'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
import HomeNavbar from "@/components/home/HomeNavbar";

export default function CreatePage() {
    const searchParams = useSearchParams()
    const highlightProjectId = searchParams.get('highlight')
    const defaultTab = searchParams.get('tab') as 'all' | 'quickclips' || 'all'

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
                <ProjectsList 
                    defaultTab={defaultTab}
                    highlightProjectId={highlightProjectId || undefined}
                />
            </main>
        </div>
    )
}