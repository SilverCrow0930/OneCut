import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react'

const HomeCTA = () => {
    const router = useRouter()
    const { user, signIn } = useAuth()

    const handleGetStarted = () => {
        if (user) {
            router.push('/creation')
        } else {
            signIn()
        }
    }

    const benefits = [
        "No credit card required",
        "Free for first 3 videos",
        "Cancel anytime",
        "24/7 support"
    ]

    return (
        <section className="py-20 bg-gradient-to-br from-blue-600 via-purple-600 to-emerald-600 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-2 mb-6">
                    <Sparkles className="w-4 h-4 text-white" />
                    <span className="text-sm font-medium text-white">Limited Time Offer</span>
                </div>

                {/* Main Headline */}
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                    Ready to transform your content creation?
                </h2>

                {/* Subtitle */}
                <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                    Join thousands of creators who are already saving 10+ hours every week with Lemona's AI-powered video editing.
                </p>

                {/* Benefits Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                    {benefits.map((benefit, index) => (
                        <div key={index} className="flex items-center gap-2 text-white/90">
                            <CheckCircle className="w-5 h-5 text-emerald-300 flex-shrink-0" />
                            <span className="text-sm font-medium">{benefit}</span>
                        </div>
                    ))}
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                    <button
                        onClick={handleGetStarted}
                        className="group bg-white hover:bg-gray-50 text-gray-900 font-bold text-lg px-8 py-4 rounded-xl transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                        {user ? 'Start Creating Now' : 'Get Started Free'}
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                    </button>
                    
                    <button 
                        onClick={() => {
                            const demosSection = document.getElementById('demos-section')
                            demosSection?.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className="bg-white/10 hover:bg-white/20 text-white font-semibold text-lg px-8 py-4 rounded-xl border-2 border-white/30 hover:border-white/50 transition-all duration-300 backdrop-blur-sm"
                    >
                        Watch Demo
                    </button>
                </div>

                {/* Trust Indicators */}
                <div className="flex items-center justify-center gap-8 text-white/70 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span>10,000+ happy creators</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span>4.9/5 rating</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span>100% secure</span>
                    </div>
                </div>

                {/* Urgency */}
                <div className="mt-8 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
                    <p className="text-white/90 text-sm">
                        🔥 <strong>Special Launch Offer:</strong> First 1,000 users get unlimited videos for 30 days free
                    </p>
                </div>
            </div>
        </section>
    )
}

export default HomeCTA 