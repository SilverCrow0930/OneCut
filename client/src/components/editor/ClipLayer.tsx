import React, { useEffect, useRef, useState } from 'react'
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
    const lastUpdateRef = useRef<number>(0)
    const targetTimeRef = useRef<number>(0)
    const updateIntervalRef = useRef<number>(0)

    // Crop area state
    const [crop, setCrop] = useState({
        width: clip.type === 'text' ? 240 : 320,
        height: clip.type === 'text' ? 100 : 180,
        left: 0,
        top: 0
    }) // default 16:9, smaller for text

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
    console.log('Clip selection state:', { clipId: clip.id, selectedClipId, isSelected })

    // Only render if the playhead is inside this clip's window
    if (localMs < 0 || localMs > durationMs) {
        return null
    }

    const { url } = useAssetUrl(clip.assetId)

    // Get asset aspect ratio
    const [aspectRatio, setAspectRatio] = useState(16 / 9)
    useEffect(() => {
        if (clip.type === 'video' && url) {
            const media = document.createElement('video')
            media.src = url
            media.addEventListener('loadedmetadata', () => {
                if (media.videoWidth && media.videoHeight) {
                    setAspectRatio(media.videoWidth / media.videoHeight)
                }
            })
        } else if (clip.type === 'image' && url) {
            const media = document.createElement('img')
            media.src = url
            media.addEventListener('load', () => {
                if (media.naturalWidth && media.naturalHeight) {
                    setAspectRatio(media.naturalWidth / media.naturalHeight)
                }
            })
        }
    }, [url, clip.type])

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
            objectFit: 'cover' as const,
            transform: `translate(-50%, -50%) scale(${mediaScale})`,
            userSelect: 'none' as const,
        }

        switch (clip.type) {
            case 'video':
                return (
                    <video
                        ref={videoRef}
                        src={url!}
                        style={style}
                        preload="auto"
                        playsInline
                        muted={false}
                        onClick={handleClick}
                        draggable={false}
                    />
                )
            case 'image':
                return (
                    <img
                        src={url!}
                        style={style}
                        onClick={handleClick}
                        draggable={false}
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

    useEffect(() => {
        const v = videoRef.current;
        if (!v || clip.type !== 'video') return;

        let playPromise: Promise<void> | undefined;

        // Calculate target time
        const targetTime = sourceTime !== undefined
            ? sourceTime
            : Math.max(0, localMs / 1000);

        // Only update if enough time has passed since last update
        const now = performance.now();
        if (now - lastUpdateRef.current > 50) { // 50ms minimum between updates
            v.currentTime = targetTime;
            lastUpdateRef.current = now;
            targetTimeRef.current = targetTime;
        }

        // Handle playback
        if (isPlaying) {
            v.volume = 1;
            v.muted = false;
            playPromise = v.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    // Only handle AbortError if the video is still in the DOM
                    if (error.name === 'AbortError' && document.contains(v)) {
                        v.muted = true;
                        v.play().catch(() => { }); // Ignore subsequent errors
                    }
                });
            }
        } else {
            v.pause();
        }

        // Cleanup function
        return () => {
            if (playPromise) {
                playPromise.catch(() => { }); // Prevent unhandled promise rejection
            }
            v.pause();
        };
    }, [sourceTime, localMs, clip.type, isPlaying]);

    // Center crop area in player on first render
    useEffect(() => {
        // Find the player size (parent of absolute inset-0)
        const player = document.querySelector('.mx-auto.bg-black');
        if (player) {
            const rect = (player as HTMLElement).getBoundingClientRect();
            setCrop(crop => {
                // Only center if left/top are 0 (i.e., not moved yet)
                if (crop.left === 0 && crop.top === 0) {
                    return {
                        ...crop,
                        height: rect.height, // Cover player vertically
                        top: 0,              // Start at top
                        left: (rect.width - crop.width) / 2 // Center horizontally
                    };
                }
                return crop;
            });
        }
    }, []);

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
                    style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
                    onMouseDown={handleCropMouseDown}
                >
                    {renderContent()}
                </div>
                {isSelected && (
                    <>
                        {/* Corner Resize handles - exactly in the corners */}
                        {/* NW */}
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black cursor-nwse-resize z-50"
                            style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)' }}
                            onMouseDown={(e) => handleResizeStart(e, 'nw')}
                        />
                        {/* NE */}
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black cursor-nesw-resize z-50"
                            style={{ right: 0, top: 0, transform: 'translate(50%, -50%)' }}
                            onMouseDown={(e) => handleResizeStart(e, 'ne')}
                        />
                        {/* SW */}
                        <div
                            className="absolute w-3 h-3 rounded-full bg-white border border-black cursor-nesw-resize z-50"
                            style={{ left: 0, bottom: 0, transform: 'translate(-50%, 50%)' }}
                            onMouseDown={(e) => handleResizeStart(e, 'sw')}
                        />
                        {/* SE */}
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