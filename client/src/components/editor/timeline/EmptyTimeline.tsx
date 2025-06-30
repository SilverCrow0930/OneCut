import React, { useState, useRef, useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useParams } from 'next/navigation'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { TrackType, ClipType } from '@/types/editor'

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

export default function EmptyTimeline() {
    const [isDragOver, setIsDragOver] = useState(false)
    const dragCounter = useRef(0)
    const params = useParams()
    const { executeCommand, tracks } = useEditor()
    const { assets } = useAssets()
    const projectId = params?.projectId as string

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
        dragCounter.current = 0

        const payload = JSON.parse(e.dataTransfer.getData('application/json'))

        // Handle external assets (from Pexels, etc)
        if (payload.type === 'external_asset') {
            const asset = payload.asset
            if (!asset) {
                console.error('No asset found in external payload')
                return
            }

            console.log('Handling external asset in EmptyTimeline:', asset)

            // Determine track type and duration
            let trackType: TrackType = 'video'
            let dur = 0

            if (payload.assetType === 'video') {
                trackType = 'video'
                dur = 10000 // 10 seconds default for videos
            } else if (payload.assetType === 'music' || payload.assetType === 'sound') {
                trackType = 'audio'
                dur = asset.duration ? Math.round(asset.duration * 1000) : 30000
            } else {
                trackType = 'video' // Images go on video tracks
                dur = 5000 // 5 seconds default for images
            }

            // Create external asset data
            const externalAsset = {
                id: `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                url: asset.video_files?.[0]?.link || asset.src?.original || asset.url,
                name: asset.title || asset.alt || 'External asset',
                mime_type: trackType === 'audio' ? 'audio/mpeg' : 'video/mp4',
                duration: dur,
                isExternal: true,
                originalData: asset
            }

            // Create track
            const newIndex = getNextAvailableIndex(tracks, trackType);

            // Shift tracks if needed
            shiftTracksForNewTrack(tracks, newIndex, executeCommand);

            const newTrack = {
                id: uuid(),
                projectId: projectId,
                index: newIndex,
                type: trackType,
                createdAt: new Date().toISOString(),
            }

            console.log('Creating track in EmptyTimeline:', newTrack)

            executeCommand({
                type: 'ADD_TRACK',
                payload: { track: newTrack }
            })

            // Create clip
            const newClip = {
                id: uuid(),
                trackId: newTrack.id,
                assetId: externalAsset.id,
                type: trackType,
                sourceStartMs: 0,
                sourceEndMs: dur,
                timelineStartMs: 0,
                timelineEndMs: dur,
                assetDurationMs: dur,
                volume: 1,
                speed: 1,
                properties: {
                    externalAsset
                },
                createdAt: new Date().toISOString(),
            }

            console.log('Creating external clip in EmptyTimeline:', newClip)

            executeCommand({
                type: 'ADD_CLIP',
                payload: { clip: newClip }
            })
            return
        }

        // Handle regular uploaded assets
        if (!payload.assetId) {
            console.log('No assetId found in EmptyTimeline payload')
            return
        }

        console.log('Looking for asset in EmptyTimeline:', payload.assetId)
        const asset = assets.find((a: any) => a.id === payload.assetId)
        if (!asset) {
            console.error('Asset not found in EmptyTimeline:', payload.assetId)
            return
        }

        console.log('Found asset in EmptyTimeline:', asset)

        // Create track
        const trackType: TrackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'
        const newIndex = getNextAvailableIndex(tracks, trackType);

        // Shift tracks if needed
        shiftTracksForNewTrack(tracks, newIndex, executeCommand);

        const newTrack = {
            id: uuid(),
            projectId: projectId,
            index: newIndex,
            type: trackType,
            createdAt: new Date().toISOString(),
        }

        console.log('Creating track in EmptyTimeline:', newTrack)

        executeCommand({
            type: 'ADD_TRACK',
            payload: { track: newTrack }
        })

        // Create clip in that track
        const dur = asset.duration ? Math.floor(asset.duration) : 0 // Duration is already in ms

        const newClip = {
            id: uuid(),
            trackId: newTrack.id,
            assetId: asset.id,
            type: trackType,
            sourceStartMs: 0,
            sourceEndMs: dur,
            timelineStartMs: 0,
            timelineEndMs: dur,
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

        console.log('Creating clip in EmptyTimeline:', newClip)

        executeCommand({
            type: 'ADD_CLIP',
            payload: { clip: newClip }
        })
    }, [executeCommand, assets, projectId, tracks])

    return (
        <div
            className="flex-1 flex items-center justify-center bg-gray-900 rounded-lg border-2 border-dashed border-gray-700 p-8"
            onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                dragCounter.current++
                if (dragCounter.current === 1) {
                    setIsDragOver(true)
                }
            }}
            onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                dragCounter.current--
                if (dragCounter.current === 0) {
                    setIsDragOver(false)
                }
            }}
            onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
            }}
            onDrop={handleDrop}
        >
            <div className={`text-center transition-opacity duration-200 ${isDragOver ? 'opacity-100' : 'opacity-50'}`}>
                <p className="text-gray-400 text-lg">
                    Drag and drop media here to start your project
                </p>
                <p className="text-gray-500 text-sm mt-2">
                    Or click the upload button above to browse files
                </p>
            </div>
        </div>
    )
}