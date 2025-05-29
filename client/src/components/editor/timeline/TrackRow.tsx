import React, { useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import ClipItem from './ClipItem'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import type { Track, Clip } from '@/types/editor'

export default function TrackRow({
    track,
    clips,
    timelineSetIsDragOver,
    onClipSelect,
    selectedClipId,
}: {
    track: Track
    clips: Clip[]
    timelineSetIsDragOver: (isDragOver: boolean) => void
    onClipSelect: (id: string | null) => void
    selectedClipId: string | null
}) {
    const rowRef = useRef<HTMLDivElement>(null)
    const { executeCommand, tracks, clips: allClips } = useEditor()
    const { assets } = useAssets()
    const { zoomLevel } = useZoom()
    const timeScale = getTimeScale(zoomLevel)

    // drag‐state for this single row
    const [isDragOver, setIsDragOver] = useState(false)
    const dragCounter = useRef(0)

    // context menu state
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        timelineSetIsDragOver(false)
        setIsDragOver(false)
        dragCounter.current = 0

        if (!rowRef.current) return

        // Try to parse as clip data first
        let clipPayload: { clipId: string } | undefined
        try {
            clipPayload = JSON.parse(e.dataTransfer.getData('application/json'))
        } catch {
            // Not a clip, continue to try asset data
        }

        if (clipPayload?.clipId) {
            // Handle clip drop
            const droppedClip = allClips.find(c => c.id === clipPayload.clipId)
            if (!droppedClip) return

            // Calculate new start time
            const rect = rowRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            const startMs = Math.max(0, Math.round(x / timeScale))

            // Check for overlaps with existing clips in this track
            const existingClips = clips.filter(c => c.id !== droppedClip.id)
            const clipWidth = (droppedClip.timelineEndMs - droppedClip.timelineStartMs) * timeScale
            const wouldOverlap = existingClips.some(c => {
                const clipLeft = c.timelineStartMs * timeScale
                const clipRight = c.timelineEndMs * timeScale
                return !(startMs + clipWidth <= clipLeft || startMs >= clipRight)
            })

            if (wouldOverlap) return

            // Update the clip position and track
            executeCommand({
                type: 'UPDATE_CLIP',
                payload: {
                    before: droppedClip,
                    after: {
                        ...droppedClip,
                        trackId: track.id,
                        timelineStartMs: startMs,
                        timelineEndMs: startMs + (droppedClip.timelineEndMs - droppedClip.timelineStartMs)
                    }
                }
            })
            return
        }

        // Try to parse as asset data
        let assetPayload: { assetId: string } | undefined
        try {
            assetPayload = JSON.parse(e.dataTransfer.getData('application/json'))
        } catch {
            return
        }

        if (!assetPayload?.assetId) return

        const asset = assets.find(a => a.id === assetPayload.assetId)
        if (!asset) return

        // compute time position
        const rect = rowRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const startMs = Math.max(0, Math.round(x / timeScale))

        // build new clip
        const dur = asset.duration ? Math.floor(asset.duration) : 0 // Duration is already in ms
        const newClip: Clip = {
            id: uuid(),
            trackId: track.id,
            assetId: asset.id,
            type: asset.mime_type.startsWith('audio/') ? 'audio' : 'video',
            sourceStartMs: 0,
            sourceEndMs: dur,
            timelineStartMs: startMs,
            timelineEndMs: startMs + dur,
            assetDurationMs: dur,
            volume: 1,
            speed: 1,
            properties: {},
            createdAt: new Date().toISOString(),
        }

        executeCommand({
            type: 'ADD_CLIP',
            payload: { clip: newClip }
        })
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenuPosition({ x: e.clientX, y: e.clientY })
        setShowContextMenu(true)
    }

    const handleDeleteTrack = () => {
        // Create a batch command for removing the track and reindexing
        const remainingTracks = tracks.filter(t => t.id !== track.id)
        const reindexedTracks = remainingTracks.map((t, index) => ({
            ...t,
            index
        }))

        executeCommand({
            type: 'BATCH',
            payload: {
                commands: [
                    // First remove the track and its clips
                    {
                        type: 'REMOVE_TRACK',
                        payload: {
                            track,
                            affectedClips: clips
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

        setShowContextMenu(false)
    }

    // Close context menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    return (
        <>
            <div
                ref={rowRef}
                className={`
                    relative h-12
                    transition-all duration-200 rounded-md
                    bg-gray-50 hover:bg-gray-100
                    shadow-sm
                `}
                onContextMenu={handleContextMenu}
                onDragOver={e => {
                    e.preventDefault()
                    e.stopPropagation()
                }}
                onDragEnter={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    dragCounter.current++
                    setIsDragOver(true)
                    timelineSetIsDragOver(false)
                }}
                onDragLeave={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    dragCounter.current--
                    if (dragCounter.current === 0) {
                        setIsDragOver(false)
                        timelineSetIsDragOver(true)
                    }
                }}
                onDrop={handleDrop}
            >
                {/* Background div that receives timeline clicks */}
                <div
                    className="absolute inset-0"
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        // Get the timeline container
                        const timelineContainer = rowRef.current?.closest('.timeline-container')
                        if (timelineContainer) {
                            const rect = timelineContainer.getBoundingClientRect()
                            const x = e.clientX - rect.left + timelineContainer.scrollLeft

                            // Create a new click event on the timeline container
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                clientX: e.clientX,
                                clientY: e.clientY
                            })
                            timelineContainer.dispatchEvent(clickEvent)
                        }
                    }}
                />

                {/* Clips container */}
                <div className="absolute inset-0">
                    {
                        clips.map(c => (
                            <ClipItem
                                key={c.id}
                                clip={c}
                                onSelect={onClipSelect}
                                selected={selectedClipId === c.id}
                            />
                        ))
                    }
                </div>
            </div>
            {
                showContextMenu && (
                    <div
                        className="
                            fixed 
                            bg-white shadow-xl rounded-lg py-1 z-50 
                            border border-gray-100
                            min-w-[160px]
                        "
                        style={{
                            left: contextMenuPosition.x,
                            top: contextMenuPosition.y,
                            zIndex: 9999
                        }}
                    >
                        <button
                            className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors duration-150"
                            onClick={handleDeleteTrack}
                        >
                            Delete Track
                        </button>
                    </div>
                )
            }
        </>
    )
}
