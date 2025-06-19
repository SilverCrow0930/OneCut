import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { useEditor } from '@/contexts/EditorContext'
import { useAudio } from '@/contexts/AudioContext'
import type { Clip } from '@/types/editor'
import ClipMenu from './ClipMenu'
import { updateSnapGuides } from './Player'

interface ClipLayerProps {
    clip: Clip
    sourceTime?: number
}

export const ClipLayer = React.memo(function ClipLayer({ clip, sourceTime }: ClipLayerProps) {
    const { currentTime, isPlaying } = usePlayback()
    const { selectedClipId, selectedClipIds, setSelectedClipId, setSelectedClipIds } = useEditor()
    const { registerAudioClip, updateTrackSpeed, unregisterTrack } = useAudio()
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

    const { url, loading } = useAssetUrl(clip.assetId)
    const externalAsset = clip.properties?.externalAsset
    const mediaUrl = externalAsset?.url || url

    // Memoize crop state initialization
    const [crop, setCrop] = useState(() => ({
        width: clip.type === 'text' || clip.type === 'caption' ? 300 : 
               (externalAsset?.isExternal && clip.properties?.externalAsset?.originalData?.isSticker) ? 200 : 320,
        height: clip.type === 'text' || clip.type === 'caption' ? 80 : 
                (externalAsset?.isExternal && clip.properties?.externalAsset?.originalData?.isSticker) ? 200 : 180,
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

    // Snap tolerance in pixels
    const SNAP_TOLERANCE = 8

    // Calculate snap points and apply snapping
    const calculateSnapPosition = useCallback((newLeft: number, newTop: number, width: number, height: number) => {
        // Find the player container to get boundaries
        const player = document.querySelector('[style*="aspectRatio"], [style*="aspect-ratio"]') || 
                      document.querySelector('.bg-black');
        if (!player) return { left: newLeft, top: newTop, guides: { vertical: [], horizontal: [], showGuides: false } }

        const playerRect = (player as HTMLElement).getBoundingClientRect()
        
        // Player dimensions in player coordinate system (0, 0 is top-left of player)
        const playerWidth = playerRect.width
        const playerHeight = playerRect.height

        // Define snap points in player-relative coordinates
        const snapPoints = {
            vertical: [
                0, // Left edge
                playerWidth / 2, // Center
                playerWidth // Right edge
            ],
            horizontal: [
                0, // Top edge  
                playerHeight / 2, // Center
                playerHeight // Bottom edge
            ]
        }

        // Calculate clip edges in player-relative coordinates
        const clipLeft = newLeft
        const clipRight = newLeft + width
        const clipCenterX = newLeft + width / 2
        const clipTop = newTop
        const clipBottom = newTop + height
        const clipCenterY = newTop + height / 2

        let snappedLeft = newLeft
        let snappedTop = newTop
        const activeGuides: { vertical: number[], horizontal: number[], showGuides: boolean } = { 
            vertical: [], 
            horizontal: [], 
            showGuides: false 
        }

        // Check vertical snapping (X axis) - Scenario 1: Edge snapping & Scenario 2: Center snapping
        for (const snapX of snapPoints.vertical) {
            let hasSnapped = false
            
            // Snap left edge to snap line
            if (Math.abs(clipLeft - snapX) <= SNAP_TOLERANCE) {
                snappedLeft = snapX
                hasSnapped = true
            }
            // Snap right edge to snap line
            else if (Math.abs(clipRight - snapX) <= SNAP_TOLERANCE) {
                snappedLeft = snapX - width
                hasSnapped = true
            }
            // Snap center to snap line
            else if (Math.abs(clipCenterX - snapX) <= SNAP_TOLERANCE) {
                snappedLeft = snapX - width / 2
                hasSnapped = true
            }
            
            if (hasSnapped) {
                activeGuides.vertical.push(snapX)
                activeGuides.showGuides = true
                break // Only snap to one guide at a time for cleaner UX
            }
        }

        // Check horizontal snapping (Y axis) - Scenario 1: Edge snapping & Scenario 2: Center snapping
        for (const snapY of snapPoints.horizontal) {
            let hasSnapped = false
            
            // Snap top edge to snap line
            if (Math.abs(clipTop - snapY) <= SNAP_TOLERANCE) {
                snappedTop = snapY
                hasSnapped = true
            }
            // Snap bottom edge to snap line
            else if (Math.abs(clipBottom - snapY) <= SNAP_TOLERANCE) {
                snappedTop = snapY - height
                hasSnapped = true
            }
            // Snap center to snap line
            else if (Math.abs(clipCenterY - snapY) <= SNAP_TOLERANCE) {
                snappedTop = snapY - height / 2
                hasSnapped = true
            }
            
            if (hasSnapped) {
                activeGuides.horizontal.push(snapY)
                activeGuides.showGuides = true
                break // Only snap to one guide at a time for cleaner UX
            }
        }

        return {
            left: snappedLeft,
            top: snappedTop,
            guides: activeGuides
        }
    }, [])

    // Calculate snap points for resizing (Scenario 3: Resize snapping)
    const calculateResizeSnapPosition = useCallback((newLeft: number, newTop: number, newWidth: number, newHeight: number) => {
        // Find the player container to get boundaries
        const player = document.querySelector('[style*="aspectRatio"], [style*="aspect-ratio"]') || 
                      document.querySelector('.bg-black');
        if (!player) return { left: newLeft, top: newTop, width: newWidth, height: newHeight, guides: { vertical: [], horizontal: [], showGuides: false } }

        const playerRect = (player as HTMLElement).getBoundingClientRect()
        
        // Player dimensions in player coordinate system
        const playerWidth = playerRect.width
        const playerHeight = playerRect.height

        let snappedLeft = newLeft
        let snappedTop = newTop
        let snappedWidth = newWidth
        let snappedHeight = newHeight
        const activeGuides: { vertical: number[], horizontal: number[], showGuides: boolean } = { 
            vertical: [], 
            horizontal: [], 
            showGuides: false 
        }

        // Check if right edge should snap to player right edge
        const rightEdge = newLeft + newWidth
        if (Math.abs(rightEdge - playerWidth) <= SNAP_TOLERANCE) {
            snappedWidth = playerWidth - newLeft
            activeGuides.vertical.push(playerWidth)
            activeGuides.showGuides = true
        }

        // Check if left edge should snap to player left edge
        if (Math.abs(newLeft - 0) <= SNAP_TOLERANCE) {
            const adjustment = 0 - newLeft
            snappedLeft = 0
            snappedWidth = newWidth - adjustment
            activeGuides.vertical.push(0)
            activeGuides.showGuides = true
        }

        // Check if bottom edge should snap to player bottom edge
        const bottomEdge = newTop + newHeight
        if (Math.abs(bottomEdge - playerHeight) <= SNAP_TOLERANCE) {
            snappedHeight = playerHeight - newTop
            activeGuides.horizontal.push(playerHeight)
            activeGuides.showGuides = true
        }

        // Check if top edge should snap to player top edge
        if (Math.abs(newTop - 0) <= SNAP_TOLERANCE) {
            const adjustment = 0 - newTop
            snappedTop = 0
            snappedHeight = newHeight - adjustment
            activeGuides.horizontal.push(0)
            activeGuides.showGuides = true
        }

        return {
            left: snappedLeft,
            top: snappedTop,
            width: snappedWidth,
            height: snappedHeight,
            guides: activeGuides
        }
    }, [])

    // Check if clip should be rendered AFTER all hooks are called
    const isVisible = localMs >= 0 && localMs <= durationMs

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

    // Optimized video playback effect
    useEffect(() => {
        const v = videoRef.current;
        if (!v || clip.type !== 'video') return;

        const targetTime = sourceTime !== undefined ? sourceTime : Math.max(0, localMs / 1000);
        const now = performance.now();
        
        // Set playback rate immediately and whenever it changes
        const targetSpeed = clip.speed || 1;
        if (Math.abs(v.playbackRate - targetSpeed) > 0.01) {
            console.log('🎬 Setting video playback rate for clip:', clip.id, 'from:', v.playbackRate, 'to:', targetSpeed)
            v.playbackRate = targetSpeed;
        }

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
    }, [sourceTime, localMs, clip.type, clip.volume, clip.speed, isPlaying]);

    // Separate effect to handle video element loading and speed setting
    useEffect(() => {
        const v = videoRef.current;
        if (!v || clip.type !== 'video') return;

        const handleLoadedMetadata = () => {
            const targetSpeed = clip.speed || 1;
            console.log('🎬 Video metadata loaded, setting speed:', targetSpeed, 'for clip:', clip.id)
            
            try {
                // Check if playbackRate is supported
                if ('playbackRate' in v) {
                    v.playbackRate = targetSpeed;
                    console.log('🎬 Playback rate set successfully:', v.playbackRate);
                } else {
                    console.warn('🎬 Playback rate not supported by this browser/video');
                }
            } catch (error) {
                console.error('🎬 Error setting playback rate:', error);
            }
        };

        const handleCanPlay = () => {
            const targetSpeed = clip.speed || 1;
            if (Math.abs(v.playbackRate - targetSpeed) > 0.01) {
                console.log('🎬 Video can play, ensuring speed is set:', targetSpeed, 'for clip:', clip.id)
                try {
                    v.playbackRate = targetSpeed;
                    console.log('🎬 Playback rate corrected to:', v.playbackRate);
                } catch (error) {
                    console.error('🎬 Error correcting playback rate:', error);
                }
            }
        };

        // Add event listeners
        v.addEventListener('loadedmetadata', handleLoadedMetadata);
        v.addEventListener('canplay', handleCanPlay);

        // Set immediately if video is already loaded
        if (v.readyState >= 1) { // HAVE_METADATA
            handleLoadedMetadata();
        }

        return () => {
            v.removeEventListener('loadedmetadata', handleLoadedMetadata);
            v.removeEventListener('canplay', handleCanPlay);
        };
    }, [clip.speed, clip.id, clip.type])

    // Register audio clip with AudioContext
    useEffect(() => {
        if (clip.type === 'audio' && url && !loading) {
            console.log('Registering audio clip:', clip.id, 'with speed:', clip.speed || 1, 'url:', url)
            registerAudioClip(clip.id, url, clip.timelineStartMs, clip.timelineEndMs, clip.volume || 1, clip.speed || 1)
            
            return () => {
                console.log('Unregistering audio clip:', clip.id)
                unregisterTrack(clip.id)
            }
        } else if (clip.type === 'audio' && loading) {
            console.log('Audio clip waiting for URL:', clip.id)
        }
    }, [clip.id, clip.type, url, loading, clip.timelineStartMs, clip.timelineEndMs, clip.volume, registerAudioClip, unregisterTrack])

    // Update audio speed when clip speed changes
    useEffect(() => {
        if (clip.type === 'audio') {
            console.log('Updating audio speed for clip:', clip.id, 'to:', clip.speed || 1)
            updateTrackSpeed(clip.id, clip.speed || 1)
        }
    }, [clip.speed, clip.id, clip.type, updateTrackSpeed])

    // Memoize render content
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
                        preload="metadata" // Changed from "auto" for better performance
                        playsInline
                        muted={false}
                        onClick={handleClick}
                        draggable={false}
                        onLoadedMetadata={() => {
                            const v = videoRef.current;
                            if (v) {
                                const targetSpeed = clip.speed || 1;
                                console.log('🎬 Video onLoadedMetadata, setting speed:', targetSpeed, 'current:', v.playbackRate, 'clip:', clip.id);
                                v.playbackRate = targetSpeed;
                            }
                        }}
                        onPlay={() => {
                            const v = videoRef.current;
                            if (v) {
                                const targetSpeed = clip.speed || 1;
                                if (Math.abs(v.playbackRate - targetSpeed) > 0.01) {
                                    console.log('🎬 Video onPlay, correcting speed:', targetSpeed, 'was:', v.playbackRate, 'clip:', clip.id);
                                    v.playbackRate = targetSpeed;
                                }
                            }
                        }}
                        onLoadStart={() => {
                            console.log('🎬 Video element load started for clip:', clip.id, 'expected speed:', clip.speed || 1);
                        }}
                    />
                )
            case 'audio':
                // Audio clips should not be rendered visually in the player
                // They are handled by AudioContext for playback and by the export system for final video
                return null
            case 'image':
                return (
                    <img
                        src={mediaUrl!}
                        style={{
                            ...style,
                            objectFit: externalAsset?.originalData?.isSticker ? 'contain' : 'cover'
                        }}
                        onClick={handleClick}
                        draggable={false}
                        loading="lazy" // Add lazy loading
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
    }, [clip.type, clip.properties, mediaUrl, mediaScale, crop.width, handleClick])

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
                
                // Apply resize snap guides (Scenario 3)
                const resizeSnapped = calculateResizeSnapPosition(newLeft, newTop, newWidth, newHeight)
                updateSnapGuides(resizeSnapped.guides)
                
                newCrop.width = resizeSnapped.width
                newCrop.height = resizeSnapped.height
                newCrop.left = resizeSnapped.left
                newCrop.top = resizeSnapped.top
                
                setCrop(newCrop)
            } else if (isDraggingCrop) {
                const dx = e.clientX - dragStart.x
                const dy = e.clientY - dragStart.y
                const rawLeft = dragStart.left + dx
                const rawTop = dragStart.top + dy
                
                // Apply snap guides
                const snapped = calculateSnapPosition(rawLeft, rawTop, crop.width, crop.height)
                updateSnapGuides(snapped.guides)
                setCrop(crop => ({ ...crop, left: snapped.left, top: snapped.top }))
            }
        }
        const handleMouseUp = () => {
            setIsResizing(false)
            setResizeType(null)
            setIsDraggingCrop(false)
            // Clear snap guides when dragging ends
            updateSnapGuides({ vertical: [] as number[], horizontal: [] as number[], showGuides: false })
        }
        if (isResizing || isDraggingCrop) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, isDraggingCrop, resizeType, resizeStart, dragStart, crop, aspectRatio, clip.type, calculateSnapPosition, calculateResizeSnapPosition, updateSnapGuides])

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
    if (!isVisible) {
        return null
    }

    // Calculate transition effects
    const getTransitionStyles = () => {
        const styles: React.CSSProperties = {}
        
        // Handle transition in (clip fading in)
        if (clip.properties?.transitionIn) {
            const transition = clip.properties.transitionIn
            const transitionProgress = Math.max(0, Math.min(1, localMs / transition.duration))
            
            switch (transition.type) {
                case 'dissolve':
                case 'fade':
                    styles.opacity = transitionProgress
                    break
                case 'slide':
                    styles.transform = `translateX(${(1 - transitionProgress) * -100}%)`
                    break
                case 'zoom':
                    styles.transform = `scale(${0.5 + transitionProgress * 0.5})`
                    styles.opacity = transitionProgress
                    break
                case 'wipe':
                    styles.clipPath = `inset(0 ${(1 - transitionProgress) * 100}% 0 0)`
                    break
                case 'iris':
                    styles.clipPath = `circle(${transitionProgress * 150}% at center)`
                    break
            }
        }
        
        // Handle transition out (clip fading out)
        if (clip.properties?.transitionOut) {
            const transition = clip.properties.transitionOut
            const transitionStartMs = transition.startMs - clip.timelineStartMs
            const transitionProgress = localMs >= transitionStartMs 
                ? Math.max(0, Math.min(1, (localMs - transitionStartMs) / transition.duration))
                : 0
            
            switch (transition.type) {
                case 'dissolve':
                case 'fade':
                    styles.opacity = 1 - transitionProgress
                    break
                case 'slide':
                    styles.transform = `translateX(${transitionProgress * -100}%)`
                    break
                case 'zoom':
                    styles.transform = `scale(${1 - transitionProgress * 0.5})`
                    styles.opacity = 1 - transitionProgress
                    break
                case 'wipe':
                    styles.clipPath = `inset(0 0 0 ${transitionProgress * 100}%)`
                    break
                case 'iris':
                    styles.clipPath = `circle(${(1 - transitionProgress) * 150}% at center)`
                    break
            }
        }
        
        return styles
    }

    const transitionStyles = getTransitionStyles()

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {(isPrimarySelection || (isInMultiSelection && isMultiSelectionActive)) && (
                <div
                    className="absolute pointer-events-auto z-50"
                    style={{
                        left: crop.left + crop.width / 2,
                        top: Math.max(10, crop.top - 60), // Ensure menu stays at least 10px from top edge
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
                    overflow: 'visible', // Keep visible for UI controls (resize handles, selection rings)
                    position: 'absolute',
                    background: clip.type === 'text' ? 'rgba(0, 0, 0, 0)' : 'black',
                    ...transitionStyles // Apply transition effects
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