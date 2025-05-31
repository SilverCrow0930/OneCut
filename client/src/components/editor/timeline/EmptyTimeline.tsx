import React, { useState, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { useParams } from 'next/navigation'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { TrackType } from '@/types/editor'

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

        // Handle external assets (Pexels/stickers) - simplified for now
        if (payload.type === 'external_asset') {
            console.log('External asset detected on empty timeline, but not implemented yet:', payload)
            alert('External assets (Pexels/Stickers) are not yet supported. Please upload media files using the Upload panel.')
            return
        }

        // Handle regular uploaded assets
        if (!payload.assetId) {
            console.log('No assetId found in EmptyTimeline payload')
            return
        }
        
        console.log('Looking for asset in EmptyTimeline:', payload.assetId)
        const asset = assets.find(a => a.id === payload.assetId)
        if (!asset) {
            console.error('Asset not found in EmptyTimeline:', payload.assetId)
            return
        }

        console.log('Found asset in EmptyTimeline:', asset)

        // 2) CREATE TRACK
        const trackType: TrackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'
        const newTrack = {
            id: uuid(),
            projectId: projectId!,
            index: 0,
            type: trackType,
            createdAt: new Date().toISOString(),
        }

        console.log('Creating track in EmptyTimeline:', newTrack)

        executeCommand({
            type: 'ADD_TRACK',
            payload: {
                track: newTrack
            }
        })

        // 3) CREATE CLIP in that track
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
            properties: {},
            createdAt: new Date().toISOString(),
        }

        console.log('Creating clip in EmptyTimeline:', newClip)

        executeCommand({
            type: 'ADD_CLIP',
            payload: {
                clip: newClip
            }
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
                    `}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                </svg>
            </div>
            <h3 className={`text-xl font-medium mb-2 transition-colors duration-500 ${isDragOver ? 'text-cyan-600' : ''}`}>
                Your timeline is empty
            </h3>
           
            <div className={`
                flex items-center gap-2 text-sm
                transition-colors duration-500
                ${isDragOver ? 'text-cyan-400' : 'text-gray-400'}
            `}>
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                </svg>
                <span>Drag media here to get started</span>
            </div>
        </div>
    )
}