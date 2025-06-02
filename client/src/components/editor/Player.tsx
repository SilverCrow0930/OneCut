import React, { useRef, useEffect, useState } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { ClipLayer } from './ClipLayer'

type AspectRatio = '16:9' | '9:16'

export default function Player() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const { currentTime, duration, setCurrentTime, setDuration } = usePlayback()
    const { clips, tracks, setSelectedClipId } = useEditor()
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')

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

    // Calculate player dimensions based on aspect ratio
    const getPlayerStyle = () => {
        const baseStyle = {
            minHeight: '300px',
            maxWidth: '100%',
            maxHeight: '100%'
        }

        if (aspectRatio === '16:9') {
            return {
                ...baseStyle,
                aspectRatio: '16/9',
                width: 'auto',
                height: 'auto'
            }
        } else {
            return {
                ...baseStyle,
                aspectRatio: '9/16',
                width: 'auto',
                height: 'auto',
                maxHeight: '70vh' // Limit height for 9:16 to prevent it from being too tall
            }
        }
    }

    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            {/* Aspect Ratio Controls */}
            <div className="mb-4 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm rounded-lg px-3 py-2">
                <span className="text-white text-sm font-medium">Aspect Ratio:</span>
                <div className="flex bg-gray-800 rounded-md p-1">
                    <button
                        onClick={() => setAspectRatio('16:9')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            aspectRatio === '16:9'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:text-white hover:bg-gray-700'
                        }`}
                    >
                        16:9
                    </button>
                    <button
                        onClick={() => setAspectRatio('9:16')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            aspectRatio === '9:16'
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:text-white hover:bg-gray-700'
                        }`}
                    >
                        9:16
                    </button>
                </div>
            </div>

            {/* Player Container */}
            <div
                className="relative bg-black rounded-xl shadow-2xl ring-1 ring-gray-200/20"
                style={getPlayerStyle()}
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