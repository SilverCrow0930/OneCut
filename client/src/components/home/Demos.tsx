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
            'Easily upload up to 2 hours of raw video—Lemona handles the trimming, scrubbing, and preparation for editing.',
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

export default function Demos() {
    const [currentDemoIndex, setCurrentDemoIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.load()
            videoRef.current.play().catch(console.error)
        }
    }, [currentDemoIndex])

    const handleDemoClick = (index: number) => {
        setCurrentDemoIndex(index)
        setIsPlaying(true)
    }

    return (
        <div className="flex flex-col w-full gap-8 overflow-hidden">
            {/* Current Demo */}
            <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden">
                <video
                    ref={videoRef}
                    src={DEMOS[currentDemoIndex].video.url}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                    loop
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />

                {/* Text Overlay */}
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8">
                    <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                        {DEMOS[currentDemoIndex].title}
                    </h3>
                    <p className="text-sm md:text-base text-gray-300">
                        {DEMOS[currentDemoIndex].description}
                    </p>
                </div>
            </div>

            {/* Demo List */}
            <div className="flex flex-col gap-4">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                    <span className="text-lg font-medium">All Features</span>
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                    ) : (
                        <ChevronRight className="w-5 h-5" />
                    )}
                </button>

                {isExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {DEMOS.map((demo, index) => (
                            <button
                                key={index}
                                className={`
                                    flex flex-col gap-2 p-4 rounded-xl text-left
                                    transition-all duration-300
                                    ${
                                        currentDemoIndex === index
                                            ? 'bg-white/20'
                                            : 'bg-white/5 hover:bg-white/10'
                                    }
                                `}
                                onClick={() => handleDemoClick(index)}
                            >
                                <h4 className="text-white text-lg font-medium">
                                    {demo.title}
                                </h4>
                                <p className="text-gray-400 text-sm">
                                    {demo.description}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
