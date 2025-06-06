import React, { useMemo } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { ClipLayer } from './ClipLayer'
import type { Clip } from '@/types/editor'

export function Player() {
    const { currentTime } = usePlayback()
    const { clips, tracks, setSelectedClipId, aspectRatio } = useEditor()
    const currentTimeMs = currentTime * 1000

    // Performance optimization: Only render clips that are currently visible or about to be visible
    const visibleClips = useMemo(() => {
        const buffer = 2000 // 2 second buffer for smoother transitions
        const visibleClipList: Clip[] = []
        
        clips.forEach((clip: Clip) => {
            const isCurrentlyVisible = currentTimeMs >= clip.timelineStartMs && currentTimeMs <= clip.timelineEndMs
            const isNearby = Math.abs(currentTimeMs - clip.timelineStartMs) < buffer || 
                           Math.abs(currentTimeMs - clip.timelineEndMs) < buffer
            
            if (isCurrentlyVisible || isNearby) {
                visibleClipList.push(clip)
            }
        })

        // Sort clips by track index (lowest index on top)
        const sortedClips = visibleClipList.sort((a, b) => {
            const trackA = tracks.find(t => t.id === a.trackId)
            const trackB = tracks.find(t => t.id === b.trackId)
            return (trackA?.index ?? 0) - (trackB?.index ?? 0)
        })

        return sortedClips
    }, [clips, tracks, currentTimeMs])

    // Calculate source time for visible clips
    const clipsWithSourceTime = useMemo(() => {
        return visibleClips.map(clip => {
            const timelineOffset = currentTimeMs - clip.timelineStartMs
            const sourceTime = (clip.sourceStartMs + timelineOffset) / 1000 // Convert to seconds
            return { ...clip, sourceTime }
        })
    }, [visibleClips, currentTimeMs])

    // Get aspect ratio value based on mode
    const getAspectRatio = () => {
        return aspectRatio === 'vertical' ? '9 / 16' : '16 / 9'
    }

    return (
        <div className="flex items-center justify-center h-full p-4">
            <div
                className="relative bg-black shadow-2xl ring-1 ring-gray-200/20"
                style={{
                    aspectRatio: getAspectRatio(),
                    height: '100%',
                    maxHeight: '100%',
                    width: 'auto'
                }}
                onClick={() => {
                    setSelectedClipId(null)
                }}
            >
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                
                {/* Render active clips in order with their source times */}
                {clipsWithSourceTime.map(clip => (
                    <ClipLayer
                        key={clip.id}
                        clip={clip}
                        sourceTime={clip.sourceTime}
                    />
                ))}
            </div>
        </div>
    )
}