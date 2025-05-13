import React, { useState, useEffect, useRef } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { Clip } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { useAssets } from '@/contexts/AssetsContext'
import { formatTime } from '@/lib/utils'

export default function ClipItem({ clip }: { clip: Clip }) {
    const { executeCommand, clips, tracks, selectedClipId, setSelectedClipId } = useEditor()
    const { url } = useAssetUrl(clip.assetId)
    const { assets } = useAssets()
    const { zoomLevel } = useZoom()
    const timeScale = getTimeScale(zoomLevel)

    // context menu state
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

    // resize state
    const [isResizing, setIsResizing] = useState(false)
    const [resizeType, setResizeType] = useState<'start' | 'end' | null>(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartMs, setResizeStartMs] = useState(0)
    const [currentLeft, setCurrentLeft] = useState(0)
    const [currentWidth, setCurrentWidth] = useState(0)
    const clipRef = useRef<HTMLDivElement>(null)

    // drag state
    const [isDragging, setIsDragging] = useState(false)
    const [dragStartX, setDragStartX] = useState(0)
    const [dragStartMs, setDragStartMs] = useState(0)
    const [ghostLeft, setGhostLeft] = useState(0)
    const [ghostTrackId, setGhostTrackId] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState(0)
    const [isOverlapping, setIsOverlapping] = useState(false)

    // Find the asset details
    const asset = assets.find(a => a.id === clip.assetId)
    const isVideo = asset?.mime_type.startsWith('video/')
    const isImage = asset?.mime_type.startsWith('image/')
    const isAudio = asset?.mime_type.startsWith('audio/')

    // Get the source duration
    const assetDuration = asset?.duration ?? 0

    // convert ms → px
    const left = isResizing ? currentLeft : clip.timelineStartMs * timeScale
    const width = isResizing ? currentWidth : (clip.timelineEndMs - clip.timelineStartMs) * timeScale

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenuPosition({ x: e.clientX, y: e.clientY })
        setShowContextMenu(true)
    }

    const handleDelete = () => {
        // First remove the clip
        executeCommand({
            type: 'REMOVE_CLIP',
            payload: {
                clip
            }
        })

        // Check if the track becomes empty after removing this clip
        const remainingClipsInTrack = clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id)
        if (remainingClipsInTrack.length === 0) {
            // Find the track
            const track = tracks.find(t => t.id === clip.trackId)
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

        setShowContextMenu(false)
    }

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    // click handler to select
    const onClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedClipId(clip.id)
    }

    // Limit the number of thumbnails to prevent performance issues
    const MAX_THUMBNAILS = 4
    const thumbWidth = Math.max(width / MAX_THUMBNAILS, 32)
    const thumbHeight = '100%'

    // Calculate duration in milliseconds
    const durationMs = clip.timelineEndMs - clip.timelineStartMs

    const handleResizeStart = (e: React.MouseEvent, type: 'start' | 'end') => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        setResizeType(type)
        setResizeStartX(e.clientX)
        setResizeStartMs(type === 'start' ? clip.timelineStartMs : clip.timelineEndMs)
        setCurrentLeft(clip.timelineStartMs * timeScale)
        setCurrentWidth((clip.timelineEndMs - clip.timelineStartMs) * timeScale)
        document.body.classList.add('cursor-ew-resize')
    }

    const handleResizeMove = (e: MouseEvent) => {
        if (!isResizing || !resizeType || !clipRef.current) return

        const deltaX = e.clientX - resizeStartX
        const deltaMs = Math.round(deltaX / timeScale)

        if (resizeType === 'start') {
            // Calculate new start time with constraints
            const minStartMs = 0 // Can't go before timeline start
            const maxStartMs = clip.timelineEndMs - 100 // Minimum 100ms duration

            // Calculate source time proportionally
            const timelineRatio = (resizeStartMs + deltaMs - clip.timelineStartMs) / (clip.timelineEndMs - clip.timelineStartMs)
            const sourceDuration = clip.sourceEndMs - clip.sourceStartMs
            const newSourceStartMs = Math.round(clip.sourceStartMs + (sourceDuration * timelineRatio))

            // Only prevent moving left if source start is 0
            let newStartMs = resizeStartMs + deltaMs
            if (clip.sourceStartMs === 0 && newSourceStartMs < clip.sourceStartMs) {
                newStartMs = clip.timelineStartMs
            }

            // Apply minimum duration constraint
            newStartMs = Math.max(minStartMs, Math.min(newStartMs, maxStartMs))

            // Update visual position and width directly
            setCurrentLeft(newStartMs * timeScale)
            setCurrentWidth((clip.timelineEndMs - newStartMs) * timeScale)
        } else {
            // Calculate new end time with constraints
            const minEndMs = clip.timelineStartMs + 100 // Minimum 100ms duration
            const maxEndMs = clip.timelineStartMs + (assetDuration - clip.sourceStartMs) // Can't exceed asset duration

            // Calculate source time proportionally
            const timelineRatio = (resizeStartMs + deltaMs - clip.timelineStartMs) / (clip.timelineEndMs - clip.timelineStartMs)
            const sourceDuration = clip.sourceEndMs - clip.sourceStartMs
            const newSourceEndMs = Math.round(clip.sourceStartMs + (sourceDuration * timelineRatio))

            // Only prevent moving right if source end equals asset duration
            let newEndMs = resizeStartMs + deltaMs
            if (clip.sourceEndMs === assetDuration && newSourceEndMs > clip.sourceEndMs) {
                newEndMs = clip.timelineEndMs
            }

            // Apply minimum duration and asset duration constraints
            newEndMs = Math.max(minEndMs, Math.min(newEndMs, maxEndMs))

            // Update visual width directly
            setCurrentWidth((newEndMs - clip.timelineStartMs) * timeScale)
        }

        // Always maintain the resize cursor
        document.body.classList.add('cursor-ew-resize')
    }

    const handleResizeEnd = (e: MouseEvent) => {
        if (!isResizing || !resizeType || !clipRef.current) return

        const deltaX = e.clientX - resizeStartX
        const deltaMs = Math.round(deltaX / timeScale)

        let newStartMs = clip.timelineStartMs
        let newEndMs = clip.timelineEndMs
        let newSourceStartMs = clip.sourceStartMs
        let newSourceEndMs = clip.sourceEndMs

        if (resizeType === 'start') {
            // Calculate new start time with constraints
            const minStartMs = 0
            const maxStartMs = clip.timelineEndMs - 100

            // Calculate source time proportionally
            const timelineRatio = (resizeStartMs + deltaMs - clip.timelineStartMs) / (clip.timelineEndMs - clip.timelineStartMs)
            const sourceDuration = clip.sourceEndMs - clip.sourceStartMs
            newSourceStartMs = Math.round(clip.sourceStartMs + (sourceDuration * timelineRatio))

            // Only prevent moving left if source start is 0
            newStartMs = resizeStartMs + deltaMs
            if (clip.sourceStartMs === 0 && newSourceStartMs < clip.sourceStartMs) {
                newStartMs = clip.timelineStartMs
                newSourceStartMs = clip.sourceStartMs
            }

            // Apply minimum duration constraint
            newStartMs = Math.max(minStartMs, Math.min(newStartMs, maxStartMs))

            // Ensure source start time stays within bounds
            newSourceStartMs = Math.max(0, Math.min(newSourceStartMs, clip.sourceEndMs - 100))

            // Keep source end time fixed when resizing from left
            newSourceEndMs = clip.sourceEndMs
        } else {
            // Calculate new end time with constraints
            const minEndMs = clip.timelineStartMs + 100
            const maxEndMs = clip.timelineStartMs + (assetDuration - clip.sourceStartMs) // Can't exceed asset duration

            // Calculate source time proportionally
            const timelineRatio = (resizeStartMs + deltaMs - clip.timelineStartMs) / (clip.timelineEndMs - clip.timelineStartMs)
            const sourceDuration = clip.sourceEndMs - clip.sourceStartMs
            newSourceEndMs = Math.round(clip.sourceStartMs + (sourceDuration * timelineRatio))

            // Only prevent moving right if source end equals asset duration
            newEndMs = resizeStartMs + deltaMs
            if (clip.sourceEndMs === assetDuration && newSourceEndMs > clip.sourceEndMs) {
                newEndMs = clip.timelineEndMs
                newSourceEndMs = clip.sourceEndMs
            }

            // Apply minimum duration and asset duration constraints
            newEndMs = Math.max(minEndMs, Math.min(newEndMs, maxEndMs))

            // Ensure source end time stays within bounds
            newSourceEndMs = Math.max(newSourceStartMs + 100, Math.min(newSourceEndMs, assetDuration))

            // Keep source start time fixed when resizing from right
            newSourceStartMs = clip.sourceStartMs
        }

        // Execute the command to update the clip
        executeCommand({
            type: 'UPDATE_CLIP',
            payload: {
                before: clip,
                after: {
                    ...clip,
                    timelineStartMs: newStartMs,
                    timelineEndMs: newEndMs,
                    sourceStartMs: newSourceStartMs,
                    sourceEndMs: newSourceEndMs
                }
            }
        })

        // Reset resize state
        setIsResizing(false)
        setResizeType(null)
        setCurrentLeft(0)
        setCurrentWidth(0)
        document.body.classList.remove('cursor-ew-resize')
    }

    // Add cleanup for transform styles when component unmounts
    useEffect(() => {
        return () => {
            if (clipRef.current) {
                clipRef.current.style.transform = ''
                clipRef.current.style.width = ''
            }
        }
    }, [])

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove)
            document.addEventListener('mouseup', handleResizeEnd)
            return () => {
                document.removeEventListener('mousemove', handleResizeMove)
                document.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [isResizing, resizeType, resizeStartX, resizeStartMs])

    const handleDragStart = (e: React.DragEvent) => {
        if (isResizing) return

        e.dataTransfer.setData('application/json', JSON.stringify({ clipId: clip.id }))
        e.dataTransfer.effectAllowed = 'move'

        if (clipRef.current) {
            const rect = clipRef.current.getBoundingClientRect()
            const offset = e.clientX - rect.left
            setDragOffset(offset)

            // Create a simple ghost preview
            const ghost = document.createElement('div')
            ghost.style.width = `${width}px`
            ghost.style.height = `${rect.height}px`
            ghost.style.backgroundColor = '#3b82f6' // blue-500
            ghost.style.borderRadius = '4px'
            ghost.style.opacity = '0.5'
            ghost.style.position = 'absolute'
            ghost.style.top = '-1000px'
            ghost.style.pointerEvents = 'none'

            // Add a simple preview of the content type
            const icon = document.createElement('div')
            icon.style.width = '100%'
            icon.style.height = '100%'
            icon.style.display = 'flex'
            icon.style.alignItems = 'center'
            icon.style.justifyContent = 'center'

            if (isVideo) {
                icon.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>'
            } else if (isAudio) {
                icon.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>'
            } else if (isImage) {
                icon.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>'
            }

            ghost.appendChild(icon)
            document.body.appendChild(ghost)
            e.dataTransfer.setDragImage(ghost, offset, 0)

            // Clean up the ghost element after drag starts
            requestAnimationFrame(() => {
                document.body.removeChild(ghost)
            })
        }

        setIsDragging(true)
        setDragStartX(e.clientX)
        setDragStartMs(clip.timelineStartMs)
        setGhostLeft(clip.timelineStartMs * timeScale)
        setGhostTrackId(clip.trackId)
    }

    const handleDragEnd = () => {
        setIsDragging(false)
        setGhostTrackId(null)
        setDragOffset(0)
        setIsOverlapping(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!clipRef.current) return

        // Get the timeline container's position
        const timelineContainer = clipRef.current.closest('.timeline-container')
        if (!timelineContainer) return

        const timelineRect = timelineContainer.getBoundingClientRect()

        // Calculate position relative to the timeline container
        const x = e.clientX - timelineRect.left - dragOffset
        const newLeft = Math.max(0, Math.round(x / timeScale) * timeScale)

        // Check for collisions with other clips in the same track
        const otherClips = clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id)
        const clipWidth = (clip.timelineEndMs - clip.timelineStartMs) * timeScale

        // Find nearby clips and check for overlaps
        const nearbyClips = otherClips.filter(c => {
            const clipLeft = c.timelineStartMs * timeScale
            const clipRight = c.timelineEndMs * timeScale
            const snapDistance = 20 // pixels to consider for snapping

            // Check for overlap
            const isOverlap = !(newLeft + clipWidth <= clipLeft || newLeft >= clipRight)
            if (isOverlap) {
                setIsOverlapping(true)
            }

            return (
                // Check if we're near the left edge of another clip
                Math.abs(newLeft - clipLeft) < snapDistance ||
                // Check if we're near the right edge of another clip
                Math.abs((newLeft + clipWidth) - clipRight) < snapDistance ||
                // Check if we're near the end of a gap
                Math.abs(newLeft - (clipRight + 10)) < snapDistance ||
                // Check if we're near the start of a gap
                Math.abs((newLeft + clipWidth + 10) - clipLeft) < snapDistance
            )
        })

        // Calculate the final position with snapping
        let finalLeft = newLeft
        for (const nearbyClip of nearbyClips) {
            const clipLeft = nearbyClip.timelineStartMs * timeScale
            const clipRight = nearbyClip.timelineEndMs * timeScale

            // Snap to left edge
            if (Math.abs(newLeft - clipLeft) < 20) {
                finalLeft = clipLeft
                setIsOverlapping(false)
            }
            // Snap to right edge
            else if (Math.abs((newLeft + clipWidth) - clipRight) < 20) {
                finalLeft = clipRight - clipWidth
                setIsOverlapping(false)
            }
            // Snap to end of gap
            else if (Math.abs(newLeft - (clipRight + 10)) < 20) {
                finalLeft = clipRight + 10
                setIsOverlapping(false)
            }
            // Snap to start of gap
            else if (Math.abs((newLeft + clipWidth + 10) - clipLeft) < 20) {
                finalLeft = clipLeft - clipWidth - 10
                setIsOverlapping(false)
            }
        }

        // Ensure we don't go below 0
        finalLeft = Math.max(0, finalLeft)

        // Update ghost position directly without smoothing
        setGhostLeft(finalLeft)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (!clipRef.current || isOverlapping) return

        // Get the dropped clip data
        let payload: { clipId: string }
        try {
            payload = JSON.parse(e.dataTransfer.getData('application/json'))
        } catch {
            return
        }

        const droppedClip = clips.find(c => c.id === payload.clipId)
        if (!droppedClip) return

        // Calculate new start time
        const newStartMs = Math.round(ghostLeft / timeScale)

        // Update the clip position
        executeCommand({
            type: 'UPDATE_CLIP',
            payload: {
                before: droppedClip,
                after: {
                    ...droppedClip,
                    timelineStartMs: newStartMs,
                    timelineEndMs: newStartMs + (droppedClip.timelineEndMs - droppedClip.timelineStartMs)
                }
            }
        })
    }

    return (
        <>
            <div
                ref={clipRef}
                className={`
                    absolute h-full bg-blue-500 text-white text-xs
                    flex items-center justify-center rounded
                    overflow-hidden
                    ${isResizing ? 'cursor-ew-resize' : 'cursor-move'}
                    ${selectedClipId === clip.id ? 'ring-2 ring-cyan-300 border-cyan-200' : ''}
                    ${isDragging ? 'opacity-0' : ''}
                `}
                style={{
                    left,
                    width,
                    border: selectedClipId === clip.id ? '2px solid #67e8f9' : undefined
                }}
                onClick={onClick}
                onContextMenu={handleContextMenu}
                draggable={!isResizing}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Left edge hover area */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-6 cursor-ew-resize hover:bg-blue-400/20"
                    onMouseDown={(e) => handleResizeStart(e, 'start')}
                    style={{ zIndex: 30 }}
                />

                {/* Right edge hover area */}
                <div
                    className="absolute right-0 top-0 bottom-0 w-6 cursor-ew-resize hover:bg-blue-400/20"
                    onMouseDown={(e) => handleResizeStart(e, 'end')}
                    style={{ zIndex: 30 }}
                />

                {
                    url && (
                        <div className="absolute inset-0 flex">
                            {
                                isVideo ? (
                                    // For video, create a limited number of video thumbnails
                                    Array.from({ length: Math.min(Math.ceil(width / thumbWidth), MAX_THUMBNAILS) }).map((_, i) => (
                                        <div key={i} className="relative" style={{ width: thumbWidth, height: '100%' }}>
                                            <video
                                                src={url}
                                                className="w-full h-full object-cover"
                                                muted
                                                loop
                                                playsInline
                                            />
                                        </div>
                                    ))
                                ) : isImage ? (
                                    // For images, create a limited number of image thumbnails
                                    Array.from({ length: Math.min(Math.ceil(width / thumbWidth), MAX_THUMBNAILS) }).map((_, i) => (
                                        <div key={i} className="relative" style={{ width: thumbWidth, height: '100%' }}>
                                            <img
                                                src={url}
                                                className="w-full h-full object-cover"
                                                alt=""
                                            />
                                        </div>
                                    ))
                                ) : isAudio ? (
                                    // For audio, create a limited number of audio icons
                                    Array.from({ length: Math.min(Math.ceil(width / thumbWidth), MAX_THUMBNAILS) }).map((_, i) => (
                                        <div key={i} className="relative flex items-center justify-center bg-blue-600" style={{ width: thumbWidth, height: '100%' }}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                        </div>
                                    ))
                                ) : (
                                    // For other types, use the original background image approach
                                    <div
                                        className="w-full h-full"
                                        style={{
                                            backgroundImage: `url(${url})`,
                                            backgroundRepeat: 'repeat-x',
                                            backgroundSize: `${thumbWidth}px ${thumbHeight}`,
                                            backgroundPosition: 'left center',
                                            opacity: 0.7,
                                        }}
                                    />
                                )
                            }
                        </div>
                    )
                }
                <div className="relative z-10 bg-black/50 px-2 py-1 rounded">
                    {formatTime(durationMs)}
                </div>
            </div>
            {/* Ghost preview - only show for the clip being dragged */}
            {
                isDragging && ghostTrackId === clip.trackId && (
                    <div
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                            left: ghostLeft,
                            width: '2px',
                            backgroundColor: isOverlapping ? '#ef4444' : '#3b82f6', // red-500 or blue-500
                            zIndex: 9999
                        }}
                    />
                )
            }
            {
                showContextMenu && (
                    <div
                        className="fixed bg-white shadow-lg rounded-lg py-1 z-50 hover:bg-gray-100 cursor-pointer"
                        style={{
                            left: contextMenuPosition.x,
                            top: contextMenuPosition.y,
                            zIndex: 9999
                        }}
                    >
                        <button
                            className="w-full px-4 py-2 text-left text-red-600"
                            onClick={handleDelete}
                        >
                            Delete Clip
                        </button>
                    </div>
                )
            }
        </>
    )
}
