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
    position: 'in' | 'out' | 'between' // New: specify where transition can be applied
}

const transitions: Transition[] = [
    // Fade In/Out transitions
    {
        id: 'fade-in',
        name: 'Fade In',
        icon: '🌅',
        description: 'Gradually appears from black',
        duration: 1000,
        type: 'fade',
        position: 'in'
    },
    {
        id: 'fade-out',
        name: 'Fade Out',
        icon: '🌇',
        description: 'Gradually disappears to black',
        duration: 1000,
        type: 'fade',
        position: 'out'
    },
    // Between clips transitions
    {
        id: 'crossfade',
        name: 'Crossfade',
        icon: '✨',
        description: 'Smooth crossfade between clips',
        duration: 1000,
        type: 'dissolve',
        position: 'between'
    },
    {
        id: 'fade-black',
        name: 'Fade to Black',
        icon: '🌑',
        description: 'Fade out to black, then fade in',
        duration: 1500,
        type: 'fade',
        position: 'between'
    },
    // Slide transitions (work for all positions)
    {
        id: 'slide-left-in',
        name: 'Slide In Left',
        icon: '⬅️',
        description: 'Slides in from the right',
        duration: 800,
        type: 'slide',
        position: 'in'
    },
    {
        id: 'slide-right-out',
        name: 'Slide Out Right',
        icon: '➡️',
        description: 'Slides out to the right',
        duration: 800,
        type: 'slide',
        position: 'out'
    },
    {
        id: 'slide-between',
        name: 'Slide',
        icon: '↔️',
        description: 'Slide transition between clips',
        duration: 800,
        type: 'slide',
        position: 'between'
    },
    // Zoom transitions
    {
        id: 'zoom-in',
        name: 'Zoom In',
        icon: '🔍',
        description: 'Scales up from center',
        duration: 1200,
        type: 'zoom',
        position: 'in'
    },
    {
        id: 'zoom-out',
        name: 'Zoom Out',
        icon: '🔎',
        description: 'Scales down to center',
        duration: 1200,
        type: 'zoom',
        position: 'out'
    },
    // Other effects
    {
        id: 'wipe-in',
        name: 'Wipe In',
        icon: '▶️',
        description: 'Reveals from left to right',
        duration: 1000,
        type: 'wipe',
        position: 'in'
    },
    {
        id: 'iris-in',
        name: 'Iris In',
        icon: '👁️',
        description: 'Circular reveal effect',
        duration: 1500,
        type: 'iris',
        position: 'in'
    }
]

