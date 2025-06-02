import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { useEditor } from '@/contexts/EditorContext'
import type { Clip } from '@/types/editor'
import ClipMenu from './ClipMenu'

interface ClipLayerProps {
    clip: Clip
    sourceTime?: number
}

export function ClipLayer({ clip, sourceTime }: ClipLayerProps) {
    const { currentTime, isPlaying } = usePlayback()
    const { selectedClipId, setSelectedClipId } = useEditor()
    const localMs = currentTime * 1000 - clip.timelineStartMs
    const durationMs = clip.timelineEndMs - clip.timelineStartMs
    const videoRef = useRef<HTMLVideoElement>(null)
    const lastSyncTime = useRef<number>(0)
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Simplified loading state
    const [isLoading, setIsLoading] = useState(true)

    // Crop area state
    const [crop, setCrop] = useState({
        width: clip.type === 'text' ? 240 : 320,
        height: clip.type === 'text' ? 100 : 180,
        left: 0,
        top: 0
    })

    // Pan/zoom state for media inside crop
    const [mediaPos, setMediaPos] = useState({ x: 0, y: 0 })
    const [mediaScale, setMediaScale] = useState(1)
    const [isPanning, setIsPanning] = useState(false)
    const [panStart, setPanStart] = useState({ x: 0, y: 0 })
    const [mediaStart, setMediaStart] = useState({ x: 0, y: 0 })
    const [isResizing, setIsResizing] = useState(false)
    const [resizeType, setResizeType] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null)
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

    // Drag state for moving the crop area
    const [isDraggingCrop, setIsDraggingCrop] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, left: 0, top: 0 })

    const isSelected = selectedClipId === clip.id

    // Only render if the playhead is inside this clip's window
    if (localMs < 0 || localMs > durationMs) {
        return null
    }

    const { url, loading } = useAssetUrl(clip.assetId)

    // Get lower quality media URL
    const getOptimizedMediaUrl = useCallback(() => {
        const externalAsset = clip.properties?.externalAsset
        let mediaUrl = externalAsset?.url || url

        if (mediaUrl && clip.type === 'video') {
            // Use lower quality for better performance
            if (mediaUrl.includes('pexels.com')) {
                mediaUrl = mediaUrl.replace('/original/', '/medium/')
            } else if (mediaUrl.includes('giphy.com')) {
                mediaUrl = mediaUrl.replace('.mp4', '_s.mp4')
            }
        }

        return mediaUrl
    }, [clip.properties?.externalAsset?.url, url, clip.type])

    const mediaUrl = getOptimizedMediaUrl()

    // Get asset aspect ratio
    const [aspectRatio, setAspectRatio] = useState(16 / 9)
    useEffect(() => {
        if (clip.type === 'video' && mediaUrl) {
            const media = document.createElement('video')
            media.src = mediaUrl
            media.addEventListener('loadedmetadata', () => {
                if (media.videoWidth && media.videoHeight) {
                    setAspectRatio(media.videoWidth / media.videoHeight)
                }
            })
        } else if (clip.type === 'image' && mediaUrl) {
            const media = document.createElement('img')
            media.src = mediaUrl
            media.addEventListener('load', () => {
                if (media.naturalWidth && media.naturalHeight) {
                    setAspectRatio(media.naturalWidth / media.naturalHeight)
                }
            })
        }
    }, [mediaUrl, clip.type])

    // --- Crop area resizing ---
    const handleResizeStart = (e: React.MouseEvent, type: 'nw' | 'ne' | 'sw' | 'se') => {
        e.stopPropagation()
        setIsResizing(true)
        setResizeType(type)
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            width: crop.width,
            height: crop.height,
            left: crop.left,
            top: crop.top
        })
    }
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing) {
                const dx = e.clientX - resizeStart.x
                const dy = e.clientY - resizeStart.y
                let newCrop = { ...crop }
                let newWidth = resizeStart.width
                let newHeight = resizeStart.height
                let newLeft = resizeStart.left
                let newTop = resizeStart.top
                // Always keep aspect ratio
                switch (resizeType) {
                    case 'nw': {
                        // Dragging top-left corner
                        const delta = Math.min(dx, dy / aspectRatio)
                        newWidth = Math.max(40, resizeStart.width - delta)
                        newHeight = newWidth / aspectRatio
                        newLeft = resizeStart.left + (resizeStart.width - newWidth)
                        newTop = resizeStart.top + (resizeStart.height - newHeight)
                        break
                    }
                    case 'ne': {
                        // Dragging top-right corner
                        const delta = Math.min(-dx, dy / aspectRatio)
                        newWidth = Math.max(40, resizeStart.width - delta)
                        newHeight = newWidth / aspectRatio
                        newTop = resizeStart.top + (resizeStart.height - newHeight)
                        break
                    }
                    case 'sw': {
                        // Dragging bottom-left corner
                        const delta = Math.min(dx, -dy / aspectRatio)
                        newWidth = Math.max(40, resizeStart.width - delta)
                        newHeight = newWidth / aspectRatio
                        newLeft = resizeStart.left + (resizeStart.width - newWidth)
                        break
                    }
                    case 'se': {
                        // Dragging bottom-right corner
                        const delta = Math.max(dx, dy / aspectRatio)
                        newWidth = Math.max(40, resizeStart.width + delta)
                        newHeight = newWidth / aspectRatio
                        break
                    }
                }
                newCrop.width = newWidth
                newCrop.height = newHeight
                newCrop.left = newLeft
                newCrop.top = newTop
                setCrop(newCrop)
            } else if (isDraggingCrop) {
                const dx = e.clientX - dragStart.x
                const dy = e.clientY - dragStart.y
                setCrop(crop => ({ ...crop, left: dragStart.left + dx, top: dragStart.top + dy }))
            }
        }
        const handleMouseUp = () => {
            setIsResizing(false)
            setResizeType(null)
            setIsDraggingCrop(false)
        }
        if (isResizing || isDraggingCrop) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, isDraggingCrop, resizeType, resizeStart, dragStart, crop, aspectRatio])

    // --- Crop area dragging ---
    const handleCropMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsDraggingCrop(true)
        setDragStart({ x: e.clientX, y: e.clientY, left: crop.left, top: crop.top })
    }

    // --- Selection ---
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedClipId(clip.id)
    }

    // --- Render media inside crop ---
    const renderContent = () => {
        const style = {
            position: 'absolute' as const,
            left: '50%',
            top: '50%',
            width: '100%',
            height: '100%',
            objectFit: 'contain' as const,
            transform: `translate(-50%, -50%) scale(${mediaScale})`,
            userSelect: 'none' as const,
        }

        if (isLoading || loading) {
            return (
                <div 
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        textAlign: 'center'
                    }}
                >
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto" />
                </div>
            )
        }

        if (!mediaUrl) {
            return (
                <div 
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        textAlign: 'center'
                    }}
                    onClick={handleClick}
                >
                    <div className="text-red-400">⚠️</div>
                </div>
            )
        }

        switch (clip.type) {
            case 'video':
                return (
                    <video
                        ref={videoRef}
                        src={mediaUrl}
                        style={style}
                        preload="metadata"
                        playsInline
                        muted={false}
                        onClick={handleClick}
                        draggable={false}
                        onLoadedData={() => setIsLoading(false)}
                    />
                )
            case 'image':
                return (
                    <img
                        src={mediaUrl}
                        style={style}
                        onClick={handleClick}
                        draggable={false}
                        onLoad={() => setIsLoading(false)}
                    />
                )
            case 'text':
                return (
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                        }}
                        onClick={handleClick}
                    >
                        <div
                            style={{
                                ...clip.properties?.style,
                                textAlign: 'center',
                                lineHeight: '1.4',
                                padding: '0.5rem 1rem',
                                maxWidth: '80%',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                            }}
                        >
                            {clip.properties?.text || 'Text Clip'}
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    // Optimized video sync with debouncing
    useEffect(() => {
        const v = videoRef.current
        if (!v || clip.type !== 'video') return

        const targetTime = sourceTime !== undefined ? sourceTime : Math.max(0, localMs / 1000)
        
        // Clear any pending sync
        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current)
        }

        // Debounced time sync - only sync if time difference is significant
        const timeDiff = Math.abs(v.currentTime - targetTime)
        if (timeDiff > 0.1) { // Only sync if off by more than 100ms
            v.currentTime = targetTime
            lastSyncTime.current = performance.now()
        }

        // Handle playback
        if (isPlaying) {
            v.volume = 1
            v.muted = false
            v.play().catch(() => {
                v.muted = true
                v.play().catch(() => {})
            })
        } else {
            v.pause()
        }

        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current)
            }
        }
    }, [sourceTime, localMs, clip.type, isPlaying])

    // Center crop area in player on first render
    useEffect(() => {
        const player = document.querySelector('.mx-auto.bg-black')
        if (player) {
            const rect = (player as HTMLElement).getBoundingClientRect()
            setCrop(crop => {
                if (crop.left === 0 && crop.top === 0) {
                    return {
                        ...crop,
                        height: rect.height,
                        top: 0,
                        left: (rect.width - crop.width) / 2
                    }
                }
                return crop
            })
        }
    }, [])

    // --- Main render ---
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {isSelected && (
                <div
                    className="absolute pointer-events-auto"
                    style={{
                        left: crop.left + crop.width / 2,
                        top: crop.top - 60,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <ClipMenu />
                </div>
            )}
            <div
                className={`relative pointer-events-auto ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                data-clip-layer
                style={{
                    width: crop.width,
                    height: crop.height,
                    left: crop.left,
                    top: crop.top,
                    overflow: 'visible',
                    position: 'absolute',
                    background: clip.type === 'text' ? 'rgba(0, 0, 0, 0)' : 'black',
                }}
                onClick={handleClick}
            >
                <div
                    className="w-full h-full"
                    style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '0.75rem' }}
                    onMouseDown={handleCropMouseDown}
                >
                    {renderContent()}
                </div>
                {isSelected && (
                    <>
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black cursor-nwse-resize z-50"
                            style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
                            onMouseDown={(e) => handleResizeStart(e, 'nw')}
                        />
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black cursor-nesw-resize z-50"
                            style={{ right: 0, top: 0, transform: 'translate(50%, -50%)' }}
                            onMouseDown={(e) => handleResizeStart(e, 'ne')}
                        />
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black cursor-nesw-resize z-50"
                            style={{ left: 0, bottom: 0, transform: 'translate(-50%, 50%)' }}
                            onMouseDown={(e) => handleResizeStart(e, 'sw')}
                        />
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black cursor-nwse-resize z-50"
                            style={{ right: 0, bottom: 0, transform: 'translate(50%, 50%)' }}
                            onMouseDown={(e) => handleResizeStart(e, 'se')}
                        />
                    </>
                )}
            </div>
        </div>
    )
}