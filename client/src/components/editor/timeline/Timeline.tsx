import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import TrackRow from './TrackRow'
import { getTimeScale } from '@/lib/constants'
import { TrackType } from '@/types/editor'
import Ruler from './Ruler'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useZoom } from '@/contexts/ZoomContext'
import Playhead from './Playhead'
import TimelineLoading from './TimelineLoading'
import PerformanceMonitor from './PerformanceMonitor'
import { TIMELINE_CONFIG, timelineHelpers } from '@/lib/timeline-config'

// Track index ranges
const TRACK_RANGES = {
    text: { start: 1, end: 4 },
    stickers: { start: 5, end: 8 },
    video: { start: 9, end: 14 },
    caption: { start: 15, end: 17 },
    audio: { start: 18, end: 22 }
};

function getNextAvailableIndex(tracks: any[], type: string): number {
    // Get the range for this track type
    const range = TRACK_RANGES[type as keyof typeof TRACK_RANGES];
    if (!range) return tracks.length; // Fallback

    // Get all tracks of this type
    const typeTracks = tracks.filter(t => t.type === type)
        .map(t => t.index)
        .sort((a, b) => a - b);

    // Find the first available index in the range
    for (let i = range.start; i <= range.end; i++) {
        if (!typeTracks.includes(i)) {
            return i;
        }
    }

    // If no index is available in the range, use the last possible index
    return range.end;
}

function shiftTracksForNewTrack(tracks: any[], newIndex: number, executeCommand: any) {
    // Get all tracks that need to be shifted (tracks with index >= newIndex)
    const tracksToShift = tracks.filter(t => t.index >= newIndex)
        .sort((a, b) => b.index - a.index); // Sort in descending order to avoid conflicts

    // Shift each track up by 1
    for (const track of tracksToShift) {
        executeCommand({
            type: 'UPDATE_TRACK',
            payload: {
                before: track,
                after: { ...track, index: track.index + 1 }
            }
        });
    }
}

