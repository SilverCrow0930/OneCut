import React, { useRef, useEffect } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { ClipLayer } from './ClipLayer'

export default function Player() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const { currentTime, duration, setCurrentTime, setDuration } = usePlayback()
    const { clips, tracks, setSelectedClipId } = useEditor()

    // Get clips that are currently active at the playhead position
    const activeClips = clips.filter(clip => {
        const currentMs = currentTime * 1000
        return currentMs >= clip.timelineStartMs && currentMs <= clip.timelineEndMs
    })

    // Get clips that will be active soon (within next 2 seconds) for minimal preloading
    const upcomingClips = clips.filter(clip => {
        const currentMs = currentTime * 1000
        const futureMs = currentMs + 2000 // Reduced to 2 seconds for better performance
        return clip.timelineStartMs > currentMs && clip.timelineStartMs <= futureMs
    })

    // Minimal preloading with lower quality
    useEffect(() => {
        upcomingClips.slice(0, 2).forEach(clip => { // Limit to 2 clips max
            const externalAsset = clip.properties?.externalAsset
            let mediaUrl = externalAsset?.url
            
            if (mediaUrl && clip.type === 'video') {
                // Add quality parameters for lower bandwidth
                if (mediaUrl.includes('pexels.com')) {
                    mediaUrl = mediaUrl.replace('/original/', '/small/')
                } else if (mediaUrl.includes('giphy.com')) {
                    mediaUrl = mediaUrl.replace('.mp4', '_s.mp4') // Small version
                }
                
                const video = document.createElement('video')
                video.src = mediaUrl
                video.preload = 'none' // Minimal preloading
                video.load()
            }
        })
    }, [upcomingClips])

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
        const sourceTime = (clip.sourceStartMs + timelineOffset) / 1000
        return { ...clip, sourceTime }
    })

    // Simplified video event handling
    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return

        const onMeta = () => setDuration(vid.duration * 1000)
        const onTime = () => setCurrentTime(vid.currentTime)

        vid.addEventListener('loadedmetadata', onMeta)
        vid.addEventListener('timeupdate', onTime)

        return () => {
            vid.removeEventListener('loadedmetadata', onMeta)
            vid.removeEventListener('timeupdate', onTime)
        }
    }, [setCurrentTime, setDuration])

    return (
        <div className="flex items-center justify-center h-full p-4">
            <div
                className="relative bg-black rounded-xl shadow-2xl ring-1 ring-gray-200/20 w-full h-full"
                style={{
                    minHeight: '300px',
                    maxWidth: '100%',
                    maxHeight: '100%'
                }}
                onClick={() => setSelectedClipId(null)}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-xl pointer-events-none" />
                
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