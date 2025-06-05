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

const DURATION = 10000 // 10 seconds per demo for YouTube videos

const Demos = () => {
    const [selectedDemo, setSelectedDemo] = useState<number>(0)
    const [expandedDemos, setExpandedDemos] = useState<Set<number>>(new Set([0]))
    const [progress, setProgress] = useState<number>(0)
    const [videoDuration, setVideoDuration] = useState<number>(DURATION)
    const [videoLoading, setVideoLoading] = useState<boolean>(true)
    const [videoError, setVideoError] = useState<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        // Expand only the selected demo
        setExpandedDemos(new Set([selectedDemo]))

        // Reset progress and loading states
        setProgress(0)
        setVideoLoading(true)
        setVideoError(null)

        // Set duration based on video type
        if (DEMOS[selectedDemo].video.type === 'local') {
            if (videoRef.current) {
                setVideoDuration(videoRef.current.duration * 1000) // Convert to milliseconds
            }
        } else {
            setVideoDuration(DURATION)
        }

        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }

        // Start progress animation after a short delay to allow video to load
        const startProgress = () => {
            const step = 100
            let elapsed = 0
            intervalRef.current = setInterval(() => {
                elapsed += step
                setProgress((elapsed / videoDuration) * 100)
                if (elapsed >= videoDuration) {
                    clearInterval(intervalRef.current!)
                    setSelectedDemo((prev) => (prev + 1) % DEMOS.length)
                }
            }, step)
        }

        // Start progress after a short delay
        setTimeout(startProgress, 1000)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [selectedDemo, videoDuration])

    const handleManualSelect = (index: number) => {
        if (index !== selectedDemo) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
            setSelectedDemo(index)
        }
    }

    const handleVideoLoad = () => {
        setVideoLoading(false)
        setVideoError(null)
        console.log('Video loaded successfully')
    }

    const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        setVideoLoading(false)
        setVideoError('Failed to load video')
        console.error('Video loading error:', e)
    }

    const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const video = e.target as HTMLVideoElement
        if (video.duration) {
            setVideoDuration(video.duration * 1000)
        }
        setVideoLoading(false)
    }

    return (
        <div className="flex flex-col md:flex-row w-full h-fit gap-8 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl px-4 md:px-8 py-4 md:py-8 shadow-lg">
            <div className="flex flex-col w-full md:w-80 gap-4 flex-none">
                <p className="text-xl md:text-2xl font-bold my-2 md:my-4 text-white">🎬 Demos</p>
                {
                    DEMOS.map((demo, index) => (
                        <div
                            key={index}
                            className={`
                                flex flex-col w-full md:w-80 gap-4 border rounded-xl p-3 md:p-4 
                                cursor-pointer transition-colors
                                ${selectedDemo === index ? 
                                    'border-blue-500 bg-blue-900/20 shadow-md' : 
                                    'border-gray-700 hover:bg-gray-800/50 bg-gray-800/30'
                                }`}
                            onClick={() => {
                                handleManualSelect(index)
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-base md:text-lg text-white font-medium">
                                    {demo.title}
                                </p>
                                {
                                    expandedDemos.has(index) ? (
                                        <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                                    )
                                }
                            </div>
                            {
                                expandedDemos.has(index) && (
                                    <p className="text-xs md:text-sm text-gray-300 pl-4 leading-relaxed relative before:absolute before:left-0 before:top-0 before:content-['•'] before:text-blue-400">
                                        {demo.description}
                                    </p>
                                )
                            }
                            {selectedDemo === index && (
                                <div className="w-full bg-gray-700 h-1 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-[100ms]"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    ))
                }
            </div>
            <div className="flex flex-col flex-grow h-full">
                <p className="h-10 md:h-20"></p>
                <div className="w-full h-[300px] md:h-full rounded-xl overflow-hidden shadow-lg border border-gray-700 bg-gray-800 relative">
                    {/* Loading State */}
                    {videoLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <div className="flex flex-col items-center gap-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                                <p className="text-gray-300 text-sm">Loading video...</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {videoError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                            <div className="flex flex-col items-center gap-3 text-center">
                                <AlertCircle className="w-12 h-12 text-gray-500" />
                                <div>
                                    <p className="text-gray-300 font-medium">Demo video unavailable</p>
                                    <p className="text-gray-400 text-sm mt-1">Video content coming soon</p>
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

                    {/* Fallback placeholder when no video is loading */}
                    {!videoLoading && !videoError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900" style={{ display: 'none' }}>
                            <div className="flex flex-col items-center gap-3">
                                <Play className="w-16 h-16 text-blue-400" />
                                <p className="text-gray-300 font-medium">Demo Video</p>
                                <p className="text-gray-400 text-sm">{DEMOS[selectedDemo].title}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Demos
