import React, { useRef, useEffect } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { ClipLayer } from './ClipLayer'

export default function Player() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const { currentTime, duration, setCurrentTime, setDuration } = usePlayback()
    const { clips, tracks } = useEditor()

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

    // Attach events on the <video> once it's in the DOM
    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        const onMeta = () => setDuration(vid.duration * 1000) // Convert to ms
        const onTime = () => setCurrentTime(vid.currentTime)
        vid.addEventListener('loadedmetadata', onMeta)
        vid.addEventListener('timeupdate', onTime)
        return () => {
            vid.removeEventListener('loadedmetadata', onMeta)
            vid.removeEventListener('timeupdate', onTime)
        }
    }, [setCurrentTime, setDuration])

    return (
        <div
            className="relative mx-auto bg-black"
            style={{ aspectRatio: '9 / 16', width: '100%', maxWidth: '20rem' }}
        >
            {/* Render active clips in order with their source times */}
            {clipsWithSourceTime.map(clip => (
                <ClipLayer
                    key={clip.id}
                    clip={clip}
                    sourceTime={clip.sourceTime}
                />
            ))}
        </div>
    )
}