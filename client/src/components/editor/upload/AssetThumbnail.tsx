import React, { useEffect, useState, useRef } from 'react'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { useVideoThumbnail } from '@/hooks/useVideoThumbnail'
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
    const containerRef = useRef<HTMLDivElement>(null)

    const isVideo = asset.mime_type.startsWith('video/')
    
    // Use video thumbnail hook for videos
    const { thumbnailUrl, isGenerating } = useVideoThumbnail(asset.id, url ?? undefined, isVideo)

    // Get project ID
    const projectId = Array.isArray(params.projectId) 
        ? params.projectId[0] 
        : params.projectId

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowContextMenu(false)
            }
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setShowContextMenu(true)
    }

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        await deleteAsset(asset.id)
        setShowContextMenu(false)
    }

    const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        if (!url) {
            console.error('No URL available for download')
            return
        }

        // Always open in new tab to avoid replacing the current Lemona Studio tab
        window.open(url, '_blank')
        setShowContextMenu(false)
    }

    // Handle click to add asset to track
    const handleClick = (e: React.MouseEvent) => {
        if (showContextMenu) return // Don't add to track when context menu is open
        
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

    if (loading || (isVideo && isGenerating)) {
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

    return (
        <>
            <DraggableAsset assetId={asset.id}>
                <div
                    ref={containerRef}
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
                            // Use thumbnail for videos for faster loading
                            thumbnailUrl ? (
                                <img
                                    src={thumbnailUrl}
                                    className="w-full h-full object-cover rounded"
                                    alt={asset.name || 'Video thumbnail'}
                                />
                            ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded">
                                    <div className="text-xs text-gray-500">Loading...</div>
                                </div>
                            )
                        ) : (
                            <img
                                src={url}
                                className="w-full h-full object-cover rounded"
                                alt={asset.name || 'Asset'}
                            />
                        )
                    }

                    {/* Duration badge */}
                    {
                        asset.duration && (
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                {formatTimeMs(asset.duration)}
                            </div>
                        )
                    }

                    {/* Context Menu Overlay - Large buttons covering half the asset */}
                    {showContextMenu && (
                        <div className="absolute inset-0 bg-black/40 flex rounded-lg z-20">
                            {/* Download Button - Left Half */}
                            <button
                                className="flex-1 flex flex-col items-center justify-center bg-blue-600/90 hover:bg-blue-700/90 text-white transition-colors duration-200 border-r border-white/20"
                                onClick={handleDownload}
                            >
                                <Download size={32} className="mb-2" />
                                <span className="font-medium text-lg">Download</span>
                            </button>
                            
                            {/* Delete Button - Right Half */}
                            <button
                                className="flex-1 flex flex-col items-center justify-center bg-red-600/90 hover:bg-red-700/90 text-white transition-colors duration-200"
                                onClick={handleDelete}
                            >
                                <Trash2 size={32} className="mb-2" />
                                <span className="font-medium text-lg">Delete</span>
                            </button>
                        </div>
                    )}
                </div>
            </DraggableAsset>
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