export default function Timeline() {
    const params = useParams()
    const { zoomLevel } = useZoom()
    const timeScale = getTimeScale(zoomLevel)
    const dragCounterRef = useRef(0)

    // 1) Guard: if there's no projectId, bail out or show an error
    if (!params.projectId) {
        return (
            <p className="text-red-500 p-4">
                Error: missing project ID in URL
            </p>
        )
    }

    // 2) Normalize to a single string
    const projectId = Array.isArray(params.projectId)
        ? params.projectId[0]
        : params.projectId

    const { tracks, clips, loadingTimeline, timelineError, executeCommand, setSelectedClipId, selectedClipId } = useEditor()
    const { currentTime, setDuration, isPlaying, setCurrentTime } = usePlayback()
    const currentTimeMs = currentTime * 1000

    const { assets } = useAssets()

    const containerRef = useRef<HTMLDivElement>(null)
    const scrollAnimationRef = useRef<number | undefined>(undefined)

    // drag‐state for the whole timeline
    const [isDragOver, setIsDragOver] = useState(false)

    // group clips by track
    const clipsByTrack = useMemo(() => {
        const map = new Map<string, typeof clips>()
        tracks.forEach(t => map.set(t.id, []))
        clips.forEach(c => map.get(c.trackId!)?.push(c))
        return map
    }, [tracks, clips])

    // Create display tracks: actual tracks + one empty track for new content
    // Show all tracks but limit container height to 4 tracks with vertical scrolling
    const [allTracksWithEmpty, needsVerticalScroll] = useMemo(() => {
        const tracksInUse = tracks.filter(track => {
            const trackClips = clipsByTrack.get(track.id) ?? []
            return trackClips.length > 0
        }).sort((a, b) => a.index - b.index)
        
        // Always include an empty track at the end
        const maxIndex = tracksInUse.length > 0 ? Math.max(...tracksInUse.map(t => t.index)) : -1
        const emptyTrack = {
            id: `empty-track-${maxIndex + 1}`,
            projectId: projectId!,
            index: maxIndex + 1,
            type: 'video' as TrackType,
            createdAt: new Date().toISOString(),
            isEmpty: true
        }
        
        const allTracksArray = [...tracksInUse, emptyTrack]
        const needsScroll = allTracksArray.length > 4
        
        return [allTracksArray, needsScroll]
    }, [tracks, clipsByTrack, projectId])

    const displayTracks = allTracksWithEmpty

    // compute overall width
    const maxMs = clips.reduce((mx, c) => Math.max(mx, c.timelineEndMs), 0)
    
    // Dynamic padding based on content - smaller for short content, reasonable for longer content
    const basePadding = Math.max(1000, maxMs * 0.1) // 10% padding or 1 second minimum
    const paddingMs = Math.min(basePadding, 5000) // Cap padding at 5 seconds
    const paddedMaxMs = maxMs + paddingMs
    const totalContentPx = Math.ceil(paddedMaxMs * timeScale)

    // NEW: Ensure timeline fills the container
    const [containerWidth, setContainerWidth] = useState(0)
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth)
            }
        }
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])
    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth)
        }
    }, [tracks.length])
    
    // Fixed timeline approach: Keep timeline container at fixed width, let tracks handle their own scrolling
    const timelineContainerWidth = Math.max(
        totalContentPx, // Scale with actual content and zoom
        2000 // Fixed minimum width for longer default track length
    )

    const playheadX = currentTimeMs * timeScale

    // Center on playhead when zoom changes
    useEffect(() => {
        const element = containerRef.current
        if (!element) return

        // Don't center if we're resizing a clip
        const isResizingClip = document.body.classList.contains('cursor-ew-resize')
        if (isResizingClip) return

        const half = element.clientWidth / 2
        const target = playheadX - half
        element.scrollLeft = target
    }, [zoomLevel, playheadX])

    // Update duration when clips change
    useEffect(() => {
        if (tracks.length === 0 || clips.length === 0) {
            setDuration(0)
            setCurrentTime(0) // Always reset to 0:00 when no content
        } else {
            setDuration(maxMs)
            // Ensure playhead stays within bounds - both min and max
            if (currentTimeMs < 0) {
                setCurrentTime(0) // Don't allow going before 0:00
            } else if (currentTimeMs > maxMs) {
                setCurrentTime(maxMs / 1000)
            }
        }
    }, [maxMs, setDuration, setCurrentTime, tracks.length, clips.length, currentTimeMs])

    // Force playhead to start at 0:00 on component mount
    useEffect(() => {
        if (currentTimeMs !== 0 && (tracks.length === 0 || clips.length === 0)) {
            setCurrentTime(0)
        }
    }, [tracks.length, clips.length, currentTimeMs, setCurrentTime])

    // Optimized smooth scrolling animation with throttling
    const throttledScrollUpdate = useCallback(
        timelineHelpers.throttle((targetScroll: number) => {
            const element = containerRef.current
            if (!element) return
            
            const currentScroll = element.scrollLeft
            const diff = targetScroll - currentScroll
            
            // Use smoother interpolation for better UX
            if (Math.abs(diff) > 1) {
                element.scrollLeft = currentScroll + (diff * 0.15)
            }
        }, TIMELINE_CONFIG.PERFORMANCE.RENDER_THROTTLE),
        []
    )

    useEffect(() => {
        if (!isPlaying) return
        
        const element = containerRef.current
        if (!element) return

        const animate = () => {
            if (isPlaying) {
                const half = element.clientWidth / 2
                const target = playheadX - half
                throttledScrollUpdate(target)
            }
            scrollAnimationRef.current = requestAnimationFrame(animate)
        }

        scrollAnimationRef.current = requestAnimationFrame(animate)

        return () => {
            if (scrollAnimationRef.current) {
                cancelAnimationFrame(scrollAnimationRef.current)
            }
        }
    }, [playheadX, isPlaying, throttledScrollUpdate])

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current++
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current--
        if (dragCounterRef.current === 0) {
            setIsDragOver(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current = 0
        setIsDragOver(false)

        if (!containerRef.current) return

        // 1) parse payload
        let payload: { assetId?: string, type?: string, assetType?: string, asset?: any }
        try {
            payload = JSON.parse(e.dataTransfer.getData('application/json'))
            console.log('Drop payload:', payload)
        } catch (error) {
            console.error('Failed to parse drop data:', error)
            return
        }

        // Handle external assets (Pexels/stickers)
        if (payload.type === 'external_asset') {
            console.log('Handling external asset:', payload)

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

            console.log('Extracted media URL:', mediaUrl)

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

            console.log('Created external asset:', externalAsset)

            // 2) compute time position
            const rect = containerRef.current.getBoundingClientRect()
            const x = e.clientX - rect.left
            
            // Grid snap to every 500ms for better precision
            const gridSnapMs = 500
            let startMs = Math.round(x / timeScale / gridSnapMs) * gridSnapMs
            
            // Snap to 00:00 if we're very close to the beginning (within 250ms)
            if (startMs < 250) {
                startMs = 0
            } else {
                startMs = Math.max(0, startMs)
            }

            // 3) compute new track index from Y position
            const y = e.clientY - rect.top
            const rowHeight = containerRef.current.firstElementChild?.clientHeight ?? 68
            const rawIndex = Math.floor(y / rowHeight)
            const newIndex = Math.max(0, Math.min(tracks.length, rawIndex))

            console.log('Creating external track at index:', newIndex, 'time:', startMs)

            // 4) CREATE TRACK
            const trackType: TrackType = payload.assetType === 'video' ? 'video' : 'video' // Images also go on video tracks

            const newTrack = {
                id: uuid(),
                projectId: projectId!,
                index: newIndex,
                type: trackType,
                createdAt: new Date().toISOString(),
            }

            console.log('Creating external track:', newTrack)

            executeCommand({
                type: 'ADD_TRACK',
                payload: { track: newTrack }
            })

            // 5) CREATE CLIP in that track
            const dur = externalAsset.duration

            // Calculate the maximum allowed start time to fit the clip
            const maxStartMs = Math.max(0, paddedMaxMs - dur)
            const adjustedStartMs = Math.min(startMs, maxStartMs)

            const newClip = {
                id: uuid(),
                trackId: newTrack.id,
                assetId: externalAsset.id,
                type: (payload.asset.isSticker ? 'image' : trackType) as 'image' | 'video' | 'audio', // Use 'image' for stickers specifically
                sourceStartMs: 0,
                sourceEndMs: dur,
                timelineStartMs: adjustedStartMs,
                timelineEndMs: adjustedStartMs + dur,
                assetDurationMs: dur,
                volume: 1,
                speed: 1,
                properties: {
                    externalAsset: externalAsset // Store external asset data in properties
                },
                createdAt: new Date().toISOString(),
            }

            console.log('Creating external clip:', newClip)

            executeCommand({
                type: 'ADD_CLIP',
                payload: { clip: newClip }
            })
            return
        }

        // Handle regular uploaded assets
        if (!payload.assetId) {
            console.log('No assetId found in payload')
            return
        }

        console.log('Looking for asset with ID:', payload.assetId)
        console.log('Available assets:', assets.map(a => ({ id: a.id, name: a.name })))

        const asset = assets.find(a => a.id === payload.assetId)
        if (!asset) {
            console.error('Asset not found:', payload.assetId)
            return
        }

        console.log('Found asset:', asset)

        // 2) compute time position
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        
        // Grid snap to every 500ms for better precision
        const gridSnapMs = 500
        let startMs = Math.round(x / timeScale / gridSnapMs) * gridSnapMs
        
        // Snap to 00:00 if we're very close to the beginning (within 250ms)
        if (startMs < 250) {
            startMs = 0
        } else {
            startMs = Math.max(0, startMs)
        }

        // 3) compute new track index from Y position
        const y = e.clientY - rect.top
        const rowHeight = containerRef.current.firstElementChild?.clientHeight ?? 68
        const rawIndex = Math.floor(y / rowHeight)
        const trackType: TrackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'

        // For audio tracks, always place at the bottom, for others place at the top
        let newIndex = trackType === 'audio' ? tracks.length : 0;

        // For non-audio tracks, shift all tracks down
        if (trackType !== 'audio') {
            for (const track of tracks) {
                executeCommand({
                    type: 'UPDATE_TRACK',
                    payload: { 
                        before: track,
                        after: { ...track, index: track.index + 1 }
                    }
                });
            }
        }

        const newTrack = {
            id: uuid(),
            projectId: projectId!,
            index: newIndex,
            type: trackType,
            createdAt: new Date().toISOString(),
        }

        console.log('Creating track:', newTrack)

        executeCommand({
            type: 'ADD_TRACK',
            payload: { track: newTrack }
        })

        // 5) CREATE CLIP in that track
        const dur = asset.duration ? Math.floor(asset.duration) : 0 // Duration is already in ms

        // Calculate the maximum allowed start time to fit the clip
        const maxStartMs = Math.max(0, paddedMaxMs - dur)
        const adjustedStartMs = Math.min(startMs, maxStartMs)

        const newClip = {
            id: uuid(),
            trackId: newTrack.id,
            assetId: asset.id,
            type: trackType,
            sourceStartMs: 0,
            sourceEndMs: dur,
            timelineStartMs: adjustedStartMs,
            timelineEndMs: adjustedStartMs + dur,
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

        console.log('Creating clip:', newClip)

        executeCommand({
            type: 'ADD_CLIP',
            payload: { clip: newClip }
        })
    }, [tracks, clips, projectId, executeCommand, assets])

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (!containerRef.current) return;

        // Get the target element
        const target = e.target as HTMLElement;

        // If the click is on a clip or its children, don't handle it
        if (target.closest('[data-clip-layer]')) return;

        // If the click is on the ruler or playhead, don't handle it
        if (target.closest('.ruler') || target.closest('.playhead')) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + containerRef.current.scrollLeft;
        const newTimeMs = Math.max(0, Math.min(Math.round(x / timeScale), paddedMaxMs)); // Constrain between 0 and max
        setCurrentTime(newTimeMs / 1000);
        setSelectedClipId(null);
    };

    const handlePlayheadDrag = (e: React.MouseEvent) => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left + containerRef.current.scrollLeft
        const newTimeMs = Math.max(0, Math.min(Math.round(x / timeScale), paddedMaxMs)) // Strict bounds: 0 <= time <= paddedMaxMs
        setCurrentTime(newTimeMs / 1000)

        // Auto-scroll when dragging near the edges
        const scrollThreshold = 100 // pixels from edge to trigger scroll
        const scrollSpeed = 10 // pixels per frame
        const mouseX = e.clientX - rect.left

        if (mouseX < scrollThreshold) {
            // Scroll left
            containerRef.current.scrollLeft -= scrollSpeed
        } else if (mouseX > rect.width - scrollThreshold) {
            // Scroll right
            containerRef.current.scrollLeft += scrollSpeed
        }
    }

    // Determine if we need scrollbars based on content
    const hasActualContent = clips.length > 0 || tracks.length > 0
    const needsHorizontalScroll = hasActualContent && (totalContentPx > containerWidth)

    if (loadingTimeline) {
        return <TimelineLoading />
    }

    if (timelineError) {
        return (
            <p className="p-4 text-red-500">
                Error: {timelineError}
            </p>
        )
    }

    return (
        <div
            ref={containerRef}
            className={`
                w-full
                timeline-container
                ${isDragOver ?
                    'border-2 border-cyan-400 bg-cyan-50/50' :
                    'border border-transparent bg-white'}
            `}
            style={{
                // Prevent container from growing beyond its bounds
                maxWidth: '100%',
                overflowX: needsHorizontalScroll ? 'auto' : 'hidden',
                overflowY: 'hidden' // Never scroll vertically on main container - tracks handle their own scrolling
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={onDrop}
            onClick={handleTimelineClick}
        >
            <div
                className="relative flex flex-col gap-3 bg-gradient-to-b from-gray-50/30 to-transparent rounded-lg"
                style={{
                    width: timelineContainerWidth,
                    padding: '8px 8px 8px 0', // Remove left padding to align with ruler
                }}
            >
                <Ruler
                    totalMs={timelineContainerWidth / timeScale}
                    timeScale={timeScale}
                />
                <Playhead
                    playheadX={playheadX}
                    onDrag={handlePlayheadDrag}
                    isPlaying={isPlaying}
                />
                <div 
                    className="flex flex-col gap-3 overflow-y-auto elegant-scrollbar"
                    style={{
                        height: `${displayTracks.length * 60}px`, // Exact height: 48px track + 12px gap = 60px per track
                        maxHeight: '240px', // Still keep a max height to enable scrolling when there are too many tracks
                        minHeight: 0, // Allow flex item to shrink
                    }}
                >
                    {
                        displayTracks.map(t => (
                            <TrackRow
                                key={t.id}
                                track={t}
                                clips={clipsByTrack.get(t.id) ?? []}
                                timelineSetIsDragOver={setIsDragOver}
                                onClipSelect={setSelectedClipId}
                                selectedClipId={selectedClipId}
                            />
                        ))
                    }
                </div>
            </div>
            
            {/* Performance Monitor - Enable in development */}
            <PerformanceMonitor 
                enabled={process.env.NODE_ENV === 'development'} 
                position="bottom-right" 
            />
        </div>
    )
}
