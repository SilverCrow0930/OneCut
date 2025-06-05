import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const HomeFirstSection = () => {
    const router = useRouter()
    const { user, signIn } = useAuth()

    const handleJoinBeta = () => {
        if (user) {
            router.push('/creation')
        } else {
            signIn()
        }
    }

    const scrollToAutocut = () => {
        const autocutSection = document.getElementById('autocut-section')
        if (autocutSection) {
            autocutSection.scrollIntoView({ behavior: 'smooth' })
        }
    }

    return (
        <div className="
            flex flex-col w-full min-h-screen items-center justify-center
            py-20 px-4
        ">
            <div className="max-w-4xl w-full text-center">

                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <img
                        src="/assets/main/lemona-icon.png"
                        alt="Lemona Logo"
                        className="w-20 h-20 md:w-24 md:h-24"
                    />
                </div>

                {/* Main Headline */}
                <h1 className="
                    text-4xl sm:text-5xl md:text-6xl lg:text-7xl 
                    font-bold text-white mb-6
                    leading-tight
                ">
                    The First AI Content Creator
                </h1>

                {/* Subheadline */}
                <p className="
                    text-xl sm:text-2xl md:text-3xl 
                    text-gray-300 mb-12
                    leading-relaxed max-w-3xl mx-auto
                ">
                    The AI video co-pilot that takes you from nothing<br />
                    to viral-ready content.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                    <button 
                        onClick={scrollToAutocut}
                        className="
                            bg-gradient-to-r from-blue-600 to-purple-600 
                            hover:from-blue-700 hover:to-purple-700
                            text-white font-semibold text-lg
                            px-8 py-4 rounded-xl 
                            transition-all duration-300 shadow-lg hover:shadow-xl 
                            active:transform active:scale-95
                            min-w-[200px]
                        "
                    >
                        Upload & Transform
                    </button>
                    
                    <button 
                        onClick={handleJoinBeta}
                        className="
                            border-2 border-gray-600 hover:border-gray-500
                            text-gray-300 hover:text-white font-semibold text-lg
                            px-8 py-4 rounded-xl 
                            transition-all duration-300 hover:shadow-md
                            active:transform active:scale-95
                            min-w-[200px] hover:bg-gray-900
                        "
                    >
                        {user ? 'Start the Journey' : 'Sign In to Start'}
                    </button>
                </div>

                {/* Value Props */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                    <div className="text-center">
                        <div className="w-12 h-12 bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">AI-Powered</h3>
                        <p className="text-gray-400">Smart algorithms analyze your content and create engaging highlights automatically</p>
                    </div>
                    
                    <div className="text-center">
                        <div className="w-12 h-12 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Long-Form Focus</h3>
                        <p className="text-gray-400">Transform hours of content into polished 10-20 minute highlights</p>
                    </div>
                    
                    <div className="text-center">
                        <div className="w-12 h-12 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Full Control</h3>
                        <p className="text-gray-400">Complete video editor with AI assistance for perfect results</p>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default HomeFirstSection