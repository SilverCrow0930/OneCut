import React, { useMemo, useEffect } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { useClipPreloader, cleanupAllPreloadedMedia } from '@/hooks/useClipPreloader'
import { ClipLayer } from './ClipLayer'
import { PreloadIndicator } from './PreloadIndicator'
import type { Clip } from '@/types/editor'

export function Player() {
    const { currentTime } = usePlayback()
    const { clips, tracks, setSelectedClipId } = useEditor()
    const currentTimeMs = currentTime * 1000

    // 🚀 Smart preloading system
    const { getPreloadedMedia, getPreloadStats, clipsToPreload } = useClipPreloader(clips, {
        preloadWindowMs: 5000,      // Preload clips 5 seconds ahead
        maxPreloadedItems: 8,       // Keep max 8 preloaded items
        cleanupIntervalMs: 10000    // Cleanup every 10 seconds
    })

    // Cleanup preloaded media when component unmounts
    useEffect(() => {
        return () => {
            cleanupAllPreloadedMedia()
        }
    }, [])

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

    const preloadStats = getPreloadStats()

    return (
        <div className="flex items-center justify-center h-full p-4">
            <div
                className="relative bg-black shadow-2xl ring-1 ring-gray-200/20"
                style={{
                    aspectRatio: '9 / 16',
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
                
                {/* Preload indicator - shows in development or when explicitly enabled */}
                {(process.env.NODE_ENV === 'development' || localStorage.getItem('showPreloadStats') === 'true') && (
                    <PreloadIndicator 
                        stats={preloadStats} 
                        className="absolute top-4 right-4 z-50" 
                    />
                )}
                
                {/* Render active clips in order with their source times */}
                {clipsWithSourceTime.map(clip => (
                    <ClipLayer
                        key={clip.id}
                        clip={clip}
                        sourceTime={clip.sourceTime}
                        preloadedMedia={getPreloadedMedia(clip.id)} // Pass preloaded media
                    />
                ))}
            </div>
        </div>
    )
}