import React, { createContext, useContext, useRef, useEffect, useState } from 'react'

interface AudioTrack {
    id: string
    url: string
    volume: number
    speed: number
    startTime: number
    endTime: number
}

interface AudioContextType {
    registerTrack: (track: AudioTrack) => void
    unregisterTrack: (id: string) => void
    updatePlayback: (currentTime: number, isPlaying: boolean) => void
    setTrackVolume: (id: string, volume: number) => void
    registerAudioClip: (clipId: string, url: string, startTime: number, endTime: number, volume: number, speed: number) => void
    updateTrackSpeed: (id: string, speed: number) => void
}

const AudioContext = createContext<AudioContextType | null>(null)

// Pool of reusable audio elements.
const AUDIO_POOL_SIZE = 8
const audioPool: HTMLAudioElement[] = []
const activeAudio = new Map<string, HTMLAudioElement>()

// Initialize audio pool
for (let i = 0; i < AUDIO_POOL_SIZE; i++) {
    const audio = new Audio()
    audio.preload = 'auto'
    audioPool.push(audio)
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const tracksRef = useRef<Map<string, AudioTrack>>(new Map())
    const lastUpdateTime = useRef<number>(0)
    const syncTimeoutRef = useRef<number | undefined>(undefined)

    const getAvailableAudioElement = (): HTMLAudioElement | null => {
        const activeElements = Array.from(activeAudio.values())
        return audioPool.find(audio => !activeElements.includes(audio)) || null
    }

    const registerTrack = (track: AudioTrack) => {
        tracksRef.current.set(track.id, track)
        console.log('🎵 Registered audio track:', track.id)
    }

    const unregisterTrack = (id: string) => {
        const audio = activeAudio.get(id)
        if (audio) {
            audio.pause()
            audio.currentTime = 0
            activeAudio.delete(id)
        }
        tracksRef.current.delete(id)
        console.log('🎵 Unregistered audio track:', id)
    }

    const setTrackVolume = (id: string, volume: number) => {
        const track = tracksRef.current.get(id)
        if (track) {
            track.volume = volume
            const audio = activeAudio.get(id)
            if (audio) {
                audio.volume = volume
            }
        }
    }

    const registerAudioClip = (clipId: string, url: string, startTime: number, endTime: number, volume: number, speed: number) => {
        const track: AudioTrack = {
            id: clipId,
            url,
            volume,
            speed,
            startTime,
            endTime
        }
        registerTrack(track)
    }

    const updateTrackSpeed = (id: string, speed: number) => {
        const track = tracksRef.current.get(id)
        if (track) {
            track.speed = speed
            const audio = activeAudio.get(id)
            if (audio) {
                audio.playbackRate = speed
            }
        }
    }

    const updatePlayback = (currentTime: number, isPlaying: boolean) => {
        const now = performance.now()
        
        // Throttle updates to 60fps max
        if (now - lastUpdateTime.current < 16) return
        lastUpdateTime.current = now

        // Clear existing timeout
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current)
        }

        // Debounce sync operations
        syncTimeoutRef.current = window.setTimeout(() => {
            syncAudioTracks(currentTime, isPlaying)
        }, 5)
    }

    const syncAudioTracks = (currentTime: number, isPlaying: boolean) => {
        const currentTimeMs = currentTime * 1000

        tracksRef.current.forEach((track, trackId) => {
            const isInRange = currentTimeMs >= track.startTime && currentTimeMs <= track.endTime
            const audio = activeAudio.get(trackId)

            if (isInRange && isPlaying) {
                if (!audio) {
                    // Need to start playing this track
                    const availableAudio = getAvailableAudioElement()
                    if (availableAudio) {
                        availableAudio.src = track.url
                        availableAudio.volume = track.volume
                        availableAudio.playbackRate = track.speed
                        availableAudio.currentTime = (currentTimeMs - track.startTime) / 1000
                        activeAudio.set(trackId, availableAudio)
                        
                        availableAudio.play().catch(error => {
                            console.warn('Audio autoplay failed:', error)
                        })
                    }
                } else {
                    // Sync existing audio
                    const targetTime = (currentTimeMs - track.startTime) / 1000
                    const timeDiff = Math.abs(audio.currentTime - targetTime)
                    
                    // Only seek if significantly out of sync
                    if (timeDiff > 0.1 && audio.readyState >= 2) {
                        audio.currentTime = targetTime
                    }

                    if (audio.paused) {
                        audio.play().catch(() => {})
                    }
                }
            } else if (audio) {
                // Stop playing this track
                audio.pause()
                activeAudio.delete(trackId)
            }
        })
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current)
            }
            activeAudio.forEach(audio => {
                audio.pause()
                audio.currentTime = 0
            })
            activeAudio.clear()
        }
    }, [])

    return (
        <AudioContext.Provider value={{
            registerTrack,
            unregisterTrack,
            updatePlayback,
            setTrackVolume,
            registerAudioClip,
            updateTrackSpeed
        }}>
            {children}
        </AudioContext.Provider>
    )
}

export const useAudio = () => {
    const context = useContext(AudioContext)
    if (!context) {
        throw new Error('useAudio must be used within AudioProvider')
    }
    return context
} 