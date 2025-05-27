import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

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
            url: '/assets/videos/demos/1.mov'
        },
    },
    {
        title: 'Generate Ideas & Write Scripts',
        description:
            'Get inspired with AI-powered video concepts and scripts tailored to your style, audience, and trending content.',
        video: {
            type: 'local',
            url: '/assets/videos/demos/2.mov'
        },
    },
    {
        title: 'Upload Long Footage',
        description:
            'Easily upload up to 2 hours of raw video—Lemona handles the trimming, scrubbing, and preparation for editing.',
        video: {
            type: 'local',
            url: '/assets/videos/demos/3.mov'
        },
    },
    {
        title: 'AI Video Analysis',
        description:
            "Lemona's multi-modal AI understands visuals, speech, and context to pinpoint the most compelling moments in your footage.",
        video: {
            type: 'local',
            url: '/assets/videos/demos/4.mov'
        },
    },
    {
        title: 'Auto-Cut into Engaging Shorts',
        description:
            'Lemona edits your footage into compelling short-form videos — saving you hours of manual editing.',
        video: {
            type: 'local',
            url: '/assets/videos/demos/5.mov'
        },
    },
]

const DURATION = 10000 // 10 seconds per demo for YouTube videos

const Demos = () => {
    const [selectedDemo, setSelectedDemo] = useState<number>(0)
    const [expandedDemos, setExpandedDemos] = useState<Set<number>>(new Set([0]))
    const [progress, setProgress] = useState<number>(0)
    const [videoDuration, setVideoDuration] = useState<number>(DURATION)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        // Expand only the selected demo
        setExpandedDemos(new Set([selectedDemo]))

        // Reset progress
        setProgress(0)

        // Set duration based on video type
        if (DEMOS[selectedDemo].video.type === 'local') {
            if (videoRef.current) {
                setVideoDuration(videoRef.current.duration * 1000) // Convert to milliseconds
            }
        } else {
            setVideoDuration(DURATION)
        }

        // Animate progress over duration
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

        return () => clearInterval(intervalRef.current!)
    }, [selectedDemo, videoDuration])

    const handleManualSelect = (index: number) => {
        if (index !== selectedDemo) {
            clearInterval(intervalRef.current!)
            setSelectedDemo(index)
        }
    }

    return (
        <div className="flex flex-col md:flex-row w-full h-fit gap-8 border-[0.5px] border-white/50 rounded-xl px-4 md:px-8 py-4 md:py-8 text-white">
            <div className="flex flex-col w-full md:w-80 gap-4 flex-none">
                <p className="text-xl md:text-2xl font-bold my-2 md:my-4">🎬 Demos</p>
                {
                    DEMOS.map((demo, index) => (
                        <div
                            key={index}
                            className={`
                                flex flex-col w-full md:w-80 gap-4 border-[0.5px] border-white/50 rounded-xl p-3 md:p-4 
                                cursor-pointer hover:bg-white/5 transition-colors 
                                ${selectedDemo === index ? 'border-blue-500 bg-white/10' : ''}`}
                            onClick={() => {
                                handleManualSelect(index)
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-base md:text-lg">
                                    {demo.title}
                                </p>
                                {
                                    expandedDemos.has(index) ? (
                                        <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                                    )
                                }
                            </div>
                            {
                                expandedDemos.has(index) && (
                                    <p className="text-xs md:text-sm text-gray-300 pl-4 leading-relaxed relative before:absolute before:left-0 before:top-0 before:content-['•'] before:text-gray-300">
                                        {demo.description}
                                    </p>
                                )
                            }
                            {selectedDemo === index && (
                                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="bg-orange-500 h-full transition-all duration-[100ms]"
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
                <div className="w-full h-[300px] md:h-full rounded-xl overflow-hidden">
                    {DEMOS[selectedDemo].video.type === 'youtube' ? (
                        <iframe
                            src={DEMOS[selectedDemo].video.url.replace('watch?v=', 'embed/')}
                            className="w-full h-full object-cover"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            key={selectedDemo}
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            src={DEMOS[selectedDemo].video.url}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            playsInline
                            key={selectedDemo}
                            onLoadedMetadata={(e) => {
                                const video = e.target as HTMLVideoElement
                                setVideoDuration(video.duration * 1000)
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

export default Demos
