import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import EmptyTimeline from './EmptyTimeline'

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

    const { tracks, clips, loadingTimeline, timelineError, executeCommand, setSelectedClipId, selectedTrackId, setSelectedTrackId } = useEditor()
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

    // compute overall width
    const maxMs = clips.reduce((mx, c) => Math.max(mx, c.timelineEndMs), 0)
    const targetMsAtMinZoom = 150000 // 2.5 minutes in ms
    const paddingMs = Math.max(1000, Math.ceil(targetMsAtMinZoom * (0.1 / zoomLevel)))
    const paddedMaxMs = maxMs + paddingMs
    const totalPx = Math.ceil(paddedMaxMs * timeScale)

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
        if (tracks.length === 0) {
            setDuration(0)
            setCurrentTime(0)
        } else {
            setDuration(maxMs)
            // Ensure playhead stays within bounds
            if (currentTimeMs > maxMs) {
                setCurrentTime(maxMs / 1000)
            }
        }
    }, [maxMs, setDuration, setCurrentTime, tracks.length, currentTime])

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

        if (!containerRef.current) return

        // 1) parse assetId
        let payload: { assetId: string }
        try {
            payload = JSON.parse(e.dataTransfer.getData('application/json'))
        } catch {
            return
        }

        const asset = assets.find(a => a.id === payload.assetId)
        if (!asset) return

        // 2) compute time position
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const startMs = Math.max(0, Math.round(x / timeScale))

        // 3) compute new track index from Y position
        const y = e.clientY - rect.top
        const rowHeight = containerRef.current.firstElementChild?.clientHeight ?? 68
        const rawIndex = Math.floor(y / rowHeight)
        const newIndex = Math.max(0, Math.min(tracks.length, rawIndex))

        // 4) CREATE TRACK
        const trackType: TrackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'

        const newTrack = {
            id: uuid(),
            projectId: projectId!,
            index: newIndex,
            type: trackType,
            createdAt: new Date().toISOString(),
        }

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
            properties: {},
            createdAt: new Date().toISOString(),
        }

        executeCommand({
            type: 'ADD_CLIP',
            payload: { clip: newClip }
        })
    }

    const handleTimelineClick = (e: React.MouseEvent) => {
        if (isPlaying || !containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left + containerRef.current.scrollLeft
        const newTimeMs = Math.max(0, Math.round(x / timeScale))
        setCurrentTime(newTimeMs / 1000)
    }

    const handlePlayheadDrag = (e: React.MouseEvent) => {
        if (isPlaying || !containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left + containerRef.current.scrollLeft
        const newTimeMs = Math.min(paddedMaxMs, Math.max(0, Math.round(x / timeScale)))
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

    if (loadingTimeline) {
        return (
            <p className="p-4">
                Loading timeline ...
            </p>
        )
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
                w-full h-full overflow-auto
                transition-colors duration-500
                ${isDragOver ? 'border-2 border-cyan-400 bg-cyan-50/50' : 'border border-transparent bg-white'}
            `}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={onDrop}
            onClick={handleTimelineClick}
        >
            {tracks.length === 0 ? (
                <EmptyTimeline />
            ) : (
                <div
                    className="relative flex flex-col w-full gap-2"
                    style={{
                        width: totalPx + 1,
                        minHeight: '100%',
                        height: 'max-content'
                    }}
                >
                    <Ruler
                        totalMs={paddedMaxMs}
                        timeScale={timeScale}
                    />
                    <Playhead
                        playheadX={playheadX}
                        onDrag={handlePlayheadDrag}
                        isPlaying={isPlaying}
                    />
                    <div className="flex flex-col overflow-y-scroll gap-2">
                        {
                            tracks.map(t => (
                                <TrackRow
                                    key={t.id}
                                    track={t}
                                    clips={clipsByTrack.get(t.id) ?? []}
                                    timelineSetIsDragOver={setIsDragOver}
                                    isSelected={t.id === selectedTrackId}
                                    onClick={() => setSelectedTrackId(t.id)}
                                />
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    )
}
