import React, { useState } from 'react'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { formatTimeMs } from '@/lib/utils'
import { useAssets } from '@/contexts/AssetsContext'
import { useEditor } from '@/contexts/EditorContext'
import { useParams } from 'next/navigation'
import { addAssetToTrack } from '@/lib/editor/utils'
import { Asset } from '@/types/assets'
import { Play, Pause, Music, Volume2 } from 'lucide-react'

interface AssetGridItemProps {
    asset: Asset | any // Can be either our Asset type, Pexels asset, or Freesound asset
    type: 'image' | 'video' | 'music' | 'sound'
    onUploadAndHighlight?: (assetId: string, uploading?: boolean) => void // callback for highlight/progress
}

export default function AssetGridItem({ asset, type, onUploadAndHighlight }: AssetGridItemProps) {
    // Only use useAssetUrl for regular uploaded assets
    const isPexelsAsset = asset.src || asset.video_files
    const isFreesoundAsset = asset.previews || (type === 'music' || type === 'sound')
    const isExternalAsset = isPexelsAsset || isFreesoundAsset
    const { url: uploadedUrl, loading } = useAssetUrl(isExternalAsset ? undefined : asset.id)
    const { deleteAsset } = useAssets()
    const { tracks, executeCommand, clips } = useEditor()
    const params = useParams()
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

    // Get project ID
    const projectId = Array.isArray(params.projectId) 
        ? params.projectId[0] 
        : params.projectId

    // Get the appropriate URL based on asset type
    const getAssetUrl = () => {
        if (isPexelsAsset) {
            // Pexels asset
            if (type === 'image') {
                return asset.src?.original || asset.src?.large2x || asset.src?.large
            } else {
                return asset.video_files?.[0]?.link || asset.url
            }
        } else if (isFreesoundAsset) {
            // Freesound asset
            return asset.previews?.['preview-hq-mp3'] || asset.previews?.['preview-lq-mp3'] || asset.url
        }
        // Regular uploaded asset
        return uploadedUrl
    }

    // Get the poster for Pexels videos
    const getVideoPoster = () => {
        if (isPexelsAsset && type === 'video') {
            return asset.image || undefined
        }
        return undefined
    }

    // Get the duration in ms for display
    const getDuration = () => {
        if (type === 'video') {
            if (isPexelsAsset) {
                // Pexels duration is in seconds
                return asset.duration ? asset.duration * 1000 : 0
            } else {
                return asset.duration || 0
            }
        } else if (type === 'music' || type === 'sound') {
            // Freesound duration is in seconds
            return asset.duration ? asset.duration * 1000 : 0
        }
        return 0
    }

    // Audio preview controls
    const handleAudioPreview = async (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent the main click handler
        
        if (!isFreesoundAsset) return
        
        const url = getAssetUrl()
        if (!url) return

        if (isPlaying && audioElement) {
            audioElement.pause()
            setIsPlaying(false)
        } else {
            if (audioElement) {
                audioElement.pause()
            }
            
            const audio = new Audio(url)
            audio.addEventListener('ended', () => setIsPlaying(false))
            audio.addEventListener('error', () => setIsPlaying(false))
            
            try {
                await audio.play()
                setAudioElement(audio)
                setIsPlaying(true)
            } catch (err) {
                console.error('Audio preview failed:', err)
                setIsPlaying(false)
            }
        }
    }

    // Click-to-add logic
    const handleClick = async () => {
        if (!projectId) {
            console.error('No project ID available')
            return
        }

        if (isExternalAsset) {
            // For external assets (Pexels or Freesound), add them directly to track
            setIsUploading(true)
            setError(null)
            if (onUploadAndHighlight) onUploadAndHighlight(asset.id, true)
            
            try {
                console.log('Adding external asset to track via click:', asset)
                
                // Add the external asset directly to a track
                addAssetToTrack(asset, tracks, clips, executeCommand, projectId, {
                    isExternal: true,
                    assetType: type
                })
                
                if (onUploadAndHighlight) onUploadAndHighlight(asset.id, false)
            } catch (err: any) {
                setError(err.message)
                if (onUploadAndHighlight) onUploadAndHighlight('', false)
            } finally {
                setIsUploading(false)
            }
        } else {
            // For regular uploaded assets, add them directly to track
            console.log('Adding uploaded asset to track via click:', asset)
            
            addAssetToTrack(asset, tracks, clips, executeCommand, projectId, {
                isExternal: false
            })
        }
    }

    // Drag and drop logic
    const handleDragStart = (e: React.DragEvent) => {
        if (isExternalAsset) {
            // For external assets, set a custom drag type and show spinner overlay
            e.dataTransfer.setData(
                'application/json',
                JSON.stringify({ 
                    ...(isPexelsAsset ? { pexelsAsset: asset } : { freesoundAsset: asset }), 
                    type 
                })
            )
            e.dataTransfer.effectAllowed = 'copy'
            if (e.target instanceof HTMLElement) {
                e.dataTransfer.setDragImage(e.target, 0, 0)
            }
            setIsUploading(true)
        } else {
            // Regular asset, use normal drag behavior
            e.dataTransfer.setData(
                'application/json',
                JSON.stringify({ assetId: asset.id })
            )
            e.dataTransfer.effectAllowed = 'copy'
            if (e.target instanceof HTMLElement) {
                e.dataTransfer.setDragImage(e.target, 0, 0)
            }
        }
    }

    // Listen for drag end to remove spinner overlay
    const handleDragEnd = async (e: React.DragEvent) => {
        if (isExternalAsset) {
            setIsUploading(false)
        }
    }

    if (loading || isUploading) {
        return (
            <div className="relative w-full h-40 bg-gray-200 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="relative w-full h-40 bg-red-100 text-red-500 flex items-center justify-center rounded-lg">
                {error}
            </div>
        )
    }

    const url = getAssetUrl()
    if (!url) {
        return (
            <div className="relative w-full h-40 bg-red-100 text-red-500 flex items-center justify-center rounded-lg">
                !
            </div>
        )
    }

    const isVideo = type === 'video'
    const isAudio = type === 'music' || type === 'sound'
    const durationMs = getDuration()
    const poster = getVideoPoster()

    return (
        <div
            className="relative w-full h-40 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition bg-gray-100 flex items-center justify-center shadow-sm hover:shadow-md"
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={handleClick}
            tabIndex={0}
            role="button"
            aria-label="Add asset to timeline"
        >
            {isVideo ? (
                <video
                    src={url}
                    className="max-w-full max-h-full object-contain rounded"
                    muted
                    playsInline
                    poster={poster}
                />
            ) : isAudio ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-purple-50">
                    <div className="flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-md mb-3">
                        {type === 'music' ? (
                            <Music size={24} className="text-blue-600" />
                        ) : (
                            <Volume2 size={24} className="text-purple-600" />
                        )}
                    </div>
                    <div className="text-center mb-3">
                        <h4 className="text-sm font-medium text-gray-800 truncate max-w-full">
                            {asset.name || `${type} asset`}
                        </h4>
                        {asset.tags && asset.tags.length > 0 && (
                            <p className="text-xs text-gray-500 truncate">
                                {asset.tags.slice(0, 2).join(', ')}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleAudioPreview}
                        className="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-md hover:shadow-lg transition-shadow"
                        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                    >
                        {isPlaying ? (
                            <Pause size={16} className="text-gray-700" />
                        ) : (
                            <Play size={16} className="text-gray-700 ml-0.5" />
                        )}
                    </button>
                </div>
            ) : (
                <img
                    src={url}
                    alt={asset.alt || 'Asset'}
                    className="max-w-full max-h-full object-contain rounded"
                />
            )}
            {(isVideo || isAudio) && durationMs > 0 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {formatTimeMs(durationMs)}
                </div>
            )}
        </div>
    )
} 