import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { useTimelineSettings } from '@/contexts/TimelineSettingsContext'
import TrackRow from './TrackRow'
import { getTimeScale } from '@/lib/constants'
import { TrackType } from '@/types/editor'
import Ruler from './Ruler'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useZoom } from '@/contexts/ZoomContext'
import Playhead from './Playhead'
import TimelineLoading from './TimelineLoading'
import TimelineToolbar from './TimelineToolbar'
import EnhancedClipItem from './EnhancedClipItem'
import ClipItem from './ClipItem'
import { ClipType } from '@/types/editor'

export default function Timeline() {
    const params = useParams()
    const { zoomLevel } = useZoom()
    const { settings: timelineSettings } = useTimelineSettings()
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
    const [useEnhancedClips, setUseEnhancedClips] = useState(true) // Toggle for enhanced clips

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
        containerWidth || 1000 // Minimum width
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

    // Smooth scrolling animation
    useEffect(() => {
        const element = containerRef.current
        if (!element) {
            if (scrollAnimationRef.current) {
                cancelAnimationFrame(scrollAnimationRef.current)
                scrollAnimationRef.current = undefined
            }
            return
        }

        const animate = () => {
            if (isPlaying) {
                const half = element.clientWidth / 2
                const target = playheadX - half
                const currentScroll = element.scrollLeft
                const diff = target - currentScroll

                // Smoothly interpolate the scroll position
                if (Math.abs(diff) > 1) {
                    element.scrollLeft = currentScroll + (diff * 0.1)
                }
            }

            scrollAnimationRef.current = requestAnimationFrame(animate)
        }

        scrollAnimationRef.current = requestAnimationFrame(animate)

        return () => {
            if (scrollAnimationRef.current) {
                cancelAnimationFrame(scrollAnimationRef.current)
            }
        }
    }, [playheadX, isPlaying])

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

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounterRef.current = 0
        setIsDragOver(false)

        try {
            const data = e.dataTransfer.getData('application/json')
            if (!data) return

            const parsed = JSON.parse(data)
            
            // Handle asset drops from library
            if (parsed.type === 'asset' && parsed.assetId) {
                const asset = assets.find(a => a.id === parsed.assetId)
                if (!asset) return

                // Calculate drop position
                const rect = containerRef.current?.getBoundingClientRect()
                if (!rect) return

                const x = e.clientX - rect.left
                const timeMs = Math.round(x / timeScale)

                // Find or create appropriate track
                let targetTrack = tracks.find(t => {
                    if (asset.mime_type.startsWith('video/')) return t.type === 'video'
                    if (asset.mime_type.startsWith('audio/')) return t.type === 'audio'
                    if (asset.mime_type.startsWith('image/')) return t.type === 'video' // Images go on video tracks
                    return false
                })

                if (!targetTrack) {
                    // Create new track
                    const trackType = asset.mime_type.startsWith('video/') ? 'video' :
                                    asset.mime_type.startsWith('audio/') ? 'audio' : 'video' // Images go on video tracks
                    
                    const newTrack = {
                        id: uuid(),
                        projectId: projectId!,
                        index: tracks.length,
                        type: trackType as TrackType,
                        createdAt: new Date().toISOString()
                    }

                    executeCommand({
                        type: 'ADD_TRACK',
                        payload: { track: newTrack }
                    })

                    targetTrack = newTrack
                }

                // Create clip
                const clipDuration = asset.duration ? asset.duration * 1000 : 5000 // 5 seconds default for images
                const clipType: ClipType = asset.mime_type.startsWith('video/') ? 'video' :
                                         asset.mime_type.startsWith('audio/') ? 'audio' : 'image'
                
                const newClip = {
                    id: uuid(),
                    trackId: targetTrack.id,
                    assetId: asset.id,
                    type: clipType,
                    timelineStartMs: timeMs,
                    timelineEndMs: timeMs + clipDuration,
                    sourceStartMs: 0,
                    sourceEndMs: clipDuration,
                    assetDurationMs: clipDuration,
                    volume: 1,
                    speed: 1,
                    createdAt: new Date().toISOString()
                }

                executeCommand({
                    type: 'ADD_CLIP',
                    payload: { clip: newClip }
                })
            }
        } catch (error) {
            console.error('Failed to handle drop:', error)
        }
    }

    const handleTimelineClick = (e: React.MouseEvent) => {
        // Only handle clicks on the timeline background, not on clips
        if ((e.target as HTMLElement).closest('[data-timeline-clip]')) {
            return
        }

        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return

        const x = e.clientX - rect.left + (containerRef.current?.scrollLeft || 0)
        const timeMs = Math.round(x / timeScale)
        const timeSeconds = timeMs / 1000

        setCurrentTime(timeSeconds)
        setSelectedClipId(null)
    }

    const handlePlayheadDrag = (e: React.MouseEvent) => {
        const startX = e.clientX
        const startTime = currentTime

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startX
            const deltaTimeMs = deltaX / timeScale
            const newTime = Math.max(0, startTime + deltaTimeMs / 1000)
            setCurrentTime(newTime)
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    if (loadingTimeline) {
        return <TimelineLoading />
    }

    if (timelineError) {
        return (
            <div className="p-4 text-red-500">
                Error loading timeline: {timelineError}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-gray-100">
            {/* Enhanced Timeline Toolbar */}
            <TimelineToolbar />
            
            {/* Debug Toggle (remove in production) */}
            <div className="px-4 py-1 bg-yellow-50 border-b border-yellow-200 text-xs">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={useEnhancedClips}
                        onChange={(e) => setUseEnhancedClips(e.target.checked)}
                        className="rounded"
                    />
                    <span>Use Enhanced Clips (with magnetic snapping & gap closure)</span>
                </label>
            </div>

            {/* Timeline Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200">
                <Ruler 
                    totalMs={paddedMaxMs}
                    timeScale={timeScale}
                />
            </div>

            {/* Timeline Content */}
            <div className="flex-1 relative overflow-hidden">
                <div
                    ref={containerRef}
                    className={`timeline-container h-full overflow-x-auto overflow-y-auto ${
                        isDragOver ? 'bg-blue-50' : 'bg-gray-50'
                    }`}
                    style={{
                        maxHeight: needsVerticalScroll ? '320px' : 'auto' // 4 tracks * 80px
                    }}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={onDrop}
                    onClick={handleTimelineClick}
                >
                    <div
                        className="relative"
                        style={{
                            width: `${timelineContainerWidth}px`,
                            minHeight: `${displayTracks.length * 80}px`
                        }}
                    >
                        {/* Track Rows */}
                        {displayTracks.map((track, index) => (
                            <TrackRow
                                key={track.id}
                                track={track}
                                clips={clipsByTrack.get(track.id) || []}
                                timelineSetIsDragOver={setIsDragOver}
                                onClipSelect={setSelectedClipId}
                                selectedClipId={selectedClipId}
                            />
                        ))}

                        {/* Playhead */}
                        <Playhead
                            playheadX={playheadX}
                            onDrag={handlePlayheadDrag}
                            isPlaying={isPlaying}
                        />

                        {/* Drop indicator */}
                        {isDragOver && (
                            <div className="absolute inset-0 border-2 border-dashed border-blue-400 bg-blue-50 bg-opacity-50 pointer-events-none rounded-lg flex items-center justify-center">
                                <div className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium">
                                    Drop assets here to add to timeline
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
