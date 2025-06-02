import React from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { ClipLayer } from './ClipLayer'

export default function Player() {
    const { currentTime } = usePlayback()
    const { clips, tracks, setSelectedClipId } = useEditor()

    // Get clips that are currently active at the playhead position
    const activeClips = clips.filter(clip => {
        const currentMs = currentTime * 1000
        return currentMs >= clip.timelineStartMs && currentMs <= clip.timelineEndMs
    })

    // Sort clips by track index (lowest index on top)
    const sortedClips = [...activeClips].sort((a, b) => {
        const trackA = tracks.find(t => t.id === a.trackId)
        const trackB = tracks.find(t => t.id === b.trackId)
        return (trackA?.index ?? 0) - (trackB?.index ?? 0)
    })

    // Calculate source time for each clip
    const clipsWithSourceTime = sortedClips.map(clip => {
        const currentMs = currentTime * 1000
        const timelineOffset = currentMs - clip.timelineStartMs
        const sourceTime = (clip.sourceStartMs + timelineOffset) / 1000 // Convert to seconds
        return { ...clip, sourceTime }
    })

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
                
            {/* Render active clips in order with their source times */}
            {
                clipsWithSourceTime.map(clip => (
                    <ClipLayer
                        key={clip.id}
                        clip={clip}
                        sourceTime={clip.sourceTime}
                    />
                ))
            }
            </div>
        </div>
    )
}