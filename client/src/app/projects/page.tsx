'use client'

import { Suspense, useEffect, useState } from "react";
import ProjectsList from "@/components/creation/ProjectsList";
import ProjectsHeader from "@/components/creation/ProjectsHeader";
import HomeNavbar from "@/components/home/HomeNavbar";
import { useAuth } from "@/contexts/AuthContext";
import FreeCreditsAnimation from "@/components/ui/FreeCreditsAnimation";

export default function CreatePage() {
    const { profile } = useAuth();
    const [showCreditsAnimation, setShowCreditsAnimation] = useState(false);
    
    // Check if this user should see the free credits animation
    useEffect(() => {
        if (profile) {
            // Check if we've already shown the animation to this user
            const animationShown = localStorage.getItem(`credits_animation_shown_${profile.id}`);
            
            if (!animationShown) {
                // Check if the user was created recently (within the last 5 minutes)
                const createdAt = new Date(profile.created_at).getTime();
                const now = Date.now();
                const isNewUser = (now - createdAt) < 5 * 60 * 1000; // 5 minutes
                
                if (isNewUser) {
                    console.log('New user detected on projects page. Showing free credits animation.');
                    setShowCreditsAnimation(true);
                    
                    // Mark that we've shown the animation
                    localStorage.setItem(`credits_animation_shown_${profile.id}`, 'true');
                }
            }
        }
    }, [profile]);
    
    const handleCloseAnimation = () => {
        setShowCreditsAnimation(false);
    };

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
            
            {/* Free Credits Animation */}
            {showCreditsAnimation && (
                <FreeCreditsAnimation 
                    onClose={handleCloseAnimation}
                    autoClose={true}
                    autoCloseTime={15000}
                />
            )}
        </div>
    )
}