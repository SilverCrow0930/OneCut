import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { useEditor } from '@/contexts/EditorContext'
import type { Clip } from '@/types/editor'
import ClipMenu from './ClipMenu'

interface PreloadedMedia {
    clipId: string
    element: HTMLVideoElement | HTMLImageElement | HTMLAudioElement
    url: string
    isReady: boolean
    lastUsed: number
}

interface ClipLayerProps {
    clip: Clip
    sourceTime?: number
    preloadedMedia?: PreloadedMedia | null
}

export const ClipLayer = React.memo(function ClipLayer({ clip, sourceTime, preloadedMedia }: ClipLayerProps) {
    const { currentTime, isPlaying } = usePlayback()
    const { selectedClipId, selectedClipIds, setSelectedClipId, setSelectedClipIds } = useEditor()
    const localMs = currentTime * 1000 - clip.timelineStartMs
    const durationMs = clip.timelineEndMs - clip.timelineStartMs
    const videoRef = useRef<HTMLVideoElement>(null)
    const lastUpdateRef = useRef<number>(0)
    const lastSeekTimeRef = useRef<number>(0)

    // Memoize selection state calculations
    const selectionState = useMemo(() => ({
        isSelected: selectedClipId === clip.id,
        isInMultiSelection: selectedClipIds.includes(clip.id),
        isMultiSelectionActive: selectedClipIds.length > 1
    }), [selectedClipId, selectedClipIds, clip.id])

    const { isSelected, isInMultiSelection, isMultiSelectionActive } = selectionState
    const isPrimarySelection = isSelected && !isMultiSelectionActive

    // Early return if clip is not in view
    if (localMs < 0 || localMs > durationMs) {
        return null
    }

    const { url } = useAssetUrl(clip.assetId)
    const externalAsset = clip.properties?.externalAsset
    
    // 🚀 Use preloaded media URL if available, otherwise fall back to regular URL
    const mediaUrl = preloadedMedia?.url || externalAsset?.url || url

    // 🚀 Check if we have a ready preloaded element
    const hasPreloadedElement = preloadedMedia?.isReady && 
                               preloadedMedia.element && 
                               preloadedMedia.element.src === mediaUrl

    // Memoize crop state initialization
    const [crop, setCrop] = useState(() => ({
        width: clip.type === 'text' || clip.type === 'caption' ? 300 : 320,
        height: clip.type === 'text' || clip.type === 'caption' ? 80 : 180,
        left: 0,
        top: 0
    }))

    // Other state with better defaults
    const [mediaPos, setMediaPos] = useState({ x: 0, y: 0 })
    const [mediaScale, setMediaScale] = useState(1)
    const [isPanning, setIsPanning] = useState(false)
    const [panStart, setPanStart] = useState({ x: 0, y: 0 })
    const [mediaStart, setMediaStart] = useState({ x: 0, y: 0 })
    const [isResizing, setIsResizing] = useState(false)
    const [resizeType, setResizeType] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null)
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })
    const [isDraggingCrop, setIsDraggingCrop] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, left: 0, top: 0 })
    const [aspectRatio, setAspectRatio] = useState(16 / 9)

    // Memoize click handler
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        if (isPanning || isResizing || isDraggingCrop) return

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            // Multi-selection mode
            let newSelection: string[]
            if (selectedClipIds.includes(clip.id)) {
                newSelection = selectedClipIds.filter(id => id !== clip.id)
            } else {
                newSelection = [...selectedClipIds, clip.id]
            }
            setSelectedClipIds(newSelection)
            
            if (newSelection.includes(clip.id)) {
                setSelectedClipId(clip.id)
            } else if (newSelection.length > 0) {
                setSelectedClipId(newSelection[newSelection.length - 1])
            } else {
                setSelectedClipId(null)
            }
        } else {
            if (selectedClipIds.length > 1) {
                setSelectedClipIds([])
            }
            setSelectedClipId(clip.id)
        }
    }, [clip.id, selectedClipIds, setSelectedClipIds, setSelectedClipId, isPanning, isResizing, isDraggingCrop])

    // Get aspect ratio only when needed
    useEffect(() => {
        if (clip.type === 'video' && mediaUrl) {
            const media = document.createElement('video')
            media.src = mediaUrl
            const handler = () => {
                if (media.videoWidth && media.videoHeight) {
                    setAspectRatio(media.videoWidth / media.videoHeight)
                }
                media.removeEventListener('loadedmetadata', handler)
            }
            media.addEventListener('loadedmetadata', handler)
        } else if (clip.type === 'image' && mediaUrl) {
            const media = document.createElement('img')
            media.src = mediaUrl
            const handler = () => {
                if (media.naturalWidth && media.naturalHeight) {
                    setAspectRatio(media.naturalWidth / media.naturalHeight)
                }
                media.removeEventListener('load', handler)
            }
            media.addEventListener('load', handler)
        }
    }, [mediaUrl, clip.type])

    // Optimized video playback effect with preloading support
    useEffect(() => {
        const v = videoRef.current;
        if (!v || clip.type !== 'video') return;

        // 🚀 If we have a preloaded video element, try to use it
        if (hasPreloadedElement && preloadedMedia?.element instanceof HTMLVideoElement) {
            const preloadedVideo = preloadedMedia.element
            
            // Copy properties from preloaded element to our ref
            if (preloadedVideo.src && preloadedVideo.src !== v.src) {
                v.src = preloadedVideo.src
                console.log('🚀 Using preloaded video for instant playback:', clip.id)
            }
            
            // If the preloaded video already has metadata loaded, we can skip some loading time
            if (preloadedVideo.readyState >= 2 && v.readyState < 2) {
                // Preloaded video is ready, sync our element
                v.currentTime = preloadedVideo.currentTime
            }
        }

        const targetTime = sourceTime !== undefined ? sourceTime : Math.max(0, localMs / 1000);
        const now = performance.now();
        
        // More conservative seeking - only seek if really necessary
        const timeDiff = Math.abs(v.currentTime - targetTime);
        const shouldSeek = timeDiff > 0.15 && // Larger threshold
                          now - lastUpdateRef.current > 100 && // Less frequent updates
                          now - lastSeekTimeRef.current > 200 && // Prevent rapid seeking
                          v.readyState >= 2 && 
                          !v.seeking;

        if (shouldSeek) {
            v.currentTime = targetTime;
            lastUpdateRef.current = now;
            lastSeekTimeRef.current = now;
        }

        // Handle playback state changes
        if (isPlaying && v.paused) {
            v.volume = clip.volume || 1;
            v.muted = false;
            v.playbackRate = clip.speed || 1;
            
            const playPromise = v.play();
            playPromise?.catch((error) => {
                if (error.name === 'AbortError') {
                    v.muted = true;
                    v.play().catch(() => {});
                }
            });
        } else if (!isPlaying && !v.paused) {
            v.pause();
        }
    }, [sourceTime, localMs, clip.type, clip.volume, clip.speed, isPlaying, hasPreloadedElement, preloadedMedia]);

    // Remove individual audio handling - this will be handled by AudioContext
    // Audio clips will be managed by the centralized AudioProvider

    // Memoize render content with preloading optimizations
    const renderContent = useMemo(() => {
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
                        preload={hasPreloadedElement ? "none" : "metadata"} // Skip preload if we already have it
                        playsInline
                        muted={false}
                        onClick={handleClick}
                        draggable={false}
                    />
                )
            case 'audio':
                // Audio clips are now handled by AudioContext
                return (
                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'rgba(34, 197, 94, 0.8)',
                            borderRadius: '8px',
                            padding: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '120px',
                            minHeight: '60px'
                        }}
                        onClick={handleClick}
                    >
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                )
            case 'image':
                // 🚀 For images, we can directly use the preloaded element if available
                const imageElement = hasPreloadedElement && preloadedMedia?.element instanceof HTMLImageElement 
                    ? preloadedMedia.element 
                    : undefined;
                
                return (
                    <img
                        src={mediaUrl!}
                        style={style}
                        onClick={handleClick}
                        draggable={false}
                        loading={imageElement ? "eager" : "lazy"} // Load eagerly if preloaded
                        onLoad={() => {
                            if (imageElement) {
                                console.log('🚀 Using preloaded image for instant display:', clip.id)
                            }
                        }}
                    />
                )
            case 'text':
            case 'caption':
                // Text rendering logic - unchanged for now
                const placement = clip.properties?.placement || 'middle'
                let textPosition = {}
                switch (placement) {
                    case 'top':
                        textPosition = { top: '15%', transform: 'translateY(0%)' }
                        break
                    case 'bottom':
                        textPosition = { bottom: '15%', transform: 'translateY(0%)' }
                        break
                    case 'middle':
                    default:
                        textPosition = { top: '50%', transform: 'translateY(-50%)' }
                        break
                }

                const renderCaptionText = () => {
                    const text = clip.properties?.text || (clip.type === 'caption' ? 'Caption Clip' : 'Text Clip')
                    
                    if (clip.type === 'caption' && text.includes('<span color=')) {
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
                            width: '100%',
                            height: '100%',
                        }}
                        onClick={handleClick}
                    >
                        <div
                            style={{
                                ...clip.properties?.style,
                                textAlign: 'center',
                                lineHeight: '1.4',
                                padding: '0.5rem',
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                overflow: 'hidden',
                                fontSize: clip.properties?.style?.fontSize || 
                                    `${Math.max(16, Math.min(32, crop.width / 12))}px`,
                            }}
                        >
                            {renderCaptionText()}
                        </div>
                    </div>
                )
            default:
                return null
        }
    }, [clip.type, clip.properties, mediaUrl, mediaScale, crop.width, handleClick, hasPreloadedElement, preloadedMedia])

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
                
                // For text and caption clips, allow free resizing without aspect ratio constraints
                if (clip.type === 'text' || clip.type === 'caption') {
                    switch (resizeType) {
                        case 'nw': {
                            newWidth = Math.max(100, resizeStart.width - dx)
                            newHeight = Math.max(40, resizeStart.height - dy)
                            newLeft = resizeStart.left + (resizeStart.width - newWidth)
                            newTop = resizeStart.top + (resizeStart.height - newHeight)
                            break
                        }
                        case 'ne': {
                            newWidth = Math.max(100, resizeStart.width + dx)
                            newHeight = Math.max(40, resizeStart.height - dy)
                            newTop = resizeStart.top + (resizeStart.height - newHeight)
                            break
                        }
                        case 'sw': {
                            newWidth = Math.max(100, resizeStart.width - dx)
                            newHeight = Math.max(40, resizeStart.height + dy)
                            newLeft = resizeStart.left + (resizeStart.width - newWidth)
                            break
                        }
                        case 'se': {
                            newWidth = Math.max(100, resizeStart.width + dx)
                            newHeight = Math.max(40, resizeStart.height + dy)
                            break
                        }
                    }
                } else {
                    // For video/image clips, maintain aspect ratio
                    switch (resizeType) {
                        case 'nw': {
                            const delta = Math.min(dx, dy / aspectRatio)
                            newWidth = Math.max(40, resizeStart.width - delta)
                            newHeight = newWidth / aspectRatio
                            newLeft = resizeStart.left + (resizeStart.width - newWidth)
                            newTop = resizeStart.top + (resizeStart.height - newHeight)
                            break
                        }
                        case 'ne': {
                            const delta = Math.min(-dx, dy / aspectRatio)
                            newWidth = Math.max(40, resizeStart.width - delta)
                            newHeight = newWidth / aspectRatio
                            newTop = resizeStart.top + (resizeStart.height - newHeight)
                            break
                        }
                        case 'sw': {
                            const delta = Math.min(dx, -dy / aspectRatio)
                            newWidth = Math.max(40, resizeStart.width - delta)
                            newHeight = newWidth / aspectRatio
                            newLeft = resizeStart.left + (resizeStart.width - newWidth)
                            break
                        }
                        case 'se': {
                            const delta = Math.max(dx, dy / aspectRatio)
                            newWidth = Math.max(40, resizeStart.width + delta)
                            newHeight = newWidth / aspectRatio
                            break
                        }
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
    }, [isResizing, isDraggingCrop, resizeType, resizeStart, dragStart, crop, aspectRatio, clip.type])

    // --- Crop area dragging ---
    const handleCropMouseDown = (e: React.MouseEvent) => {
        if (isResizing) return
        setIsDraggingCrop(true)
        setDragStart({ x: e.clientX, y: e.clientY, left: crop.left, top: crop.top })
    }

    // Center crop area in player on first render
    useEffect(() => {
        // Find the player container - look for the parent element with aspect ratio styling
        const player = document.querySelector('[style*="aspectRatio"], [style*="aspect-ratio"]') || 
                      document.querySelector('.bg-black.rounded-xl');
        if (player) {
            const rect = (player as HTMLElement).getBoundingClientRect();
            setCrop(crop => {
                if (clip.type === 'text' || clip.type === 'caption') {
                    // For text/caption clips, start with a reasonable size positioned according to placement
                    const textWidth = Math.min(400, rect.width * 0.8)  // Max 400px or 80% of player width
                    const textHeight = 80  // Fixed height for text
                    const placement = clip.properties?.placement || 'middle'
                    
                    let topPosition = (rect.height - textHeight) / 2  // Default to center
                    
                    switch (placement) {
                        case 'top':
                            topPosition = rect.height * 0.1  // 10% from top
                            break
                        case 'bottom':
                            topPosition = rect.height * 0.9 - textHeight  // 10% from bottom
                            break
                        case 'middle':
                        default:
                            topPosition = (rect.height - textHeight) / 2  // Center
                            break
                    }
                    
                    return {
                        ...crop,
                        width: textWidth,
                        height: textHeight,
                        left: (rect.width - textWidth) / 2,   // Center horizontally
                        top: Math.max(0, Math.min(rect.height - textHeight, topPosition))  // Respect placement but keep in bounds
                    };
                } else {
                    // For video/image clips, fill the entire player area
                    return {
                        ...crop,
                        width: rect.width,    // Fill player width
                        height: rect.height,  // Fill player height
                        left: 0,              // Start at left edge
                        top: 0                // Start at top edge
                    };
                }
            });
        }
    }, [clip.type, clip.properties?.placement]);

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
                    isInMultiSelection && isMultiSelectionActive ? 'ring-2 ring-purple-500 ring-offset-1' : ''
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
                    {renderContent}
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
})