import React from 'react'
import { SquareSplitHorizontal, Trash2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { v4 as uuid } from 'uuid'

const ClipTools = () => {
    const { executeCommand, selectedClipId, selectedClipIds, clips, tracks } = useEditor()
    const { currentTime } = usePlayback()

    // Find the selected clip(s)
    const selectedClip = clips.find(clip => clip.id === selectedClipId)
    const selectedClips = clips.filter(clip => selectedClipIds.includes(clip.id))
    const hasSelectedClip = !!selectedClip
    const hasMultipleSelection = selectedClipIds.length > 1
    const hasAnySelection = hasSelectedClip || hasMultipleSelection

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
            flex items-center gap-3
            backdrop-blur-sm
            px-4 py-1 rounded-xl
            text-black
            transition-all duration-200
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