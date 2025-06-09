'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
import HomeNavbar from "@/components/home/HomeNavbar";

// Separate component for search params logic
function CreationPageContent() {
    const searchParams = useSearchParams()
    const highlightProjectId = searchParams.get('highlight')
    const defaultTab = searchParams.get('tab') as 'all' | 'quickclips' || 'all'

    return (
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
    )
}

// Fallback component for loading state
function CreationPageFallback() {
    return (
        <main className="max-w-[85%] mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
            <div className="mb-16 text-center">
                <ProjectsHeader />
            </div>
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-pulse text-gray-500">Loading projects...</div>
            </div>
        </main>
    )
}

export default function CreatePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* Navigation */}
            <HomeNavbar />

            {/* Main Content with Suspense boundary */}
            <Suspense fallback={<CreationPageFallback />}>
                <CreationPageContent />
            </Suspense>
        </div>
    )
}