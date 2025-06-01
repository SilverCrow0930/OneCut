import React from 'react'
import { SquareSplitHorizontal, Trash2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { v4 as uuid } from 'uuid'

const ClipTools = () => {
    const { executeCommand, selectedClipId, clips, tracks } = useEditor()
    const { currentTime } = usePlayback()

    // Find the selected clip
    const selectedClip = clips.find(clip => clip.id === selectedClipId)
    const hasSelectedClip = !!selectedClip

    const handleDelete = () => {
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
            px-4 py-2.5 rounded-xl
            text-black
            transition-all duration-200
        `}>
            <button
                className={`
                    p-1 rounded-lg transition-all duration-200
                    ${hasSelectedClip ?
                        'hover:bg-gray-300' :
                        'opacity-40 cursor-not-allowed'
                    }
                `}
                title="Split clip"
                onClick={handleSplit}
                disabled={!hasSelectedClip}
            >
                <SquareSplitHorizontal size={26} />
            </button>
            <button
                className={`
                    p-1 rounded-lg transition-all duration-200
                    ${hasSelectedClip ? 'hover:bg-gray-300' : 'opacity-40 cursor-not-allowed'}
                `}
                title="Delete clip"
                onClick={handleDelete}
                disabled={!hasSelectedClip}
            >
                <Trash2 size={26} />
            </button>
        </div>
    )
}

export default ClipTools