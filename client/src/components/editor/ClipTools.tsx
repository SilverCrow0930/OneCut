import React, { useState, useEffect, useRef } from 'react'
import { SquareSplitHorizontal, Trash2, Gauge } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { v4 as uuid } from 'uuid'

const ClipTools = () => {
    const { executeCommand, selectedClipId, selectedClipIds, clips, tracks } = useEditor()
    const { currentTime } = usePlayback()
    const [showSpeedSlider, setShowSpeedSlider] = useState(false)
    const [sliderSpeed, setSliderSpeed] = useState(1)
    const speedSliderRef = useRef<HTMLDivElement>(null)

    // Close speed slider when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (speedSliderRef.current && !speedSliderRef.current.contains(event.target as Node)) {
                setShowSpeedSlider(false)
            }
        }

        if (showSpeedSlider) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showSpeedSlider])

    // Find the selected clip(s)
    const selectedClip = clips.find(clip => clip.id === selectedClipId)
    const selectedClips = clips.filter(clip => selectedClipIds.includes(clip.id))
    const hasSelectedClip = !!selectedClip
    const hasMultipleSelection = selectedClipIds.length > 1
    const hasAnySelection = hasSelectedClip || hasMultipleSelection

    // Check if selected clips can have speed adjustments (video/audio only)
    const canAdjustSpeed = selectedClips.some(clip => 
        clip.type === 'video' || clip.type === 'audio'
    ) || (selectedClip && (selectedClip.type === 'video' || selectedClip.type === 'audio'))

    // Update slider speed when selection changes
    useEffect(() => {
        if (hasSelectedClip && !hasMultipleSelection && (selectedClip.type === 'video' || selectedClip.type === 'audio')) {
            setSliderSpeed(selectedClip.speed || 1)
        } else if (hasMultipleSelection) {
            // For multiple selection, show the speed of the first media clip or default to 1
            const firstMediaClip = selectedClips.find(clip => clip.type === 'video' || clip.type === 'audio')
            setSliderSpeed(firstMediaClip?.speed || 1)
        }
    }, [selectedClip, selectedClips, hasSelectedClip, hasMultipleSelection])

    const handleSpeedChange = (newSpeed: number) => {
        const clipsToUpdate = hasMultipleSelection ? selectedClips : (selectedClip ? [selectedClip] : [])
        
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
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })
        }
    }

    const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newSpeed = parseFloat(event.target.value)
        setSliderSpeed(newSpeed)
        handleSpeedChange(newSpeed)
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
        `}>
            {/* Selection info */}
            {hasMultipleSelection && (
                <span className="text-xs text-gray-600 font-medium">
                    {selectedClipIds.length} clips
                </span>
            )}
            
            <button
                className={`
                    p-1 rounded-lg transition-all duration-200
                    ${hasSelectedClip && !hasMultipleSelection ?
                        'hover:bg-gray-300' :
                        'opacity-40 cursor-not-allowed'
                    }
                `}
                title="Split clip"
                onClick={handleSplit}
                disabled={!hasSelectedClip || hasMultipleSelection}
            >
                <SquareSplitHorizontal size={26} />
            </button>

            {/* Speed Control */}
            <div className="relative" ref={speedSliderRef}>
                <button
                    className={`
                        p-1 rounded-lg transition-all duration-200
                        ${canAdjustSpeed && hasAnySelection ? 
                            'hover:bg-gray-300' : 
                            'opacity-40 cursor-not-allowed'
                        }
                    `}
                    title={hasMultipleSelection ? 
                        `Adjust speed of ${selectedClips.filter(c => c.type === 'video' || c.type === 'audio').length} media clips` : 
                        "Adjust playback speed"
                    }
                    onClick={() => {
                        console.log('Speed button clicked', { canAdjustSpeed, hasAnySelection, showSpeedSlider })
                        setShowSpeedSlider(!showSpeedSlider)
                    }}
                    disabled={!canAdjustSpeed || !hasAnySelection}
                >
                    <Gauge size={26} />
                </button>

                {/* Speed Slider */}
                {showSpeedSlider && (
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-[9999] min-w-[200px]">
                        <div className="text-xs font-semibold text-gray-700 mb-3 text-center">
                            Speed: {sliderSpeed}x
                        </div>
                        <div className="relative">
                            <div
                                className="absolute w-full h-2 rounded-full"
                                style={{
                                    background: `linear-gradient(to right, #4B5563 ${((sliderSpeed - 0.25) / (3 - 0.25)) * 100}%, #9CA3AF ${((sliderSpeed - 0.25) / (3 - 0.25)) * 100}%)`
                                }}
                            ></div>
                            <input
                                type="range"
                                min="0.25"
                                max="3"
                                step="0.25"
                                value={sliderSpeed}
                                onChange={handleSliderChange}
                                className="w-full h-2 bg-transparent appearance-none cursor-pointer relative z-10
                                    [&::-webkit-slider-thumb]:appearance-none 
                                    [&::-webkit-slider-thumb]:w-4 
                                    [&::-webkit-slider-thumb]:h-4 
                                    [&::-webkit-slider-thumb]:rounded-full 
                                    [&::-webkit-slider-thumb]:bg-white
                                    [&::-webkit-slider-thumb]:shadow-2xl 
                                    [&::-webkit-slider-thumb]:cursor-pointer 
                                    [&::-moz-range-thumb]:w-4 
                                    [&::-moz-range-thumb]:h-4 
                                    [&::-moz-range-thumb]:rounded-full 
                                    [&::-moz-range-thumb]:bg-white 
                                    [&::-moz-range-thumb]:border 
                                    [&::-moz-range-thumb]:border-black 
                                    [&::-moz-range-thumb]:shadow-2xl 
                                    [&::-moz-range-thumb]:cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>0.25x</span>
                                <span>1x</span>
                                <span>3x</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <button
                className={`
                    p-1 rounded-lg transition-all duration-200
                    ${hasAnySelection ? 'hover:bg-gray-300' : 'opacity-40 cursor-not-allowed'}
                `}
                title={hasMultipleSelection ? `Delete ${selectedClipIds.length} clips` : "Delete clip"}
                onClick={handleDelete}
                disabled={!hasAnySelection}
            >
                <Trash2 size={26} />
            </button>
        </div>
    )
}

export default ClipTools