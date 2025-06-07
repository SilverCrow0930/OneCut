import React, { useState, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { useParams } from 'next/navigation'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { TrackType, ClipType } from '@/types/editor'
import { DEFAULT_MEDIA_DURATIONS } from '@/lib/constants'

export default function EmptyTimeline() {
    const [isDragOver, setIsDragOver] = useState(false)
    const dragCounter = useRef(0)
    const params = useParams()
    const { executeCommand } = useEditor()
    const { assets } = useAssets()

    // Normalize projectId to a single string
    const projectId = Array.isArray(params.projectId)
        ? params.projectId[0]
        : params.projectId

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current++
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current--
        if (dragCounter.current === 0) {
            setIsDragOver(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current = 0
        setIsDragOver(false)

        // 1) parse payload
        let payload: { assetId?: string, type?: string, assetType?: string, asset?: any }
        try {
            payload = JSON.parse(e.dataTransfer.getData('application/json'))
            console.log('EmptyTimeline drop payload:', payload)
        }
        catch (error) {
            console.error('EmptyTimeline failed to parse drop data:', error)
            return
        }

        // Handle external assets (Pexels/stickers)
        if (payload.type === 'external_asset') {
            console.log('Handling external asset in EmptyTimeline:', payload)

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
            } else if (payload.assetType === 'audio') {
                // Audio file
                mediaUrl = payload.asset.url
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
                          payload.assetType === 'audio' ? 'audio/mp3' :
                          (payload.asset.isSticker || mediaUrl.includes('.gif')) ? 'image/gif' : 'image/jpeg',
                duration: payload.assetType === 'video' ? DEFAULT_MEDIA_DURATIONS.VIDEO : 
                         payload.assetType === 'audio' ? DEFAULT_MEDIA_DURATIONS.AUDIO :
                         (payload.asset.isSticker || mediaUrl.includes('.gif')) ? DEFAULT_MEDIA_DURATIONS.GIF : DEFAULT_MEDIA_DURATIONS.IMAGE,
                isExternal: true,
                originalData: payload.asset
            }

            console.log('Created external asset:', externalAsset)

            // 2) CREATE TRACK
            const trackType: TrackType = payload.assetType === 'audio' ? 'audio' : 'video'
            const newTrack = {
                id: uuid(),
                projectId: projectId!,
                index: 0,
                type: trackType,
                createdAt: new Date().toISOString(),
            }

            console.log('Creating track:', newTrack)

            executeCommand({
                type: 'ADD_TRACK',
                payload: { track: newTrack }
            })

            // 3) CREATE CLIP in that track
            const dur = externalAsset.duration || DEFAULT_MEDIA_DURATIONS.IMAGE // Fallback to image duration if none specified
            const clipType: ClipType = payload.assetType === 'audio' ? 'audio' :
                                      payload.assetType === 'video' ? 'video' : 'image'
            const newClip = {
                id: uuid(),
                trackId: newTrack.id,
                assetId: externalAsset.id,
                type: clipType,
                sourceStartMs: 0,
                sourceEndMs: dur,
                timelineStartMs: 0,
                timelineEndMs: dur,
                assetDurationMs: dur,
                volume: 1,
                speed: 1,
                properties: payload.assetType === 'image' ? {
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
                } : {
                    externalAsset: externalAsset
                },
                createdAt: new Date().toISOString(),
            }

            console.log('Creating clip:', newClip)

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

        console.log('Looking for asset:', payload.assetId)
        const asset = assets.find(a => a.id === payload.assetId)
        if (!asset) {
            console.error('Asset not found:', payload.assetId)
            return
        }

        console.log('Found asset:', asset)

        // 2) CREATE TRACK
        const trackType: TrackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'
        const newTrack = {
            id: uuid(),
            projectId: projectId!,
            index: 0,
            type: trackType,
            createdAt: new Date().toISOString(),
        }

        console.log('Creating track:', newTrack)

        executeCommand({
            type: 'ADD_TRACK',
            payload: { track: newTrack }
        })

        // 3) CREATE CLIP in that track
        const dur = asset.duration ? Math.floor(asset.duration) : DEFAULT_MEDIA_DURATIONS.IMAGE // Fallback to image duration if none specified
        const clipType: ClipType = asset.mime_type.startsWith('audio/') ? 'audio' :
                                  asset.mime_type.startsWith('video/') ? 'video' : 'image'
        const newClip = {
            id: uuid(),
            trackId: newTrack.id,
            assetId: asset.id,
            type: clipType,
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

        console.log('Creating clip:', newClip)

        executeCommand({
            type: 'ADD_CLIP',
            payload: { clip: newClip }
        })
    }

    return (
        <div
            className={`
                w-full h-full flex flex-col items-center justify-center text-gray-500
                transition-all duration-500
                ${isDragOver ?
                    'bg-cyan-50/50' :
                    ''}
            `}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className={`
                mb-4 p-2 rounded-2xl
                transition-all duration-500
                ${isDragOver ?
                    'bg-white shadow-lg scale-105' :
                    ''}
            `}>
                <svg
                    className={`
                        w-16 h-16 transition-colors duration-500 
                        ${isDragOver ?
                            'text-cyan-400' :
                            ''}
                    `