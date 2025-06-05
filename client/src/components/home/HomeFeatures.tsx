import React from 'react'
import { Brain, Scissors, Upload, Download, Palette, Users } from 'lucide-react'

const HomeFeatures = () => {
    const features = [
        {
            icon: Brain,
            title: "AI-Powered Analysis",
            description: "Our advanced AI understands your content to identify the most engaging moments automatically.",
            color: "from-blue-500 to-purple-500"
        },
        {
            icon: Scissors,
            title: "Smart Auto-Cut",
            description: "Transform hours of footage into perfectly edited highlights in minutes, not hours.",
            color: "from-emerald-500 to-blue-500"
        },
        {
            icon: Upload,
            title: "Easy Upload",
            description: "Drag and drop your videos. We support all major formats including MP4, MOV, and AVI.",
            color: "from-purple-500 to-pink-500"
        },
        {
            icon: Palette,
            title: "Professional Templates",
            description: "Choose from stunning templates designed for different content types and audiences.",
            color: "from-orange-500 to-red-500"
        },
        {
            icon: Users,
            title: "Multi-Format Export",
            description: "Export optimized versions for YouTube, TikTok, Instagram, and other platforms.",
            color: "from-teal-500 to-emerald-500"
        },
        {
            icon: Download,
            title: "High-Quality Output",
            description: "Get professional-grade videos with crisp quality and perfect compression.",
            color: "from-indigo-500 to-purple-500"
        }
    ]

    return (
        <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-200 rounded-full px-4 py-2 mb-6">
                        <span className="text-sm font-medium text-blue-700">Powerful Features</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                        Everything you need to create 
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> amazing videos</span>
                    </h2>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        Lemona combines cutting-edge AI with intuitive design to give you professional video editing capabilities without the complexity.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => {
                        const Icon = feature.icon
                        return (
                            <div
                                key={index}
                                className="group relative bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl transition-all duration-300 hover:scale-105"
                            >
                                {/* Icon */}
                                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} mb-6`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>

                                {/* Content */}
                                <h3 className="text-xl font-bold text-gray-900 mb-4">
                                    {feature.title}
                                </h3>
                                <p className="text-gray-600 leading-relaxed">
                                    {feature.description}
                                </p>

                                {/* Hover Gradient Border */}
                                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                            </div>
                        )
                    })}
                </div>

                {/* Bottom CTA */}
                <div className="text-center mt-16">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-3xl p-12">
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                            Ready to experience the future of video editing?
                        </h3>
                        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                            Join thousands of creators who are already saving hours every week with Lemona's AI-powered editing.
                        </p>
                        <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
                            Start Your Free Trial
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HomeFeatures 