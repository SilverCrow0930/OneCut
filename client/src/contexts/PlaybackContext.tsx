import React, { createContext, useContext, ReactNode, useState, useRef, useEffect } from 'react'

interface PlaybackContextType {
    currentTime: number       // seconds
    duration: number          // milliseconds (timeline end + padding)
    isPlaying: boolean
    setCurrentTime: (t: number) => void
    setDuration: (d: number) => void
    play: () => void
    pause: () => void
    togglePlay: () => void
}

const PlaybackContext = createContext<PlaybackContextType | null>(null)

export function PlaybackProvider({ children }: { children: ReactNode }) {
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)  // in milliseconds
    const [isPlaying, setIsPlaying] = useState(false)
    const frameRef = useRef<number | undefined>(undefined)
    const startTimeRef = useRef<number>(0)
    const pausedTimeRef = useRef<number>(0)
    const currentTimeRef = useRef<number>(0)

    // Wrap setCurrentTime to also update pausedTimeRef
    const updateCurrentTime = (time: number) => {
        const maxTime = duration / 1000 // Convert ms to seconds
        if (duration === 0) {
            setCurrentTime(0)
            pausedTimeRef.current = 0
            currentTimeRef.current = 0
            return
        }
        const newTime = Math.min(maxTime, Math.max(0, time))
        setCurrentTime(newTime)
        pausedTimeRef.current = newTime
        currentTimeRef.current = newTime
    }

    // Animation frame loop for playback
    useEffect(() => {
        if (!isPlaying || duration === 0) {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current)
                frameRef.current = undefined
            }
            // Store the exact time when pausing
            pausedTimeRef.current = currentTimeRef.current
            return
        }

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) {
                startTimeRef.current = timestamp - (pausedTimeRef.current * 1000)
            }

            const elapsed = timestamp - startTimeRef.current
            const newTime = elapsed / 1000
            const maxTime = duration / 1000 // Convert ms to seconds

            // Update current time based on elapsed time
            if (newTime >= maxTime) {
                // Reset to beginning and continue playing
                currentTimeRef.current = 0
                setCurrentTime(0)
                startTimeRef.current = timestamp
            } else {
                currentTimeRef.current = newTime
                setCurrentTime(newTime)
            }

            frameRef.current = requestAnimationFrame(animate)
        }

        frameRef.current = requestAnimationFrame(animate)

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current)
            }
        }
    }, [isPlaying, duration])

    const play = () => {
        // Reset start time when starting playback
        startTimeRef.current = 0
        setIsPlaying(true)
    }
    const pause = () => setIsPlaying(false)
    const togglePlay = () => {
        if (isPlaying) {
            pause()
        } else {
            play()
        }
    }

    return (
        <PlaybackContext.Provider value={{
            currentTime,
            duration,
            isPlaying,
            setCurrentTime: updateCurrentTime,
            setDuration,
            play,
            pause,
            togglePlay
        }}>
            {children}
        </PlaybackContext.Provider>
    )
}

export function usePlayback() {
    const ctx = useContext(PlaybackContext)
    if (!ctx) throw new Error('usePlayback must be inside PlaybackProvider')
    return ctx
}