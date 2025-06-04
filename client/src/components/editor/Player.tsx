import React, { useMemo, useState } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAssets } from '@/contexts/AssetsContext'
import { ClipLayer } from './ClipLayer'
import { Upload } from 'lucide-react'
import { apiPath } from '@/lib/config'
import { v4 as uuid } from 'uuid'
import type { Clip, TrackType } from '@/types/editor'

export function Player() {
    const { currentTime } = usePlayback()
    const { clips, tracks, setSelectedClipId, executeCommand } = useEditor()
    const { session } = useAuth()
    const { addAsset } = useAssets()
    const [isDragging, setIsDragging] = useState(false)
    const [uploading, setUploading] = useState(false)
    
    const currentTimeMs = currentTime * 1000

    // Performance optimization: Only render clips that are currently visible or about to be visible
    const visibleClips = useMemo(() => {
        const buffer = 2000 // 2 second buffer for smoother transitions
        const visibleClipList: Clip[] = []
        
        clips.forEach((clip: Clip) => {
            const isCurrentlyVisible = currentTimeMs >= clip.timelineStartMs && currentTimeMs <= clip.timelineEndMs
            const isNearby = Math.abs(currentTimeMs - clip.timelineStartMs) < buffer || 
                           Math.abs(currentTimeMs - clip.timelineEndMs) < buffer
            
            if (isCurrentlyVisible || isNearby) {
                visibleClipList.push(clip)
            }
        })

        // Sort clips by track index (lowest index on top)
        const sortedClips = visibleClipList.sort((a, b) => {
            const trackA = tracks.find(t => t.id === a.trackId)
            const trackB = tracks.find(t => t.id === b.trackId)
            return (trackA?.index ?? 0) - (trackB?.index ?? 0)
        })

        return sortedClips
    }, [clips, tracks, currentTimeMs])

    // Calculate source time for visible clips
    const clipsWithSourceTime = useMemo(() => {
        return visibleClips.map(clip => {
            const timelineOffset = currentTimeMs - clip.timelineStartMs
            const sourceTime = (clip.sourceStartMs + timelineOffset) / 1000 // Convert to seconds
            return { ...clip, sourceTime }
        })
    }, [visibleClips, currentTimeMs])

    // Determine track type based on media type
    const getTrackType = (mimeType: string): TrackType => {
        if (mimeType.startsWith('video/') || mimeType.startsWith('image/')) {
            return 'video'
        } else if (mimeType.startsWith('audio/')) {
            return 'audio'
        }
        return 'video' // Default fallback
    }

    // Upload file and create asset
    const uploadFile = async (file: File) => {
        if (!session?.access_token) {
            throw new Error('Not signed in')
        }

        try {
            // 1) Measure duration in ms for video/audio files
            let durationSeconds = 0
            if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
                const url = URL.createObjectURL(file)
                const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video')
                media.preload = 'metadata'
                media.src = url

                await new Promise<void>((resolve, reject) => {
                    media.onloadedmetadata = () => resolve()
                    media.onerror = () => reject(new Error('Could not load media metadata'))
                })

                durationSeconds = media.duration || 0
                URL.revokeObjectURL(url)
            } else if (file.type.startsWith('image/')) {
                // Images default to 5 seconds
                durationSeconds = 5
            }

            // 2) Build form data including duration
            const form = new FormData()
            form.append('file', file)
            form.append('duration', String(durationSeconds))

            // 3) Upload to server
            const response = await fetch(apiPath('assets/upload'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: form,
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Upload failed ${response.status}: ${text}`)
            }

            const uploadedAsset = await response.json()
            return uploadedAsset
        } catch (err: any) {
            console.error('Asset upload error:', err)
            throw err
        }
    }

    // Add media to timeline
    const addMediaToTimeline = async (asset: any) => {
        const trackType = getTrackType(asset.mime_type)
        
        // Find existing track of the same type or create new one
        let targetTrack = tracks.find(track => track.type === trackType)
        
        if (!targetTrack) {
            // Create new track
            targetTrack = {
                id: uuid(),
                projectId: '', // Will be set by the editor context
                index: tracks.length,
                type: trackType,
                createdAt: new Date().toISOString(),
            }
        }

        // Calculate clip timing
        const startTime = currentTimeMs // Start at current playhead position
        const durationMs = (asset.duration || 5) * 1000 // Convert seconds to milliseconds
        const endTime = startTime + durationMs

        // Create new clip
        const newClip = {
            id: uuid(),
            trackId: targetTrack.id,
            type: trackType,
            assetId: asset.id,
            sourceStartMs: 0,
            sourceEndMs: durationMs,
            timelineStartMs: startTime,
            timelineEndMs: endTime,
            assetDurationMs: durationMs,
            volume: trackType === 'audio' ? 1 : 0, // Audio clips have volume, video clips don't
            speed: 1,
            properties: { 
                name: asset.name,
                ...(trackType === 'video' && {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                    rotation: 0,
                    opacity: 1,
                })
            },
            createdAt: new Date().toISOString(),
        }

        const commands: any[] = []

        // Add track if it's new
        if (!tracks.find(t => t.id === targetTrack.id)) {
            commands.push({
                type: 'ADD_TRACK',
                payload: { track: targetTrack }
            })
        }

        // Add clip
        commands.push({
            type: 'ADD_CLIP',
            payload: { clip: newClip }
        })

        // Execute commands
        executeCommand({
            type: 'BATCH',
            payload: { commands }
        })

        // Add asset to assets context
        addAsset(asset)
    }

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Only set dragging to false if we're leaving the player area completely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        setUploading(true)

        try {
            // Process files one by one
            for (const file of files) {
                console.log(`📁 Processing dropped file: ${file.name}`)
                
                // Upload file
                const asset = await uploadFile(file)
                console.log(`✅ File uploaded:`, asset)
                
                // Add to timeline
                await addMediaToTimeline(asset)
                console.log(`🎬 Added to timeline: ${asset.name}`)
            }
        } catch (error: any) {
            console.error('❌ Failed to process dropped files:', error)
            // You could add toast notification here
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex items-center justify-center h-full p-4">
            <div
                className={`relative bg-black shadow-2xl ring-1 ring-gray-200/20 transition-all duration-200 ${
                    isDragging ? 'ring-4 ring-blue-400 scale-[1.02]' : ''
                }`}
                style={{
                    aspectRatio: '9 / 16',
                    height: '100%',
                    maxHeight: '100%',
                    width: 'auto'
                }}
                onClick={() => {
                    setSelectedClipId(null)
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
                
                {/* Drag overlay */}
                {isDragging && (
                    <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white/90 rounded-xl p-6 shadow-lg flex flex-col items-center gap-3">
                            <Upload className="w-8 h-8 text-blue-600" />
                            <p className="text-lg font-semibold text-gray-800">Drop media here</p>
                            <p className="text-sm text-gray-600 text-center">
                                Files will be added to the timeline<br />at the current position
                            </p>
                        </div>
                    </div>
                )}

                {/* Upload overlay */}
                {uploading && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
                        <div className="bg-white/90 rounded-xl p-6 shadow-lg flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-lg font-semibold text-gray-800">Processing...</p>
                            <p className="text-sm text-gray-600">Adding media to timeline</p>
                        </div>
                    </div>
                )}
                
                {/* Render active clips in order with their source times */}
                {clipsWithSourceTime.map(clip => (
                    <ClipLayer
                        key={clip.id}
                        clip={clip}
                        sourceTime={clip.sourceTime}
                    />
                ))}
            </div>
        </div>
    )
}