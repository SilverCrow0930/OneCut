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
    track: Track & { isEmpty?: boolean }
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

        // Try to parse the payload
        let payload: { clipId?: string, assetId?: string, type?: string, assetType?: string, asset?: any }
        try {
            payload = JSON.parse(e.dataTransfer.getData('application/json'))
            console.log('TrackRow drop payload:', payload)
        } catch (error) {
            console.error('TrackRow failed to parse drop data:', error)
            return
        }

        // Check if this is an empty track - if so, we need to create a real track first
        const isEmptyTrack = (track as any).isEmpty === true
        
        // For empty tracks, we need to create a real track first, then add the clip
        if (isEmptyTrack) {
            console.log('Dropping on empty track, creating real track first')
            
            // Determine track type based on asset
            let trackType: 'audio' | 'video' = 'video'
            
            if (payload.type === 'external_asset') {
                trackType = payload.assetType === 'video' ? 'video' : 'video' // Images also go on video tracks
            } else if (payload.assetId) {
                const asset = assets.find(a => a.id === payload.assetId)
                if (asset) {
                    trackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'
                }
            }

            // Create the real track
            const newTrack = {
                id: uuid(),
                projectId: track.projectId,
                index: track.index,
                type: trackType,
                createdAt: new Date().toISOString(),
            }

            console.log('Creating real track for empty track:', newTrack)

            executeCommand({
                type: 'ADD_TRACK',
                payload: { track: newTrack }
            })

            // Update track reference for the rest of the function
            track = newTrack as any
        }

        // Handle external assets (Pexels/stickers)
        if (payload.type === 'external_asset') {
            console.log('Handling external asset on track:', payload)

            // Extract the correct URL based on asset type and source
            let mediaUrl = ''

            if (payload.asset.isSticker) {
                // Giphy sticker
                mediaUrl = payload.asset.url || payload.asset.images?.original?.url
            } else if (payload.assetType === 'image') {
                // Pexels image
                mediaUrl = payload.asset.src?.original || payload.asset.src?.large2x || payload.asset.src?.large
            } else if (payload.assetType === 'video') {
                // Pexels video - get the first available video file
                mediaUrl = payload.asset.video_files?.[0]?.link || payload.asset.url
            }

            console.log('Extracted media URL for track:', mediaUrl)

            if (!mediaUrl) {
                console.error('Could not extract media URL from external asset:', payload.asset)
                return
            }

            // Create a temporary asset-like object for external assets
            const externalAsset = {
                id: `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                url: mediaUrl,
                name: payload.asset.title || payload.asset.alt || `External ${payload.assetType}`,
                mime_type: payload.assetType === 'video' ? 'video/mp4' : 
                          (payload.asset.isSticker || mediaUrl.includes('.gif')) ? 'image/gif' : 'image/jpeg',
                duration: payload.assetType === 'video' ? 10000 : 
                         (payload.asset.isSticker || mediaUrl.includes('.gif')) ? 3000 : 5000, // 3s for GIFs, 5s for images
                isExternal: true,
                originalData: payload.asset
            }

            console.log('Created external asset for track:', externalAsset)

            // compute time position
            const rect = rowRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            let startMs = Math.round(x / timeScale)
            
            // Snap to 00:00 if we're very close to the beginning (within 10px)
            if (x < 10) {
                startMs = 0
            } else {
                startMs = Math.max(0, startMs)
            }

            console.log('Creating external clip in TrackRow at time:', startMs)

            // build new clip
            const dur = externalAsset.duration
            const newClip: Clip = {
                id: uuid(),
                trackId: track.id,
                assetId: externalAsset.id,
                type: payload.assetType === 'video' ? 'video' : 'video', // Images also go on video tracks
                sourceStartMs: 0,
                sourceEndMs: dur,
                timelineStartMs: startMs,
                timelineEndMs: startMs + dur,
                assetDurationMs: dur,
                volume: 1,
                speed: 1,
                properties: {
                    externalAsset: externalAsset // Store external asset data in properties
                },
                createdAt: new Date().toISOString(),
            }

            console.log('Creating external clip in TrackRow:', newClip)

            executeCommand({
                type: 'ADD_CLIP',
                payload: { clip: newClip }
            })
            return
        }

        // Handle clip drops
        if (payload.clipId) {
            console.log('Handling clip drop:', payload.clipId)
            const droppedClip = allClips.find(c => c.id === payload.clipId)
            if (!droppedClip) {
                console.error('Dropped clip not found:', payload.clipId)
                return
            }

            // Calculate new start time
            const rect = rowRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            let startMs = Math.round(x / timeScale)
            
            // Snap to 00:00 if we're very close to the beginning (within 10px)
            if (x < 10) {
                startMs = 0
            } else {
                startMs = Math.max(0, startMs)
            }

            // Check for overlaps with existing clips in this track
            const existingClips = clips.filter(c => c.id !== droppedClip.id)
            const clipWidth = (droppedClip.timelineEndMs - droppedClip.timelineStartMs) * timeScale
            const wouldOverlap = existingClips.some(c => {
                const clipLeft = c.timelineStartMs * timeScale
                const clipRight = c.timelineEndMs * timeScale
                return !(startMs + clipWidth <= clipLeft || startMs >= clipRight)
            })

            if (wouldOverlap) {
                console.log('Clip drop would overlap, cancelling')
                return
            }

            console.log('Moving clip to track:', track.id, 'at time:', startMs)

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

        // Handle regular asset drops
        if (!payload.assetId) {
            console.log('No assetId found in TrackRow payload')
            return
        }

        console.log('Looking for asset in TrackRow:', payload.assetId)
        const asset = assets.find(a => a.id === payload.assetId)
        if (!asset) {
            console.error('Asset not found in TrackRow:', payload.assetId)
            return
        }

        console.log('Found asset in TrackRow:', asset)

        // compute time position
        const rect = rowRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        let startMs = Math.round(x / timeScale)
        
        // Snap to 00:00 if we're very close to the beginning (within 10px)
        if (x < 10) {
            startMs = 0
        } else {
            startMs = Math.max(0, startMs)
        }

        console.log('Creating clip in TrackRow at time:', startMs)

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
            properties: asset.mime_type.startsWith('image/') ? {
                crop: {
                    width: 320,  // Default 16:9 aspect ratio
                    height: 180,
                    left: 0,
                    top: 0
                },
                mediaPos: {
                    x: 0,
                    y: 0
                },
                mediaScale: 1
            } : {},
            createdAt: new Date().toISOString(),
        }

        console.log('Creating clip in TrackRow:', newClip)

        executeCommand({
            type: 'ADD_CLIP',
            payload: { clip: newClip }
        })
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        // Don't show context menu for empty tracks
        if ((track as any).isEmpty) return
        
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
                    transition-all duration-200 rounded-lg
                    ${(track as any).isEmpty 
                        ? 'bg-gray-50/50 border-2 border-dashed border-gray-200/60 hover:border-gray-300/60 hover:bg-gray-100/50' 
                        : 'bg-white border-2 backdrop-blur-sm'
                    }
                    ${isDragOver
                        ? (track as any).isEmpty
                            ? 'border-blue-400 bg-blue-50 shadow-lg scale-[1.02]'
                            : 'border-blue-400 bg-blue-50 shadow-lg scale-[1.02]' 
                        : (track as any).isEmpty
                            ? ''
                            : 'border-gray-200/80 hover:border-gray-300 hover:bg-gray-50/80 shadow-sm hover:shadow-md'
                    }
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
                {/* Track type indicator - only for real tracks */}
                {!((track as any).isEmpty) && (
                    <div className={`
                        absolute left-1 top-0 bottom-0 w-1 rounded-l-lg
                        ${track.type === 'video' ? 'bg-blue-500' : 
                          track.type === 'audio' ? 'bg-green-500' : 'bg-purple-500'}
                    `} />
                )}

                {/* Track label */}
                <div className="absolute left-4 top-2 text-xs font-medium text-gray-600 pointer-events-none">
                    {(track as any).isEmpty 
                        ? "Drop content here to create track"
                        : `Track ${track.index + 1} • ${track.type}`
                    }
                </div>

                {/* Background div that receives timeline clicks */}
                <div
                    className="absolute inset-0 rounded-lg pointer-events-auto"
                    style={{ pointerEvents: isDragOver ? 'none' : 'auto' }}
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
                <div className="absolute inset-0 rounded-lg overflow-hidden pl-1">
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
