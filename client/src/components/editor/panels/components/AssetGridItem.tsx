import React, { useState } from 'react'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { formatTimeMs } from '@/lib/utils'
import { useAssets } from '@/contexts/AssetsContext'
import { useEditor } from '@/contexts/EditorContext'
import { Asset } from '@/types/assets'

interface AssetGridItemProps {
    asset: Asset | any // Can be either our Asset type or Pexels asset
    type: 'image' | 'video'
    onUploadAndHighlight?: (assetId: string) => void // optional callback for highlight
}

export default function AssetGridItem({ asset, type, onUploadAndHighlight }: AssetGridItemProps) {
    // Only use useAssetUrl for regular uploaded assets
    const isPexelsAsset = asset.src || asset.video_files
    const { url: uploadedUrl, loading } = useAssetUrl(isPexelsAsset ? undefined : asset.id)
    const { deleteAsset } = useAssets()
    const { setSelectedTool } = useEditor()
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

    // Click-to-upload logic
    const handleClick = async () => {
        if (!isPexelsAsset) return // Only for Pexels assets
        setIsUploading(true)
        setError(null)
        try {
            // Get the parent AssetsToolPanel component
            const assetsPanel = document.querySelector('[data-assets-panel]')
            if (!assetsPanel) throw new Error('Could not find AssetsToolPanel')
            // Call the download function
            const uploadedAsset = await (assetsPanel as any).handlePexelsAssetDownload(asset, type)
            // Switch to Upload panel
            setSelectedTool('Upload')
            // Optionally highlight the new asset
            if (onUploadAndHighlight) onUploadAndHighlight(uploadedAsset.id)
            // Optionally: show a toast or feedback
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsUploading(false)
        }
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
            className="relative w-full aspect-video rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition"
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={isPexelsAsset ? handleClick : undefined}
            tabIndex={0}
            role="button"
            aria-label="Upload asset"
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