const TransitionsToolPanel = () => {
    const { executeCommand, tracks, clips, selectedClipId } = useEditor()
    const [selectedTransition, setSelectedTransition] = useState<string | null>(null)
    const [showInstructions, setShowInstructions] = useState(true)
    const [activeTab, setActiveTab] = useState<'individual' | 'between'>('individual')

    // Get all video clips that can have transitions
    const getVideoClips = () => {
        return clips
            .filter(clip => clip.type === 'video' && clip.assetId)
            .sort((a, b) => a.timelineStartMs - b.timelineStartMs)
    }

    // Find adjacent clips that can have transitions applied
    const getAdjacentClipPairs = () => {
        const pairs: Array<{
            clip1: any
            clip2: any
            track: any
            gap: number
        }> = []

        tracks.forEach(track => {
            const trackClips = clips
                .filter(clip => clip.trackId === track.id && clip.type === 'video')
                .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

            for (let i = 0; i < trackClips.length - 1; i++) {
                const clip1 = trackClips[i]
                const clip2 = trackClips[i + 1]
                const gap = clip2.timelineStartMs - clip1.timelineEndMs

                // Only show pairs that are adjacent or have small gaps (< 2 seconds)
                if (gap <= 2000) {
                    pairs.push({ clip1, clip2, track, gap })
                }
            }
        })

        return pairs
    }

    const videoClips = getVideoClips()
    const adjacentPairs = getAdjacentClipPairs()

    const applyTransitionToClip = (transition: Transition, clip: any, position: 'in' | 'out') => {
        const transitionDuration = Math.min(
            transition.duration,
            (clip.timelineEndMs - clip.timelineStartMs) / 3 // Max 1/3 of clip duration
        )

        let modifiedClip
        if (position === 'in') {
            modifiedClip = {
                ...clip,
                properties: {
                    ...clip.properties,
                    transitionIn: {
                        type: transition.type,
                        duration: transitionDuration,
                        endMs: clip.timelineStartMs + transitionDuration
                    }
                }
            }
        } else {
            modifiedClip = {
                ...clip,
                properties: {
                    ...clip.properties,
                    transitionOut: {
                        type: transition.type,
                        duration: transitionDuration,
                        startMs: clip.timelineEndMs - transitionDuration
                    }
                }
            }
        }

        executeCommand({
            type: 'UPDATE_CLIP',
            payload: { before: clip, after: modifiedClip }
        })

        // Visual feedback
        setSelectedTransition(transition.id)
        setTimeout(() => setSelectedTransition(null), 1000)
    }

    const applyTransitionBetweenClips = (transition: Transition, clip1: any, clip2: any) => {
        const transitionDuration = Math.min(
            transition.duration,
            (clip1.timelineEndMs - clip1.timelineStartMs) / 3, // Max 1/3 of first clip
            (clip2.timelineEndMs - clip2.timelineStartMs) / 3  // Max 1/3 of second clip
        )

        // Calculate overlap positions
        const overlapStart = clip1.timelineEndMs - transitionDuration / 2
        const overlapEnd = clip2.timelineStartMs + transitionDuration / 2

        // Create modified clips with overlap
        const modifiedClip1 = {
            ...clip1,
            timelineEndMs: overlapStart + transitionDuration,
            properties: {
                ...clip1.properties,
                transitionOut: {
                    type: transition.type,
                    duration: transitionDuration,
                    startMs: overlapStart
                }
            }
        }

        const modifiedClip2 = {
            ...clip2,
            timelineStartMs: overlapEnd - transitionDuration,
            properties: {
                ...clip2.properties,
                transitionIn: {
                    type: transition.type,
                    duration: transitionDuration,
                    endMs: overlapEnd
                }
            }
        }

        // Execute the changes
        executeCommand({
            type: 'BATCH',
            payload: {
                commands: [
                    {
                        type: 'UPDATE_CLIP',
                        payload: { before: clip1, after: modifiedClip1 }
                    },
                    {
                        type: 'UPDATE_CLIP',
                        payload: { before: clip2, after: modifiedClip2 }
                    }
                ]
            }
        })

        // Visual feedback
        setSelectedTransition(transition.id)
        setTimeout(() => setSelectedTransition(null), 1000)
    }

    const removeTransitionFromClip = (clip: any, position: 'in' | 'out') => {
        const modifiedClip = {
            ...clip,
            properties: {
                ...clip.properties,
                [position === 'in' ? 'transitionIn' : 'transitionOut']: undefined
            }
        }

        executeCommand({
            type: 'UPDATE_CLIP',
            payload: { before: clip, after: modifiedClip }
        })
    }

    const removeTransitionBetweenClips = (clip1: any, clip2: any) => {
        const modifiedClip1 = {
            ...clip1,
            properties: {
                ...clip1.properties,
                transitionOut: undefined
            }
        }

        const modifiedClip2 = {
            ...clip2,
            properties: {
                ...clip2.properties,
                transitionIn: undefined
            }
        }

        executeCommand({
            type: 'BATCH',
            payload: {
                commands: [
                    {
                        type: 'UPDATE_CLIP',
                        payload: { before: clip1, after: modifiedClip1 }
                    },
                    {
                        type: 'UPDATE_CLIP',
                        payload: { before: clip2, after: modifiedClip2 }
                    }
                ]
            }
        })
    }

    const hasTransition = (clip1: any, clip2?: any) => {
        if (clip2) {
            return clip1.properties?.transitionOut || clip2.properties?.transitionIn
        }
        return clip1.properties?.transitionIn || clip1.properties?.transitionOut
    }

    if (videoClips.length === 0) {
        return (
            <div className="flex flex-col w-full gap-4 p-4">
                <div className="flex flex-col gap-3">
                    <h3 className="text-lg font-semibold text-gray-800">Transitions</h3>
                    <p className="text-sm text-gray-600">Add smooth transitions to your clips</p>
                </div>
                
                <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-2xl">🎬</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Video Clips Found</h3>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                            Add video clips to your timeline to create transitions.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full gap-4 p-4">
            <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold text-gray-800">Transitions</h3>
                <p className="text-sm text-gray-600">Add smooth transitions to your clips</p>
            </div>
            
            {/* Instructions */}
            {showInstructions && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 How Transitions Work</h4>
                            <ul className="text-xs text-blue-700 space-y-1">
                                <li>• Apply fade in/out to individual clips</li>
                                <li>• Create crossfades between adjacent clips</li>
                                <li>• Transitions adapt to clip duration automatically</li>
                            </ul>
                        </div>
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
            
            {/* Tab Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                    onClick={() => setActiveTab('individual')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'individual'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    Individual Clips
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                        {videoClips.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('between')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'between'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                >
                    Between Clips
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                        {adjacentPairs.length}
                    </span>
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'individual' && (
                <div className="space-y-4">
                    {videoClips.map((clip, index) => {
                        const track = tracks.find(t => t.id === clip.trackId)
                        return (
                            <div key={clip.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                {/* Clip Info */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-medium text-gray-700">
                                            Track {track?.index ? track.index + 1 : '?'} • Clip {index + 1}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {((clip.timelineEndMs - clip.timelineStartMs) / 1000).toFixed(1)}s
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        {clip.properties?.transitionIn && (
                                            <button
                                                onClick={() => removeTransitionFromClip(clip, 'in')}
                                                className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                                            >
                                                Remove In
                                            </button>
                                        )}
                                        {clip.properties?.transitionOut && (
                                            <button
                                                onClick={() => removeTransitionFromClip(clip, 'out')}
                                                className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                                            >
                                                Remove Out
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Transition In Options */}
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-gray-600">Fade In Transitions</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {transitions.filter(t => t.position === 'in').map((transition) => (
                                            <button
                                                key={transition.id}
                                                onClick={() => applyTransitionToClip(transition, clip, 'in')}
                                                disabled={!!clip.properties?.transitionIn}
                                                className={`
                                                    relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 
                                                    transition-all duration-200 hover:scale-105 active:scale-95
                                                    ${selectedTransition === transition.id 
                                                        ? 'border-blue-500 bg-blue-50 shadow-lg' 
                                                        : clip.properties?.transitionIn
                                                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                                    }
                                                    group cursor-pointer disabled:cursor-not-allowed
                                                `}
                                            >
                                                <div className="text-sm group-hover:scale-110 transition-transform">
                                                    {transition.icon}
                                                </div>
                                                <div className="text-xs font-medium text-gray-800 text-center leading-tight">
                                                    {transition.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {(transition.duration / 1000).toFixed(1)}s
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Transition Out Options */}
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-gray-600">Fade Out Transitions</div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {transitions.filter(t => t.position === 'out').map((transition) => (
                                            <button
                                                key={transition.id}
                                                onClick={() => applyTransitionToClip(transition, clip, 'out')}
                                                disabled={!!clip.properties?.transitionOut}
                                                className={`
                                                    relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 
                                                    transition-all duration-200 hover:scale-105 active:scale-95
                                                    ${selectedTransition === transition.id 
                                                        ? 'border-blue-500 bg-blue-50 shadow-lg' 
                                                        : clip.properties?.transitionOut
                                                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                                    }
                                                    group cursor-pointer disabled:cursor-not-allowed
                                                `}
                                            >
                                                <div className="text-sm group-hover:scale-110 transition-transform">
                                                    {transition.icon}
                                                </div>
                                                <div className="text-xs font-medium text-gray-800 text-center leading-tight">
                                                    {transition.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {(transition.duration / 1000).toFixed(1)}s
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {activeTab === 'between' && (
                <div className="space-y-4">
                    {adjacentPairs.length === 0 ? (
                        <div className="text-center py-8 space-y-3">
                            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-lg">↔️</span>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-1">No Adjacent Clips</h4>
                                <p className="text-gray-500 text-xs max-w-sm mx-auto">
                                    Add multiple video clips close together to create crossfade transitions.
                                </p>
                            </div>
                        </div>
                    ) : (
                        adjacentPairs.map((pair, index) => (
                            <div key={`${pair.clip1.id}-${pair.clip2.id}`} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                {/* Clip Pair Info */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-medium text-gray-700">
                                            Track {pair.track.index + 1}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="bg-blue-100 px-2 py-1 rounded">
                                                Clip {clips.findIndex(c => c.id === pair.clip1.id) + 1}
                                            </span>
                                            <span>→</span>
                                            <span className="bg-blue-100 px-2 py-1 rounded">
                                                Clip {clips.findIndex(c => c.id === pair.clip2.id) + 1}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {hasTransition(pair.clip1, pair.clip2) && (
                                        <button
                                            onClick={() => removeTransitionBetweenClips(pair.clip1, pair.clip2)}
                                            className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                                        >
                                            Remove Transition
                                        </button>
                                    )}
                                </div>
                                
                                {/* Gap Info */}
                                {pair.gap > 0 && (
                                    <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                        ⚠️ {(pair.gap / 1000).toFixed(1)}s gap between clips
                                    </div>
                                )}

                                {/* Transition Options */}
                                <div className="grid grid-cols-4 gap-2">
                                    {transitions.filter(t => t.position === 'between').map((transition) => (
                                        <button
                                            key={transition.id}
                                            onClick={() => applyTransitionBetweenClips(transition, pair.clip1, pair.clip2)}
                                            disabled={hasTransition(pair.clip1, pair.clip2)}
                                            className={`
                                                relative flex flex-col items-center gap-1 p-3 rounded-lg border-2 
                                                transition-all duration-200 hover:scale-105 active:scale-95
                                                ${selectedTransition === transition.id 
                                                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                                                    : hasTransition(pair.clip1, pair.clip2)
                                                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                                                }
                                                group cursor-pointer disabled:cursor-not-allowed
                                            `}
                                        >
                                            {/* Transition Icon */}
                                            <div className="text-lg group-hover:scale-110 transition-transform">
                                                {transition.icon}
                                            </div>
                                            
                                            {/* Transition Name */}
                                            <div className="text-xs font-medium text-gray-800 text-center leading-tight">
                                                {transition.name}
                                            </div>
                                            
                                            {/* Duration */}
                                            <div className="text-xs text-gray-500">
                                                {(transition.duration / 1000).toFixed(1)}s
                                            </div>
                                            
                                            {/* Selection Indicator */}
                                            {selectedTransition === transition.id && (
                                                <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export default TransitionsToolPanel 