import React, { useState } from 'react'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { formatTimeMs } from '@/lib/utils'
import DraggableAsset from '../../upload/DraggableAsset'
import { useAssets } from '@/contexts/AssetsContext'
import { Asset } from '@/types/assets'

interface AssetGridItemProps {
    asset: Asset | any // Can be either our Asset type or Pexels asset
    type: 'image' | 'video'
}

export default function AssetGridItem({ asset, type }: AssetGridItemProps) {
    const { url, loading } = useAssetUrl(asset.id)
    const { deleteAsset } = useAssets()
    const [isDownloading, setIsDownloading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleDragStart = async (e: React.DragEvent) => {
        // If it's a Pexels asset (has src or video_files property)
        if (asset.src || asset.video_files) {
            e.preventDefault() // Prevent default drag start
            setIsDownloading(true)
            setError(null)

            try {
                // Get the parent AssetsToolPanel component
                const assetsPanel = document.querySelector('[data-assets-panel]')
                if (!assetsPanel) {
                    throw new Error('Could not find AssetsToolPanel')
                }

                // Call the download function
                const uploadedAsset = await (assetsPanel as any).handlePexelsAssetDownload(asset, type)

                // Now set the drag data with the uploaded asset ID
                e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({ assetId: uploadedAsset.id })
                )
                e.dataTransfer.effectAllowed = 'copy'

                // Set a drag image if needed
                if (e.target instanceof HTMLElement) {
                    e.dataTransfer.setDragImage(e.target, 0, 0)
                }
            } catch (err: any) {
                console.error('Failed to download/upload asset:', err)
                setError(err.message)
            } finally {
                setIsDownloading(false)
            }
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

    if (loading || isDownloading) {
        return (
            <div className="relative w-full aspect-video bg-gray-200 animate-pulse rounded" />
        )
    }

    if (error) {
        return (
            <div className="relative w-full aspect-video bg-red-100 text-red-500 flex items-center justify-center rounded">
                {error}
            </div>
        )
    }

    if (!url) {
        return (
            <div className="relative w-full aspect-video bg-red-100 text-red-500 flex items-center justify-center rounded">
                !
            </div>
        )
    }

    const isVideo = type === 'video'

    return (
        <DraggableAsset assetId={asset.id}>
            <div
                className="relative w-full aspect-video rounded overflow-hidden cursor-grab active:cursor-grabbing"
                onDragStart={handleDragStart}
            >
                {isVideo ? (
                    <video
                        src={url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                    />
                ) : (
                    <img
                        src={url}
                        alt={asset.alt || 'Asset'}
                        className="w-full h-full object-cover"
                    />
                )}
                {isVideo && asset.duration && (
                    <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                        {formatTimeMs(asset.duration)}
                    </div>
                )}
            </div>
        </DraggableAsset>
    )
} 