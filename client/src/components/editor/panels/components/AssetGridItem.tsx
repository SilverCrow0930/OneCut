import React, { useState } from 'react'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { formatTimeMs } from '@/lib/utils'
import { useAssets } from '@/contexts/AssetsContext'
import { Asset } from '@/types/assets'

interface AssetGridItemProps {
    asset: Asset | any // Can be either our Asset type or Pexels asset
    type: 'image' | 'video'
}

export default function AssetGridItem({ asset, type }: AssetGridItemProps) {
    // Only use useAssetUrl for regular uploaded assets
    const isPexelsAsset = asset.src || asset.video_files
    const { url: uploadedUrl, loading } = useAssetUrl(isPexelsAsset ? undefined : asset.id)
    const { deleteAsset } = useAssets()
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Get the appropriate URL based on asset type
    const getAssetUrl = () => {
        if (isPexelsAsset) {
            // Pexels asset
            if (type === 'image') {
                return asset.src?.original || asset.src?.large2x || asset.src?.large
            } else {
                return asset.video_files?.[0]?.link || asset.url
            }
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
        }
        return 0
    }

    // Drag and drop logic
    const handleDragStart = (e: React.DragEvent) => {
        if (isPexelsAsset) {
            // For Pexels, set a custom drag type and show spinner overlay
            e.dataTransfer.setData(
                'application/json',
                JSON.stringify({ pexelsAsset: asset, type })
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
        if (isPexelsAsset) {
            setIsUploading(false)
        }
    }

    if (loading || isUploading) {
        return (
            <div className="relative w-full aspect-video bg-gray-200 rounded flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="relative w-full aspect-video bg-red-100 text-red-500 flex items-center justify-center rounded">
                {error}
            </div>
        )
    }

    const url = getAssetUrl()
    if (!url) {
        return (
            <div className="relative w-full aspect-video bg-red-100 text-red-500 flex items-center justify-center rounded">
                !
            </div>
        )
    }

    const isVideo = type === 'video'
    const durationMs = getDuration()
    const poster = getVideoPoster()

    return (
        <div
            className="relative w-full aspect-video rounded overflow-hidden cursor-grab active:cursor-grabbing"
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {isVideo ? (
                <video
                    src={url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    poster={poster}
                />
            ) : (
                <img
                    src={url}
                    alt={asset.alt || 'Asset'}
                    className="w-full h-full object-cover"
                />
            )}
            {isVideo && durationMs > 0 && (
                <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                    {formatTimeMs(durationMs)}
                </div>
            )}
        </div>
    )
} 