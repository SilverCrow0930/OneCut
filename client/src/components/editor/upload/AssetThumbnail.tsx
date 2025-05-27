import React, { useEffect, useState } from 'react'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { formatTimeMs } from '@/lib/utils'
import DraggableAsset from './DraggableAsset'
import { useAssets } from '@/contexts/AssetsContext'

interface AssetThumbnailProps {
    asset: {
        id: string
        mime_type: string
        duration: number | null  // in milliseconds
    }
}

export default function AssetThumbnail({ asset }: AssetThumbnailProps) {
    const { url, loading } = useAssetUrl(asset.id)
    const { deleteAsset } = useAssets()
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenuPosition({ x: e.clientX, y: e.clientY })
        setShowContextMenu(true)
    }

    const handleDelete = async () => {
        await deleteAsset(asset.id)
        setShowContextMenu(false)
    }

    if (loading) {
        return (
            <div className="relative w-24 aspect-video bg-gray-200 animate-pulse rounded" />
        )
    }

    if (!url) {
        return (
            <div className="relative w-24 aspect-video bg-red-100 text-red-500 flex items-center justify-center rounded">
                !
            </div>
        )
    }

    const isVideo = asset.mime_type.startsWith('video/')

    return (
        <>
            <DraggableAsset assetId={asset.id}>
                <div
                    className="
                        relative w-full aspect-video rounded-lg overflow-hidden 
                        bg-black hover:opacity-80 transition-opacity duration-500
                    "
                    onContextMenu={handleContextMenu}
                >
                    {
                        isVideo ? (
                            <video
                                src={url}
                                className="object-cover w-full h-full"
                                muted
                                loop
                            />
                        ) : (
                            <img
                                src={url}
                                className="object-cover w-full h-full"
                            />
                        )
                    }

                    {/* duration badge */}
                    {
                        asset.duration && (
                            <div className="
                                absolute bottom-1 right-1
                                bg-black bg-opacity-60
                                text-white text-xs
                                px-1 py-px rounded
                            ">
                                {formatTimeMs(asset.duration)}
                            </div>
                        )
                    }
                </div>
            </DraggableAsset>
            {
                showContextMenu && (
                    <div
                        className="fixed bg-white shadow-lg rounded-lg py-1 z-50 hover:bg-gray-100"
                        style={{
                            left: contextMenuPosition.x,
                            top: contextMenuPosition.y,
                            zIndex: 9999
                        }}
                    >
                        <button
                            className="w-full px-4 py-2 text-left text-red-600"
                            onClick={handleDelete}
                        >
                            Delete Asset
                        </button>
                    </div>
                )
            }
        </>
    )
}