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
    const { selectedClipId, selectedClipIds, setSelectedClipId, setSelectedClipIds } = useEditor()
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
    const isInMultiSelection = selectedClipIds.includes(clip.id)
    const isMultiSelectionActive = selectedClipIds.length > 1
    const isPrimarySelection = isSelected && !isMultiSelectionActive
    console.log('Clip selection state:', { clipId: clip.id, selectedClipId, isSelected, isInMultiSelection, isMultiSelectionActive })

    // Only render if the playhead is inside this clip's window
    if (localMs < 0 || localMs > durationMs) {
        return null
    }

    const { url } = useAssetUrl(clip.assetId)

    // Check if this is an external asset
    const externalAsset = clip.properties?.externalAsset
    const mediaUrl = externalAsset?.url || url

    console.log('ClipLayer render:', { 
        clipId: clip.id, 
        assetId: clip.assetId, 
        isExternal: !!externalAsset,
        mediaUrl,
        externalAsset 
    })

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
        
        // Handle multi-selection with Ctrl/Cmd key
        if (e.ctrlKey || e.metaKey) {
            const isCurrentlySelected = selectedClipIds.includes(clip.id)
            if (isCurrentlySelected) {
                // Remove from selection
                const newSelection = selectedClipIds.filter(id => id !== clip.id)
                setSelectedClipIds(newSelection)
                if (newSelection.length === 1) {
                    setSelectedClipId(newSelection[0])
                } else {
                    setSelectedClipId(null)
                }
            } else {
                // Add to selection
                const newSelection = [...selectedClipIds, clip.id]
                setSelectedClipIds(newSelection)
                setSelectedClipId(clip.id) // Set as primary selection
            }
        } else {
            // Normal single selection
            setSelectedClipIds([clip.id])
            setSelectedClipId(clip.id)
        }
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
                        src={mediaUrl!}
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
                        src={mediaUrl!}
                        style={style}
                        onClick={handleClick}
                        draggable={false}
                    />
                )
            case 'text':
            case 'caption':
                // Get placement from properties, default to middle
                const placement = clip.properties?.placement || 'middle'
                
                // Calculate position based on placement
                let textPosition = {}
                switch (placement) {
                    case 'top':
                        textPosition = {
                            top: '15%',
                            transform: 'translateY(0%)',
                        }
                        break
                    case 'bottom':
                        textPosition = {
                            bottom: '15%',
                            transform: 'translateY(0%)',
                        }
                        break
                    case 'middle':
                    default:
                        textPosition = {
                            top: '50%',
                            transform: 'translateY(-50%)',
                        }
                        break
                }

                // Render highlighted text for captions
                const renderCaptionText = () => {
                    const text = clip.properties?.text || (clip.type === 'caption' ? 'Caption Clip' : 'Text Clip')
                    
                    // Check if this is highlighted caption text
                    if (clip.type === 'caption' && text.includes('<span color=')) {
                        // Parse highlighted text
                        const parts = text.split(/(<span color="[^"]*">.*?<\/span>)/g)
                        
                        return parts.map((part: string, index: number) => {
                            const spanMatch = part.match(/<span color="([^"]*)">(.*?)<\/span>/)
                            if (spanMatch) {
                                const [, color, highlightedText] = spanMatch
                                return (
                                    <span key={index} style={{ color, fontWeight: 'bold' }}>
                                        {highlightedText}
                                    </span>
                                )
                            }
                            return part
                        })
                    }
                    
                    return text
                }

                return (
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            ...textPosition,
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
                            {renderCaptionText()}
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

        // Check if we need to seek (only seek if time difference is significant)
        const timeDiff = Math.abs(v.currentTime - targetTime);
        const now = performance.now();
        
        // Only seek if:
        // 1. Time difference is > 0.05 seconds (smaller threshold for better audio sync)
        // 2. Enough time has passed since last update (prevent too frequent seeks)
        // 3. Video is ready and not currently seeking
        if (timeDiff > 0.05 && now - lastUpdateRef.current > 80 && v.readyState >= 2 && !v.seeking) {
            v.currentTime = targetTime;
            lastUpdateRef.current = now;
            targetTimeRef.current = targetTime;
        }

        // Handle playback state
        if (isPlaying) {
            // Ensure audio is enabled for better sync
            v.volume = 1;
            v.muted = false;
            
            // Set playback rate to ensure smooth audio
            v.playbackRate = 1;
            
            // Only call play() if video is paused to avoid interrupting playback
            if (v.paused) {
                playPromise = v.play();
                if (playPromise !== undefined) {
                    playPromise.catch((error) => {
                        // Handle autoplay restrictions
                        if (error.name === 'AbortError' && document.contains(v)) {
                            v.muted = true;
                            v.play().catch(() => { }); // Ignore subsequent errors
                        }
                    });
                }
            }
        } else {
            // Only pause if currently playing to avoid unnecessary state changes
            if (!v.paused) {
                v.pause();
            }
        }

        // Cleanup function
        return () => {
            if (playPromise) {
                playPromise.catch(() => { }); // Prevent unhandled promise rejection
            }
        };
    }, [sourceTime, localMs, clip.type, isPlaying]);

    // Center crop area in player on first render
    useEffect(() => {
        // Find the player container - look for the parent element with aspect ratio styling
        const player = document.querySelector('[style*="aspectRatio"], [style*="aspect-ratio"]') || 
                      document.querySelector('.bg-black.rounded-xl');
        if (player) {
            const rect = (player as HTMLElement).getBoundingClientRect();
            setCrop(crop => {
                // Always fill the entire player area for vertical format
                return {
                    ...crop,
                    width: rect.width,    // Fill player width
                    height: rect.height,  // Fill player height
                    left: 0,              // Start at left edge
                    top: 0                // Start at top edge
                };
            });
        }
    }, []);

    // --- Main render ---
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {(isPrimarySelection || (isInMultiSelection && isMultiSelectionActive)) && (
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
                className={`relative pointer-events-auto ${
                    isPrimarySelection ? 'ring-2 ring-blue-500' : 
                    isInMultiSelection && isMultiSelectionActive ? 'ring-2 ring-purple-400' : ''
                }`}
                data-clip-layer
                data-clip-id={clip.id}
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
                {isPrimarySelection && (
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