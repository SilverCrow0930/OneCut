import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Play, Sparkles, Zap, Clock } from 'lucide-react'
import UnifiedQuickClips from '@/components/shared/UnifiedQuickClips'

const HomeHeroSection = () => {
    const router = useRouter()
    const { user, signIn } = useAuth()

    const handleGetStarted = () => {
        if (user) {
            router.push('/creation')
        } else {
            signIn()
        }
    }

    const handleWatchDemo = () => {
        // Scroll to demos section
        const demosSection = document.getElementById('demos-section')
        demosSection?.scrollIntoView({ behavior: 'smooth' })
    }



    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 pt-24 pb-20">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-emerald-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Column - Content */}
                    <div className="text-center lg:text-left">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-200 rounded-full px-4 py-2 mb-6">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700">AI-Powered Video Creation</span>
                        </div>

                        {/* Main Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                            Transform 
                            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent"> Hours </span>
                            into 
                            <span className="bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent"> Highlights</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                            Turn your long-form content into engaging videos with AI. Perfect for podcasters, educators, and content creators who want to save time and reach more audiences.
                        </p>

                        {/* Key Benefits */}
                        <div className="flex flex-wrap justify-center lg:justify-start gap-6 mb-8">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-emerald-500" />
                                <span className="text-gray-700 font-medium">10x Faster Editing</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-500" />
                                <span className="text-gray-700 font-medium">Hours to Minutes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-500" />
                                <span className="text-gray-700 font-medium">AI-Powered</span>
                            </div>
                        </div>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <button
                                onClick={handleGetStarted}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                {user ? 'View All Projects' : 'Start Creating'}
                            </button>
                            <button
                                onClick={handleWatchDemo}
                                className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-lg px-8 py-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-300"
                            >
                                <Play className="w-5 h-5" />
                                Watch Demo
                            </button>
                        </div>

                        {/* Trust Indicators */}
                        <div className="mt-8 pt-8 border-t border-gray-200">
                            <p className="text-sm text-gray-500 mb-4">Trusted by content creators worldwide</p>
                            <div className="flex items-center justify-center lg:justify-start gap-8 opacity-60">
                                <div className="text-2xl font-bold text-gray-400">5K+</div>
                                <div className="text-sm text-gray-500">Creators</div>
                                <div className="text-2xl font-bold text-gray-400">10K+</div>
                                <div className="text-sm text-gray-500">Videos Created</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Upload Interface */}
                    <div className="relative">
                        <UnifiedQuickClips mode="hero" />
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HomeHeroSection 