import React, { useEffect, useState } from 'react'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { formatTimeMs } from '@/lib/utils'
import DraggableAsset from './DraggableAsset'
import { useAssets } from '@/contexts/AssetsContext'
import { useEditor } from '@/contexts/EditorContext'
import { useParams } from 'next/navigation'
import { addAssetToTrack } from '@/lib/editor/utils'
import { Download, Trash2 } from 'lucide-react'

interface AssetThumbnailProps {
    asset: {
        id: string
        name?: string
        mime_type: string
        duration: number | null  // in milliseconds
    }
    highlight?: boolean
    uploading?: boolean
    style?: React.CSSProperties // Add style prop for masonry positioning
}

export default function AssetThumbnail({ asset, highlight, uploading, style }: AssetThumbnailProps) {
    const { url, loading } = useAssetUrl(asset.id)
    const { deleteAsset } = useAssets()
    const { tracks, executeCommand, clips } = useEditor()
    const params = useParams()
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

    // Get project ID
    const projectId = Array.isArray(params.projectId) 
        ? params.projectId[0] 
        : params.projectId

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

    const handleDownload = async () => {
        if (!url) {
            console.error('No URL available for download')
            return
        }

        try {
            // Try to download directly first
            const link = document.createElement('a')
            link.href = url
            
            // Set filename - use asset name if available, otherwise generate from mime type
            const extension = asset.mime_type.split('/')[1] || 'file'
            const filename = asset.name || `asset_${asset.id}.${extension}`
            link.download = filename
            
            // Set CORS mode to try to download directly
            link.setAttribute('crossorigin', 'anonymous')
            
            // Trigger download
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
        } catch (error) {
            console.warn('Direct download failed, opening in new tab:', error)
            // Fallback: open in new tab for user to save manually
            window.open(url, '_blank')
        }
        
        setShowContextMenu(false)
    }

    // Handle click to add asset to track
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        if (!projectId) {
            console.error('No project ID available')
            return
        }
        
        console.log('Adding asset to track via click:', asset)
        
        // Add the asset to a track at the end of the timeline
        addAssetToTrack(asset, tracks, clips, executeCommand, projectId, {
            isExternal: false
        })
    }

    if (loading) {
        return (
            <div 
                className="relative bg-gray-200 animate-pulse rounded-lg" 
                style={{ ...style, minHeight: '120px' }}
            />
        )
    }

    if (!url) {
        return (
            <div 
                className="relative bg-red-100 text-red-500 flex items-center justify-center rounded-lg"
                style={{ ...style, minHeight: '120px' }}
            >
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
                        relative rounded-lg overflow-hidden 
                        bg-gray-50 hover:opacity-80 transition-all duration-200
                        shadow-sm hover:shadow-md
                        cursor-pointer
                        ${highlight ? 'ring-4 ring-blue-400 animate-pulse-fast' : ''}
                        ${uploading ? 'opacity-60 pointer-events-none' : ''}
                    `}
                    style={style}
                    onContextMenu={handleContextMenu}
                    onClick={handleClick}
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
                                className="w-full h-full object-cover rounded"
                                muted
                                loop
                            />
                        ) : (
                            <img
                                src={url}
                                className="w-full h-full object-cover rounded"
                            />
                        )
                    }

                    {/* duration badge */}
                    {
                        asset.duration && (
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                {formatTimeMs(asset.duration)}
                            </div>
                        )
                    }
                </div>
            </DraggableAsset>
            {
                showContextMenu && (
                    <div
                        className="fixed bg-white shadow-lg rounded-lg py-1 z-50 border border-gray-200 min-w-[140px]"
                        style={{
                            left: contextMenuPosition.x,
                            top: contextMenuPosition.y,
                            zIndex: 9999
                        }}
                    >
                        <button
                            className="w-full px-4 py-2 text-left text-blue-600 hover:bg-blue-50 flex items-center gap-2 text-sm"
                            onClick={handleDownload}
                        >
                            <Download size={16} />
                            Download
                        </button>
                        <hr className="border-gray-100 my-1" />
                        <button
                            className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
                            onClick={handleDelete}
                        >
                            <Trash2 size={16} />
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