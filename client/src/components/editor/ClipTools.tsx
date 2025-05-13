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

        // First remove the clip
        executeCommand({
            type: 'REMOVE_CLIP',
            payload: {
                clip: selectedClip
            }
        })

        // Check if the track becomes empty after removing this clip
        const remainingClipsInTrack = clips.filter(c => c.trackId === selectedClip.trackId && c.id !== selectedClip.id)
        if (remainingClipsInTrack.length === 0) {
            // Find the track
            const track = tracks.find(t => t.id === selectedClip.trackId)
            if (track) {
                // Remove the track
                executeCommand({
                    type: 'REMOVE_TRACK',
                    payload: {
                        track,
                        affectedClips: []
                    }
                })

                // Reindex remaining tracks
                const remainingTracks = tracks.filter(t => t.id !== track.id)
                const reindexedTracks = remainingTracks.map((t, index) => ({
                    ...t,
                    index
                }))

                // Update each track's index
                reindexedTracks.forEach(track => {
                    executeCommand({
                        type: 'UPDATE_TRACK',
                        payload: {
                            before: tracks.find(t => t.id === track.id)!,
                            after: track
                        }
                    })
                })
            }
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

        // Update the first clip and add the second clip
        executeCommand({
            type: 'UPDATE_CLIP',
            payload: {
                before: selectedClip,
                after: firstClip
            }
        })

        executeCommand({
            type: 'ADD_CLIP',
            payload: {
                clip: secondClip
            }
        })
    }

    return (
        <div className={`
            flex items-center gap-3
            bg-gray-800/80 backdrop-blur-sm
            px-4 py-2.5 rounded-xl
            text-gray-100
            transition-all duration-200
            hover:bg-gray-800
        `}>
            <button
                className={`
                    p-1 rounded-lg transition-all duration-200
                    ${hasSelectedClip ? 'hover:bg-gray-700' : 'opacity-40 cursor-not-allowed'}
                `}
                title="Split clip"
                onClick={handleSplit}
                disabled={!hasSelectedClip}
            >
                <SquareSplitHorizontal size={18} />
            </button>
            <button
                className={`
                    p-1 rounded-lg transition-all duration-200
                    ${hasSelectedClip ? 'hover:bg-gray-700' : 'opacity-40 cursor-not-allowed'}
                `}
                title="Delete clip"
                onClick={handleDelete}
                disabled={!hasSelectedClip}
            >
                <Trash2 size={18} />
            </button>
        </div>
    )
}

export default ClipTools