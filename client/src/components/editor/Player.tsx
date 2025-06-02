import React, { useRef, useEffect } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { ClipLayer } from './ClipLayer'

export default function Player() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const { currentTime, duration, setCurrentTime, setDuration } = usePlayback()
    const { clips, tracks, setSelectedClipId, playerSettings } = useEditor()

    // Get clips that are currently active at the playhead position
    const activeClips = clips.filter(clip => {
        const currentMs = currentTime * 1000
        return currentMs >= clip.timelineStartMs && currentMs <= clip.timelineEndMs
    })

    // Get clips that will be active soon (within next 5 seconds) for preloading
    const upcomingClips = clips.filter(clip => {
        const currentMs = currentTime * 1000
        const futureMs = currentMs + 5000 // 5 seconds ahead
        return clip.timelineStartMs > currentMs && clip.timelineStartMs <= futureMs
    })

    // Preload upcoming media elements
    useEffect(() => {
        upcomingClips.forEach(clip => {
            // Check if this is an external asset
            const externalAsset = clip.properties?.externalAsset
            const mediaUrl = externalAsset?.url
            
            if (mediaUrl) {
                // Preload external media
                if (clip.type === 'video') {
                    const video = document.createElement('video')
                    video.src = mediaUrl
                    video.preload = 'metadata'
                    video.load()
                } else if (clip.type === 'image') {
                    const img = new Image()
                    img.src = mediaUrl
                }
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
        const sourceTime = (clip.sourceStartMs + timelineOffset) / 1000 // Convert to seconds
        return { ...clip, sourceTime }
    })

    // Attach events on the <video> once it's in the DOM
    useEffect(() => {
        const vid = videoRef.current

        if (!vid) {
            return
        }

        const onMeta = () => setDuration(vid.duration * 1000) // Convert to ms
        const onTime = () => setCurrentTime(vid.currentTime)

        vid.addEventListener('loadedmetadata', onMeta)
        vid.addEventListener('timeupdate', onTime)

        return () => {
            vid.removeEventListener('loadedmetadata', onMeta)
            vid.removeEventListener('timeupdate', onTime)
        }
    }, [setCurrentTime, setDuration])

    // Calculate aspect ratio styles
    const getAspectRatioStyles = () => {
        if (playerSettings.aspectRatio === '16:9') {
            return {
                aspectRatio: '16 / 9',
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%'
            }
        } else {
            return {
                aspectRatio: '9 / 16',
                width: 'auto',
                height: '100%',
                maxHeight: '100%'
            }
        }
    }

    // Calculate background styles
    const getBackgroundStyles = () => {
        const background = playerSettings.background
        
        switch (background.type) {
            case 'white':
                return { backgroundColor: '#ffffff' }
            case 'image':
                return background.imageUrl 
                    ? {
                        backgroundImage: `url(${background.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                    }
                    : { backgroundColor: '#000000' }
            case 'black':
            default:
                return { backgroundColor: '#000000' }
        }
    }

    return (
        <div className="flex items-center justify-center h-full p-4">
            <div
                className="relative rounded-xl shadow-2xl ring-1 ring-gray-200/20"
                style={{
                    minHeight: '300px', // Minimum height for usability
                    ...getAspectRatioStyles(),
                    ...getBackgroundStyles()
                }}
                onClick={() => {
                    setSelectedClipId(null)
                }}
            >
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-xl pointer-events-none" />
                
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