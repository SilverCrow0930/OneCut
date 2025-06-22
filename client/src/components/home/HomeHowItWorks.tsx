import React from 'react'
import { Upload, Brain, Download, ArrowRight } from 'lucide-react'

const HomeHowItWorks = () => {
    const steps = [
        {
            step: "01",
            icon: Upload,
            title: "Upload Your Content",
            description: "Simply drag and drop your long-form video content. We support all major formats and handle files up to 2 hours long.",
            image: "/assets/illustrations/upload-step.svg" // You can replace with actual illustrations
        },
        {
            step: "02", 
            icon: Brain,
            title: "AI Analysis & Editing",
            description: "Our advanced AI analyzes your content, identifies key moments, and automatically creates engaging highlights tailored to your audience.",
            image: "/assets/illustrations/ai-step.svg"
        },
        {
            step: "03",
            icon: Download,
            title: "Export & Share",
            description: "Download your professionally edited videos in multiple formats, optimized for different platforms and ready to publish.",
            image: "/assets/illustrations/export-step.svg"
        }
    ]

    return (
        <section id="how-it-works" className="py-20 bg-transparent">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 mb-6 shadow-sm">
                        <span className="text-sm font-medium text-gray-700">How It Works</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                        From raw footage to 
                        <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent"> viral content </span>
                        in 3 simple steps
                    </h2>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        No complex editing skills required. Our AI does the heavy lifting while you focus on creating great content.
                    </p>
                </div>

                {/* Steps */}
                <div className="space-y-16">
                    {steps.map((stepData, index) => {
                        const Icon = stepData.icon
                        const isEven = index % 2 === 1

                        return (
                            <div key={index} className={`grid lg:grid-cols-2 gap-12 items-center ${isEven ? 'lg:grid-flow-col-dense' : ''}`}>
                                {/* Content */}
                                <div className={`${isEven ? 'lg:col-start-2' : ''}`}>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl text-white font-bold text-lg">
                                            {stepData.step}
                                        </div>
                                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl">
                                            <Icon className="w-6 h-6 text-blue-600" />
                                        </div>
                                    </div>
                                    
                                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                                        {stepData.title}
                                    </h3>
                                    <p className="text-lg text-gray-600 leading-relaxed mb-8">
                                        {stepData.description}
                                    </p>

                                    {/* Optional: Add specific benefits or features for each step */}
                                    <div className="space-y-3">
                                        {index === 0 && (
                                            <>
                                                <div className="flex items-center gap-3 text-gray-700">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                    <span>Support for MP4, MOV, AVI, and more</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-gray-700">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                    <span>Handle files up to 2 hours long</span>
                                                </div>
                                            </>
                                        )}
                                        {index === 1 && (
                                            <>
                                                <div className="flex items-center gap-3 text-gray-700">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                    <span>Advanced scene detection</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-gray-700">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                    <span>Smart highlight identification</span>
                                                </div>
                                            </>
                                        )}
                                        {index === 2 && (
                                            <>
                                                <div className="flex items-center gap-3 text-gray-700">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                    <span>Multiple resolution options</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-gray-700">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                                    <span>Platform-optimized formats</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Visual */}
                                <div className={`${isEven ? 'lg:col-start-1 lg:row-start-1' : ''}`}>
                                    <div className="relative bg-white rounded-3xl p-8 shadow-2xl">
                                        {/* Mock interface based on step */}
                                        {index === 0 && (
                                            <div className="aspect-square bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl flex items-center justify-center">
                                                <div className="text-center">
                                                    <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                                                    <div className="text-gray-400 text-sm">Drag video here</div>
                                                    <div className="mt-4 space-y-2">
                                                        <div className="h-2 bg-blue-200 rounded-full w-32 mx-auto"></div>
                                                        <div className="h-2 bg-blue-200 rounded-full w-24 mx-auto"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {index === 1 && (
                                            <div className="aspect-square bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl flex items-center justify-center">
                                                <div className="text-center">
                                                    <Brain className="w-16 h-16 text-emerald-600 mx-auto mb-4 animate-pulse" />
                                                    <div className="text-gray-600 text-sm mb-4">AI Processing...</div>
                                                    <div className="space-y-2">
                                                        <div className="h-2 bg-emerald-300 rounded-full w-40 mx-auto"></div>
                                                        <div className="h-2 bg-emerald-200 rounded-full w-32 mx-auto"></div>
                                                        <div className="h-2 bg-emerald-200 rounded-full w-36 mx-auto"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {index === 2 && (
                                            <div className="aspect-square bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl flex items-center justify-center">
                                                <div className="text-center">
                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                        <div className="aspect-video bg-purple-200 rounded-lg"></div>
                                                        <div className="aspect-video bg-purple-200 rounded-lg"></div>
                                                        <div className="aspect-video bg-purple-200 rounded-lg"></div>
                                                        <div className="aspect-video bg-purple-200 rounded-lg"></div>
                                                    </div>
                                                    <Download className="w-8 h-8 text-purple-600 mx-auto" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Floating arrow for non-last steps */}
                                        {index < steps.length - 1 && (
                                            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 lg:hidden">
                                                <ArrowRight className="w-8 h-8 text-gray-300 rotate-90" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Bottom CTA */}
                <div className="text-center mt-20">
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                        Ready to streamline your video creation process?
                    </h3>
                    <p className="text-lg text-gray-600 mb-8">
                        See how easy it is to turn your content into engaging videos.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl">
                            Try It Free
                        </button>
                        <button className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-lg px-8 py-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-300">
                            Watch Tutorial
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HomeHowItWorks 