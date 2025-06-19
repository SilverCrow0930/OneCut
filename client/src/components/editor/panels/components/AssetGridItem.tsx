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
        const loadingHeight = (type === 'music' || type === 'sound') ? 'h-20' : 'h-40'
        return (
            <div className={`relative w-full ${loadingHeight} bg-gray-200 rounded-lg flex items-center justify-center`}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    if (error) {
        const errorHeight = (type === 'music' || type === 'sound') ? 'h-20' : 'h-40'
        return (
            <div className={`relative w-full ${errorHeight} bg-red-100 text-red-500 flex items-center justify-center rounded-lg`}>
                {error}
            </div>
        )
    }

    const url = getAssetUrl()
    if (!url) {
        const errorHeight = (type === 'music' || type === 'sound') ? 'h-20' : 'h-40'
        return (
            <div className={`relative w-full ${errorHeight} bg-red-100 text-red-500 flex items-center justify-center rounded-lg`}>
                !
            </div>
        )
    }

    const isVideo = type === 'video'
    const isAudio = type === 'music' || type === 'sound'
    const durationMs = getDuration()
    const poster = getVideoPoster()

    // Use different container classes for audio vs other assets
    const containerClasses = isAudio 
        ? "relative w-full h-20 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition bg-white border border-gray-200 shadow-sm hover:shadow-md"
        : "relative w-full h-40 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition bg-gray-100 flex items-center justify-center shadow-sm hover:shadow-md"

    return (
        <div
            className={containerClasses}
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
                <div className="w-full h-full flex items-center p-3 bg-gradient-to-r from-gray-50 to-white">
                    {/* Icon Section */}
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-lg shadow-sm mr-3"
                         style={{
                             background: type === 'music' 
                                 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                 : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                         }}>
                        {type === 'music' ? (
                            <Music size={20} className="text-white" />
                        ) : (
                            <Volume2 size={20} className="text-white" />
                        )}
                    </div>
                    
                    {/* Content Section */}
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate mb-1">
                                {asset.name || `${type} asset`}
                            </h4>
                            <div className="flex items-center text-xs text-gray-500">
                                {asset.tags && asset.tags.length > 0 && (
                                    <span className="truncate mr-2">
                                        {asset.tags.slice(0, 2).join(', ')}
                                    </span>
                                )}
                                {durationMs > 0 && (
                                    <span className="text-gray-400">
                                        {formatTimeMs(durationMs)}
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* Play Button */}
                        <button
                            onClick={handleAudioPreview}
                            className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-white rounded-full shadow-sm hover:shadow-md transition-all hover:scale-105 border border-gray-200"
                            aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                        >
                            {isPlaying ? (
                                <Pause size={14} className="text-gray-700" />
                            ) : (
                                <Play size={14} className="text-gray-700 ml-0.5" />
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <img
                    src={url}
                    alt={asset.alt || 'Asset'}
                    className="max-w-full max-h-full object-contain rounded"
                />
            )}
            {isVideo && durationMs > 0 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {formatTimeMs(durationMs)}
                </div>
            )}
        </div>
    )
} 