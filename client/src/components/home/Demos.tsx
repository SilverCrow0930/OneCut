import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Play, AlertCircle } from 'lucide-react'

interface Demo {
    title: string
    description: string
    video: {
        type: 'youtube' | 'local'
        url: string
    }
}

const DEMOS: Demo[] = [
    {
        title: "Discover What's Trending",
        description:
            'Stay ahead of the curve by identifying trending topics, formats, and hooks that resonate with your audience.',
        video: {
            type: 'local',
            url: '/assets/videos/demos/1.MOV'
        },
    },
    {
        title: 'Generate Ideas & Write Scripts',
        description:
            'Get inspired with AI-powered video concepts and scripts tailored to your style, audience, and trending content.',
        video: {
            type: 'local',
            url: '/assets/videos/demos/2.MOV'
        },
    },
    {
        title: 'Upload Long Footage',
        description:
            'Easily upload up to 1 hour of raw video—Lemona handles the trimming, scrubbing, and preparation for editing.',
        video: {
            type: 'local',
            url: '/assets/videos/demos/3.MOV'
        },
    },
    {
        title: 'AI Video Analysis',
        description:
            "Lemona's multi-modal AI understands visuals, speech, and context to pinpoint the most compelling moments in your footage.",
        video: {
            type: 'local',
            url: '/assets/videos/demos/4.MOV'
        },
    },
    {
        title: 'Auto-Cut into Engaging Shorts',
        description:
            'Lemona edits your footage into compelling short-form videos — saving you hours of manual editing.',
        video: {
            type: 'local',
            url: '/assets/videos/demos/5.MOV'
        },
    },
]

const Demos = () => {
    const [selectedDemo, setSelectedDemo] = useState<number>(0)
    const [expandedDemos, setExpandedDemos] = useState<Set<number>>(new Set([0]))
    const [videoLoading, setVideoLoading] = useState<boolean>(true)
    const [videoError, setVideoError] = useState<string | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        // Expand only the selected demo
        setExpandedDemos(new Set([selectedDemo]))

        // Reset loading states when demo changes
        setVideoLoading(true)
        setVideoError(null)
    }, [selectedDemo])

    const handleManualSelect = (index: number) => {
        if (index !== selectedDemo) {
            setSelectedDemo(index)
        }
    }

    const handleVideoLoad = () => {
        setVideoLoading(false)
        setVideoError(null)
    }

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        setVideoLoading(false)
        setVideoError('Failed to load video')
        console.error('Video loading error:', e)
    }

    const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        setVideoLoading(false)
    }

    return (
        <section id="demos-section" className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row w-full h-fit gap-8 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 md:px-8 py-4 md:py-8 shadow-lg">
                    <div className="flex flex-col w-full md:w-80 gap-4 flex-none">
                        <p className="text-xl md:text-2xl font-bold my-2 md:my-4 text-gray-900">🎬 Demos</p>
                        {
                            DEMOS.map((demo, index) => (
                                <div
                                    key={index}
                                    className={`
                                        flex flex-col w-full md:w-80 gap-4 border border-gray-200 rounded-xl p-3 md:p-4 
                                        cursor-pointer hover:bg-gray-50 transition-colors bg-white
                                        ${selectedDemo === index ? 'border-blue-500 bg-blue-50 shadow-md' : ''}`}
                                    onClick={() => {
                                        handleManualSelect(index)
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-base md:text-lg text-gray-900 font-medium">
                                            {demo.title}
                                        </p>
                                        {
                                            expandedDemos.has(index) ? (
                                                <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                                            )
                                        }
                                    </div>
                                    {
                                        expandedDemos.has(index) && (
                                            <p className="text-xs md:text-sm text-gray-600 pl-4 leading-relaxed relative before:absolute before:left-0 before:top-0 before:content-['•'] before:text-blue-500">
                                                {demo.description}
                                            </p>
                                        )
                                    }
                                </div>
                            ))
                        }
                    </div>
                    <div className="flex flex-col flex-grow h-full">
                        <p className="h-10 md:h-20"></p>
                        <div className="w-full h-[300px] md:h-full rounded-xl overflow-hidden shadow-lg border border-gray-200 bg-gray-100 relative">
                            {/* Loading State */}
                            {videoLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                        <p className="text-gray-600 text-sm">Loading video...</p>
                                    </div>
                                </div>
                            )}

                            {/* Error State */}
                            {videoError && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                    <div className="flex flex-col items-center gap-3 text-center">
                                        <AlertCircle className="w-12 h-12 text-gray-400" />
                                        <div>
                                            <p className="text-gray-600 font-medium">Demo video unavailable</p>
                                            <p className="text-gray-500 text-sm mt-1">Video content coming soon</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Video Content */}
                            {DEMOS[selectedDemo].video.type === 'youtube' ? (
                                <iframe
                                    src={DEMOS[selectedDemo].video.url.replace('watch?v=', 'embed/')}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    key={selectedDemo}
                                    onLoad={handleVideoLoad}
                                    style={{ display: videoLoading ? 'none' : 'block' }}
                                />
                            ) : (
                                <video
                                    ref={videoRef}
                                    src={DEMOS[selectedDemo].video.url}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                    muted
                                    playsInline
                                    loop
                                    key={selectedDemo}
                                    onLoadedMetadata={handleVideoLoadedMetadata}
                                    onLoadedData={handleVideoLoad}
                                    onError={handleVideoError}
                                    onCanPlay={handleVideoLoad}
                                    style={{ display: videoLoading || videoError ? 'none' : 'block' }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Demos
