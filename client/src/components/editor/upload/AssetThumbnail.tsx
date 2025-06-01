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
    highlight?: boolean
    uploading?: boolean
}

export default function AssetThumbnail({ asset, highlight, uploading }: AssetThumbnailProps) {
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
            <div className="relative w-24 h-24 bg-gray-200 animate-pulse rounded" />
        )
    }

    if (!url) {
        return (
            <div className="relative w-24 h-24 bg-red-100 text-red-500 flex items-center justify-center rounded">
                !
            </div>
        )
    }

    const isVideo = asset.mime_type.startsWith('video/')

    return (
        <>
            <DraggableAsset assetId={asset.id}>
                <div
                    className={`
                        relative w-24 h-24 rounded-lg overflow-hidden 
                        bg-black hover:opacity-80 transition-opacity duration-500
                        flex items-center justify-center
                        ${highlight ? 'ring-4 ring-blue-400 animate-pulse-fast' : ''}
                        ${uploading ? 'opacity-60 pointer-events-none' : ''}
                    `}
                    onContextMenu={handleContextMenu}
                >
                    {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                    )}
                    {
                        isVideo ? (
                            <video
                                src={url}
                                className="max-w-full max-h-full object-contain"
                                muted
                                loop
                            />
                        ) : (
                            <img
                                src={url}
                                className="max-w-full max-h-full object-contain"
                            />
                        )
                    }

                    {/* duration badge */}
                    {
                        asset.duration && (
                            <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-px rounded">
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
            <style jsx>{`
                @keyframes pulse-fast {
                    0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
                    70% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
                    100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
                }
                .animate-pulse-fast {
                    animation: pulse-fast 1s cubic-bezier(0.4, 0, 0.6, 1) 2;
                }
            `}</style>
        </>
    )
}