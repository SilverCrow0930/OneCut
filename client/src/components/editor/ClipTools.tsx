import React, { useState, useEffect, useRef } from 'react'
import { SquareSplitHorizontal, Trash2, Gauge, Volume2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAudio } from '@/contexts/AudioContext'
import { v4 as uuid } from 'uuid'

// Simple Tooltip component
const Tooltip = ({ children, text, disabled = false }: { children: React.ReactNode, text: string, disabled?: boolean }) => {
    const [isVisible, setIsVisible] = useState(false)
    
    if (disabled) {
        return <>{children}</>
    }
    
    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                        {text}
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
                </div>
            )}
        </div>
    )
}

const ClipTools = () => {
    const { executeCommand, selectedClipId, selectedClipIds, clips, tracks, setSelectedClipId, setSelectedClipIds } = useEditor()
    const { currentTime } = usePlayback()
    const { setTrackVolume } = useAudio()
    const [showSpeedSlider, setShowSpeedSlider] = useState(false)
    const [showVolumeSlider, setShowVolumeSlider] = useState(false)
    const [sliderSpeed, setSliderSpeed] = useState(1)
    const [sliderVolume, setSliderVolume] = useState(1)
    const speedSliderRef = useRef<HTMLDivElement>(null)
    const volumeSliderRef = useRef<HTMLDivElement>(null)

    // Close speed slider when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (speedSliderRef.current && !speedSliderRef.current.contains(event.target as Node)) {
                setShowSpeedSlider(false)
            }
            if (volumeSliderRef.current && !volumeSliderRef.current.contains(event.target as Node)) {
                setShowVolumeSlider(false)
            }
        }

        if (showSpeedSlider || showVolumeSlider) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showSpeedSlider, showVolumeSlider])

    // Find the selected clip(s)
    const selectedClip = clips.find(clip => clip.id === selectedClipId)
    const selectedClips = clips.filter(clip => selectedClipIds.includes(clip.id))
    const hasSelectedClip = !!selectedClip
    const hasMultipleSelection = selectedClipIds.length > 1
    const hasAnySelection = hasSelectedClip || selectedClipIds.length > 0

    // Get the actual selected clips (handles both single and multi-selection)
    const actualSelectedClips = hasSelectedClip ? [selectedClip] : selectedClips
    const primarySelectedClip = hasSelectedClip ? selectedClip : (selectedClips.length === 1 ? selectedClips[0] : null)

    // Check if selected clips can have speed adjustments (video/audio only)
    const canAdjustSpeed = selectedClips.some(clip => 
        clip.type === 'video' || clip.type === 'audio'
    ) || (selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'audio'))

    // Check if selected clips can have volume adjustments (video/audio only)
    const canAdjustVolume = selectedClips.some(clip => 
        clip.type === 'video' || clip.type === 'audio'
    ) || (selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'audio'))

    // Update slider speed when selection changes
    useEffect(() => {
        if (primarySelectedClip && (primarySelectedClip.type === 'video' || primarySelectedClip.type === 'audio')) {
            const currentSpeed = primarySelectedClip.speed || 1
            setSliderSpeed(currentSpeed)
        } else if (selectedClips.length > 1) {
            // For multiple selection, show the speed of the first media clip or default to 1
            const firstMediaClip = selectedClips.find(clip => clip.type === 'video' || clip.type === 'audio')
            const currentSpeed = firstMediaClip?.speed || 1
            setSliderSpeed(currentSpeed)
        } else {
            setSliderSpeed(1) // Default speed for non-media clips
        }
    }, [selectedClip, selectedClips, hasSelectedClip, hasMultipleSelection, primarySelectedClip])

    // Update slider volume when selection changes
    useEffect(() => {
        if (primarySelectedClip && (primarySelectedClip.type === 'video' || primarySelectedClip.type === 'audio')) {
            const currentVolume = primarySelectedClip.volume || 1
            setSliderVolume(currentVolume)
        } else if (selectedClips.length > 1) {
            // For multiple selection, show the volume of the first media clip or default to 1
            const firstMediaClip = selectedClips.find(clip => clip.type === 'video' || clip.type === 'audio')
            const currentVolume = firstMediaClip?.volume || 1
            setSliderVolume(currentVolume)
        } else {
            setSliderVolume(1) // Default volume for non-media clips
        }
    }, [selectedClip, selectedClips, hasSelectedClip, hasMultipleSelection, primarySelectedClip])

    // Get volume icon based on current volume level - now using Lucide icon
    const getVolumeIcon = (volume: number) => {
        return Volume2 // Using single Lucide icon for all volume levels
    }

    const handleSpeedChange = (newSpeed: number) => {
        const clipsToUpdate = actualSelectedClips
        
        if (clipsToUpdate.length === 0) return

        const commands = clipsToUpdate
            .filter(clip => clip.type === 'video' || clip.type === 'audio') // Only update video/audio clips
            .map(clip => {
                // Calculate new timeline duration based on speed change
                const currentSourceDuration = clip.sourceEndMs - clip.sourceStartMs
                const newTimelineDuration = Math.round(currentSourceDuration / newSpeed)
                
                const updatedClip = {
                    ...clip,
                    speed: newSpeed,
                    timelineEndMs: clip.timelineStartMs + newTimelineDuration
                }

                return {
                    type: 'UPDATE_CLIP' as const,
                    payload: {
                        before: clip,
                        after: updatedClip
                    }
                }
            })

        if (commands.length > 0) {
            // Store current selection before executing commands
            const currentSelectedClipId = selectedClipId
            const currentSelectedClipIds = [...selectedClipIds]
            
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })
            
            // Restore selection after command execution if it was lost
            setTimeout(() => {
                if (!selectedClipId && currentSelectedClipId) {
                    setSelectedClipId(currentSelectedClipId)
                }
                if (selectedClipIds.length === 0 && currentSelectedClipIds.length > 0) {
                    setSelectedClipIds(currentSelectedClipIds)
                }
            }, 50)
        }
    }

    const handleVolumeChange = (newVolume: number) => {
        const clipsToUpdate = actualSelectedClips
        
        if (clipsToUpdate.length === 0) return

        // Update audio context immediately for real-time feedback
        clipsToUpdate
            .filter(clip => clip.type === 'video' || clip.type === 'audio')
            .forEach(clip => {
                setTrackVolume(clip.id, newVolume)
            })

        const commands = clipsToUpdate
            .filter(clip => clip.type === 'video' || clip.type === 'audio') // Only update video/audio clips
            .map(clip => {
                const updatedClip = {
                    ...clip,
                    volume: newVolume
                }

                return {
                    type: 'UPDATE_CLIP' as const,
                    payload: {
                        before: clip,
                        after: updatedClip
                    }
                }
            })

        if (commands.length > 0) {
            // Store current selection before executing commands
            const currentSelectedClipId = selectedClipId
            const currentSelectedClipIds = [...selectedClipIds]
            
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })
            
            // Restore selection after command execution if it was lost
            setTimeout(() => {
                if (!selectedClipId && currentSelectedClipId) {
                    setSelectedClipId(currentSelectedClipId)
                }
                if (selectedClipIds.length === 0 && currentSelectedClipIds.length > 0) {
                    setSelectedClipIds(currentSelectedClipIds)
                }
            }, 50)
        }
    }

    const handleDelete = () => {
        // Handle multiple clip deletion
        if (hasMultipleSelection) {
            const commands: any[] = []
            const tracksToCheck = new Set<string>()
            
            // Collect tracks that might become empty
            selectedClips.forEach(clip => {
                tracksToCheck.add(clip.trackId)
                commands.push({
                    type: 'REMOVE_CLIP',
                    payload: { clip }
                })
            })
            
            // Check which tracks become empty and remove them
            tracksToCheck.forEach(trackId => {
                const track = tracks.find(t => t.id === trackId)
                if (!track) return
                
                const remainingClipsInTrack = clips.filter(c => 
                    c.trackId === trackId && !selectedClipIds.includes(c.id)
                )
                
                if (remainingClipsInTrack.length === 0) {
                    commands.push({
                        type: 'REMOVE_TRACK',
                        payload: { track, affectedClips: [] }
                    })
                }
            })
            
            // Reindex remaining tracks
            const remainingTracks = tracks.filter(t => !Array.from(tracksToCheck).some(trackId => {
                const track = tracks.find(tr => tr.id === trackId)
                if (!track) return false
                const remainingClipsInTrack = clips.filter(c => 
                    c.trackId === trackId && !selectedClipIds.includes(c.id)
                )
                return remainingClipsInTrack.length === 0
            }))
            
            const reindexedTracks = remainingTracks.map((t, index) => ({ ...t, index }))
            reindexedTracks.forEach(track => {
                const originalTrack = tracks.find(t => t.id === track.id)
                if (originalTrack && originalTrack.index !== track.index) {
                    commands.push({
                        type: 'UPDATE_TRACK',
                        payload: { before: originalTrack, after: track }
                    })
                }
            })
            
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })
            
            return
        }
        
        // Handle single clip deletion (existing logic)
        if (!selectedClip) return

        // Find the track
        const track = tracks.find(t => t.id === selectedClip.trackId)
        if (!track) return

        // Check if the track becomes empty after removing this clip
        const remainingClipsInTrack = clips.filter(c => c.trackId === selectedClip.trackId && c.id !== selectedClip.id)

        if (remainingClipsInTrack.length === 0) {
            // Create a batch command for removing the clip, track, and reindexing
            const remainingTracks = tracks.filter(t => t.id !== track.id)
            const reindexedTracks = remainingTracks.map((t, index) => ({
                ...t,
                index
            }))

            executeCommand({
                type: 'BATCH',
                payload: {
                    commands: [
                        // First remove the clip
                        {
                            type: 'REMOVE_CLIP',
                            payload: {
                                clip: selectedClip
                            }
                        },
                        // Then remove the track
                        {
                            type: 'REMOVE_TRACK',
                            payload: {
                                track,
                                affectedClips: []
                            }
                        },
                        // Then update each track's index
                        ...reindexedTracks.map(track => ({
                            type: 'UPDATE_TRACK' as const,
                            payload: {
                                before: tracks.find(t => t.id === track.id)!,
                                after: track
                            }
                        }))
                    ]
                }
            })
        } else {
            // Just remove the clip
            executeCommand({
                type: 'REMOVE_CLIP',
                payload: {
                    clip: selectedClip
                }
            })
        }
    }

    const handleSplit = () => {
        if (!selectedClip) return

        const currentMs = currentTime * 1000

        // Check if the current time is within the clip's timeline
        if (currentMs <= selectedClip.timelineStartMs || currentMs >= selectedClip.timelineEndMs) {
            return
        }

        // Create the first part of the split clip
        const firstClip = {
            ...selectedClip,
            timelineEndMs: currentMs,
            sourceEndMs: selectedClip.sourceStartMs + (currentMs - selectedClip.timelineStartMs)
        }

        // Create the second part of the split clip
        const secondClip = {
            ...selectedClip,
            id: uuid(),
            timelineStartMs: currentMs,
            sourceStartMs: selectedClip.sourceStartMs + (currentMs - selectedClip.timelineStartMs)
        }

        // Update the first clip and add the second clip in a batch
        executeCommand({
            type: 'BATCH',
            payload: {
                commands: [
                    {
                        type: 'UPDATE_CLIP',
                        payload: {
                            before: selectedClip,
                            after: firstClip
                        }
                    },
                    {
                        type: 'ADD_CLIP',
                        payload: {
                            clip: secondClip
                        }
                    }
                ]
            }
        })
    }

    return (
        <div className={`
            flex items-center gap-4
            backdrop-blur-sm
            px-4 py-1 rounded-xl
            text-black
            transition-all duration-200
            relative
            min-w-max
        `}>
            {/* Selection info */}
            {hasMultipleSelection && (
                <span className="text-xs text-gray-600 font-medium">
                    {selectedClipIds.length} clips
                </span>
            )}
            
            <Tooltip text="Split" disabled={!hasSelectedClip || hasMultipleSelection}>
                <button
                    className={`
                        p-1 rounded-lg transition-all duration-200
                        ${hasSelectedClip && !hasMultipleSelection ?
                            'hover:bg-gray-300' :
                            'opacity-40 cursor-not-allowed'
                        }
                    `}
                    onClick={handleSplit}
                    disabled={!hasSelectedClip || hasMultipleSelection}
                >
                    <SquareSplitHorizontal size={26} />
                </button>
            </Tooltip>

            {/* Speed Control */}
            <div className="relative" ref={speedSliderRef}>
                <Tooltip text="Speed" disabled={!canAdjustSpeed || !hasAnySelection}>
                    <button
                        className={`
                            p-1 rounded-lg transition-all duration-200
                            ${canAdjustSpeed && hasAnySelection ? 
                                'hover:bg-gray-300' : 
                                'opacity-40 cursor-not-allowed'
                            }
                        `}
                        onClick={() => {
                            setShowSpeedSlider(!showSpeedSlider)
                        }}
                        disabled={!canAdjustSpeed || !hasAnySelection}
                    >
                        <Gauge size={26} />
                    </button>
                </Tooltip>

                {/* Speed Slider */}
                {showSpeedSlider && (
                    <div 
                        className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-[9999] min-w-[200px]"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="text-sm font-semibold text-gray-700 mb-3 text-center">
                            {sliderSpeed.toFixed(1)}x speed
                        </div>
                        <div 
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div
                                className="absolute w-full h-2 rounded-full"
                                style={{
                                    background: `linear-gradient(to right, #4B5563 ${((sliderSpeed - 0.1) / (10 - 0.1)) * 100}%, #9CA3AF ${((sliderSpeed - 0.1) / (10 - 0.1)) * 100}%)`
                                }}
                            ></div>
                            <input
                                type="range"
                                min="0.1"
                                max="10"
                                step="0.1"
                                value={sliderSpeed}
                                onChange={(e) => {
                                    e.stopPropagation()
                                    const newSpeed = parseFloat(e.target.value)
                                    setSliderSpeed(newSpeed)
                                    handleSpeedChange(newSpeed)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full h-2 bg-transparent appearance-none cursor-pointer relative z-10
                                    [&::-webkit-slider-thumb]:appearance-none 
                                    [&::-webkit-slider-thumb]:w-4 
                                    [&::-webkit-slider-thumb]:h-4 
                                    [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-webkit-slider-thumb]:bg-white
                                    [&::-webkit-slider-thumb]:border 
                                    [&::-webkit-slider-thumb]:border-gray-300
                                    [&::-webkit-slider-thumb]:shadow-2xl 
                                    [&::-webkit-slider-thumb]:cursor-pointer 
                                    [&::-moz-range-thumb]:w-4 
                                    [&::-moz-range-thumb]:h-4 
                                    [&::-moz-range-thumb]:rounded-full 
                                    [&::-moz-range-thumb]:bg-white 
                                    [&::-moz-range-thumb]:border 
                                    [&::-moz-range-thumb]:border-gray-300 
                                    [&::-moz-range-thumb]:shadow-2xl 
                                    [&::-moz-range-thumb]:cursor-pointer"
                            />
                        </div>
                        <div className="text-xs text-gray-500 mt-2 text-center">
                            0.1x - 10x
                        </div>
                    </div>
                )}
            </div>

            {/* Volume Control */}
            <div className="relative" ref={volumeSliderRef}>
                <Tooltip text="Volume" disabled={!canAdjustVolume || !hasAnySelection}>
                    <button
                        className={`
                            p-1 rounded-lg transition-all duration-200
                            ${canAdjustVolume && hasAnySelection ? 
                                'hover:bg-gray-300' : 
                                'opacity-40 cursor-not-allowed'
                            }
                        `}
                        onClick={() => {
                            setShowVolumeSlider(!showVolumeSlider)
                        }}
                        disabled={!canAdjustVolume || !hasAnySelection}
                    >
                        <Volume2 size={26} />
                    </button>
                </Tooltip>

                {/* Volume Slider */}
                {showVolumeSlider && (
                    <div 
                        className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-[9999] min-w-[200px]"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className="text-sm font-semibold text-gray-700 mb-3 text-center">
                            {Math.round(sliderVolume * 100)}% volume
                        </div>
                        <div 
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <div
                                className="absolute w-full h-2 rounded-full"
                                style={{
                                    background: `linear-gradient(to right, #4B5563 ${sliderVolume * 100}%, #9CA3AF ${sliderVolume * 100}%)`
                                }}
                            ></div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={sliderVolume}
                                onChange={(e) => {
                                    e.stopPropagation()
                                    const newVolume = parseFloat(e.target.value)
                                    setSliderVolume(newVolume)
                                    handleVolumeChange(newVolume)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full h-2 bg-transparent appearance-none cursor-pointer relative z-10
                                    [&::-webkit-slider-thumb]:appearance-none 
                                    [&::-webkit-slider-thumb]:w-4 
                                    [&::-webkit-slider-thumb]:h-4 
                                    [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-webkit-slider-thumb]:bg-white
                                    [&::-webkit-slider-thumb]:border 
                                    [&::-webkit-slider-thumb]:border-gray-300
                                    [&::-webkit-slider-thumb]:shadow-2xl 
                                    [&::-webkit-slider-thumb]:cursor-pointer 
                                    [&::-moz-range-thumb]:w-4 
                                    [&::-moz-range-thumb]:h-4 
                                    [&::-moz-range-thumb]:rounded-full 
                                    [&::-moz-range-thumb]:bg-white 
                                    [&::-moz-range-thumb]:border 
                                    [&::-moz-range-thumb]:border-gray-300 
                                    [&::-moz-range-thumb]:shadow-2xl 
                                    [&::-moz-range-thumb]:cursor-pointer"
                            />
                        </div>
                        <div className="text-xs text-gray-500 mt-2 text-center">
                            0% - 100%
                        </div>
                    </div>
                )}
            </div>

            <Tooltip text={hasMultipleSelection ? "Delete" : "Delete"} disabled={!hasAnySelection}>
                <button
                    className={`
                        p-1 rounded-lg transition-all duration-200
                        ${hasAnySelection ? 'hover:bg-gray-300' : 'opacity-40 cursor-not-allowed'}
                    `}
                    onClick={handleDelete}
                    disabled={!hasAnySelection}
                >
                    <Trash2 size={24} />
                </button>
            </Tooltip>
        </div>
    )
}

export default ClipTools