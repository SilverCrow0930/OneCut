import React, { useEffect, useRef } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import type { Clip } from '@/types/editor'

interface ClipLayerProps {
    clip: Clip
    sourceTime?: number
}

export function ClipLayer({ clip, sourceTime }: ClipLayerProps) {
    const { currentTime, isPlaying } = usePlayback()
    const localMs = currentTime * 1000 - clip.timelineStartMs
    const durationMs = clip.timelineEndMs - clip.timelineStartMs
    const videoRef = useRef<HTMLVideoElement>(null)
    const lastUpdateRef = useRef<number>(0)
    const targetTimeRef = useRef<number>(0)
    const updateIntervalRef = useRef<number>(0)

    // Only render if the playhead is inside this clip's window
    if (localMs < 0 || localMs > durationMs) {
        return null
    }

    const { url } = useAssetUrl(clip.assetId)

    // Smooth time update function
    const smoothUpdateTime = (targetTime: number) => {
        const v = videoRef.current
        if (!v) return

        // Clear any existing interval
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current)
        }

        // If the time difference is small, update immediately
        if (Math.abs(v.currentTime - targetTime) < 0.1) {
            v.currentTime = targetTime
            return
        }

        // Otherwise, smoothly interpolate to the target time
        const startTime = v.currentTime
        const duration = 100 // ms
        const startTimestamp = performance.now()

        updateIntervalRef.current = window.setInterval(() => {
            const elapsed = performance.now() - startTimestamp
            const progress = Math.min(elapsed / duration, 1)

            // Ease out cubic function for smoother deceleration
            const eased = 1 - Math.pow(1 - progress, 3)
            v.currentTime = startTime + (targetTime - startTime) * eased

            if (progress >= 1) {
                clearInterval(updateIntervalRef.current)
                v.currentTime = targetTime
            }
        }, 16) // ~60fps
    }

    useEffect(() => {
        const v = videoRef.current
        if (!v || clip.type !== 'video') return

        // Calculate target time
        const targetTime = sourceTime !== undefined
            ? sourceTime
            : Math.max(0, localMs / 1000)

        // Only update if enough time has passed since last update
        const now = performance.now()
        if (now - lastUpdateRef.current > 50) { // 50ms minimum between updates
            smoothUpdateTime(targetTime)
            lastUpdateRef.current = now
            targetTimeRef.current = targetTime
        }

        // Handle playback
        if (isPlaying) {
            // Ensure audio is properly initialized
            v.volume = 1
            v.muted = false

            const playPromise = v.play()
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // If playback fails, try muted
                    v.muted = true
                    v.play()
                })
            }
        } else {
            v.pause()
        }

        // Cleanup
        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current)
            }
        }
    }, [sourceTime, localMs, clip.type, isPlaying])

    switch (clip.type) {
        case 'video':
            return (
                <video
                    ref={videoRef}
                    src={url!}
                    className="absolute inset-0 w-full h-full object-cover"
                    preload="auto"
                    playsInline
                    muted={false}
                />
            )
        case 'image':
            return (
                <img
                    src={url!}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )
        case 'text':
            return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {clip.properties?.text}
                </div>
            )
        default:
            return null
    }
}