import React, { useState } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { v4 as uuid } from 'uuid'

interface Transition {
    id: string
    name: string
    icon: string
    description: string
    duration: number // in milliseconds
    type: 'fade' | 'slide' | 'zoom' | 'wipe' | 'dissolve' | 'cut' | 'push' | 'iris' | 'clock' | 'spin' | 'flip' | 'blur'
}

const transitions: Transition[] = [
    {
        id: 'fade-in',
        name: 'Fade In',
        icon: '🌅',
        description: 'Gradually appears from black',
        duration: 1000,
        type: 'fade'
    },
    {
        id: 'fade-out',
        name: 'Fade Out',
        icon: '🌇',
        description: 'Gradually disappears to black',
        duration: 1000,
        type: 'fade'
    },
    {
        id: 'slide-left',
        name: 'Slide Left',
        icon: '⬅️',
        description: 'Slides in from the right',
        duration: 800,
        type: 'slide'
    },
    {
        id: 'slide-right',
        name: 'Slide Right',
        icon: '➡️',
        description: 'Slides in from the left',
        duration: 800,
        type: 'slide'
    },
    {
        id: 'zoom-in',
        name: 'Zoom In',
        icon: '🔍',
        description: 'Scales up from center',
        duration: 1200,
        type: 'zoom'
    },
    {
        id: 'zoom-out',
        name: 'Zoom Out',
        icon: '🔎',
        description: 'Scales down to center',
        duration: 1200,
        type: 'zoom'
    },
    {
        id: 'wipe-left',
        name: 'Wipe Left',
        icon: '◀️',
        description: 'Reveals from right to left',
        duration: 900,
        type: 'wipe'
    },
    {
        id: 'wipe-right',
        name: 'Wipe Right',
        icon: '▶️',
        description: 'Reveals from left to right',
        duration: 900,
        type: 'wipe'
    },
    {
        id: 'dissolve',
        name: 'Dissolve',
        icon: '✨',
        description: 'Smooth crossfade transition',
        duration: 1500,
        type: 'dissolve'
    },
    {
        id: 'iris',
        name: 'Iris',
        icon: '👁️',
        description: 'Circular reveal effect',
        duration: 1000,
        type: 'iris'
    },
    {
        id: 'flip',
        name: 'Flip',
        icon: '🔄',
        description: '3D flip transition',
        duration: 800,
        type: 'flip'
    },
    {
        id: 'blur',
        name: 'Blur',
        icon: '🌫️',
        description: 'Blurred crossfade',
        duration: 1200,
        type: 'blur'
    }
]

const AnimationsToolPanel = () => {
    const { executeCommand, tracks, clips } = useEditor()
    const [selectedTransition, setSelectedTransition] = useState<string | null>(null)

    const addTransitionToTrack = (transition: Transition) => {
        // Find the first video track or create one
        let targetTrack = tracks.find(track => track.type === 'video')
        
        if (!targetTrack) {
            // Create a new video track if none exists
            targetTrack = {
                id: uuid(),
                projectId: 'current-project', // This should come from context
                index: tracks.length,
                type: 'video',
                createdAt: new Date().toISOString(),
                name: 'Animation Track',
                isLocked: false,
                isMuted: false,
                isSolo: false,
                volume: 1,
                pan: 0,
            }
            
            executeCommand({
                type: 'ADD_TRACK',
                payload: { track: targetTrack }
            })
        }

        // Find the latest clip end time on this track, or start at 0
        const trackClips = clips.filter(clip => clip.trackId === targetTrack.id)
        const latestEndTime = trackClips.length > 0 
            ? Math.max(...trackClips.map(clip => clip.timelineEndMs))
            : 0

        // Create the transition clip
        const transitionClip = {
            id: uuid(),
            trackId: targetTrack.id,
            assetId: null, // Transitions don't use assets
            type: 'transition' as const,
            sourceStartMs: 0,
            sourceEndMs: transition.duration,
            timelineStartMs: latestEndTime,
            timelineEndMs: latestEndTime + transition.duration,
            assetDurationMs: transition.duration,
            volume: 1,
            speed: 1,
            properties: {
                name: transition.name,
                transitionType: transition.type,
                isLocked: false,
                isMuted: false,
                isSolo: false,
            },
            createdAt: new Date().toISOString(),
        }

        executeCommand({
            type: 'ADD_CLIP',
            payload: { clip: transitionClip }
        })

        // Visual feedback
        setSelectedTransition(transition.id)
        setTimeout(() => setSelectedTransition(null), 500)
    }

    return (
        <div className="flex flex-col w-full gap-4 p-4">
            <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold text-gray-800">Animations</h3>
                <p className="text-sm text-gray-600">Add smooth transitions and animations to your clips</p>
            </div>
            
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                    {transitions.map((transition) => (
                        <button
                            key={transition.id}
                            onClick={() => addTransitionToTrack(transition)}
                            className={`
                                relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 
                                transition-all duration-300 hover:scale-105 active:scale-95
                                ${selectedTransition === transition.id 
                                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                }
                                group cursor-pointer
                            `}
                        >
                            {/* Transition Icon */}
                            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                                {transition.icon}
                            </div>
                            
                            {/* Transition Name */}
                            <h4 className="text-sm font-medium text-gray-800 text-center">
                                {transition.name}
                            </h4>
                            
                            {/* Duration Badge */}
                            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {(transition.duration / 1000).toFixed(1)}s
                            </div>
                            
                            {/* Hover Description */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap z-10">
                                {transition.description}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                            
                            {/* Selection Indicator */}
                            {selectedTransition === transition.id && (
                                <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tips Section */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 Tips</h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                        <li>• Transitions are automatically added to your timeline</li>
                        <li>• Duration can be adjusted after adding</li>
                        <li>• Use fade transitions for smooth scene changes</li>
                        <li>• Slide and wipe work great for dynamic content</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default AnimationsToolPanel 