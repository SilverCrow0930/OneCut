import React, { useState, useEffect } from 'react'
import { Sticker } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { GiphySticker } from './types/stickers'
import { useAssets } from '@/contexts/AssetsContext'
import { useEditor } from '@/contexts/EditorContext'
import { useParams } from 'next/navigation'
import { addAssetToTrack } from '@/lib/editor/utils'

const StickersToolPanel = () => {
    const [stickers, setStickers] = useState<GiphySticker[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const { session } = useAuth()
    const { refresh } = useAssets()
    const { tracks, executeCommand, clips } = useEditor()
    const params = useParams()

    // Get project ID
    const projectId = Array.isArray(params.projectId) 
        ? params.projectId[0] 
        : params.projectId

    useEffect(() => {
        setStickers([])
        setPage(1)
    }, [searchQuery])

    useEffect(() => {
        if (!session?.access_token) {
            console.log('No access token available')
            return
        }

        setLoading(true)
        setError(null)

        const queryParams = new URLSearchParams({
            page: page.toString(),
            ...(searchQuery && { q: searchQuery }),
        })

        const url = apiPath(`assets/giphy/stickers?${queryParams}`)
        console.log('Fetching stickers from:', url)

        fetch(url, {
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
            .then(async res => {
                if (!res.ok) {
                    const errorText = await res.text()
                    throw new Error(`API error: ${res.status} ${res.statusText} - ${errorText}`)
                }
                return res.json()
            })
            .then(data => {
                console.log('Received stickers data:', data)
                if (!data.data) {
                    throw new Error('Invalid response format: missing data field')
                }
                setStickers(prev => prev.concat(data.data))
            })
            .catch(err => {
                console.error('Error fetching stickers:', err)
                setError(err.message || 'Failed to fetch stickers')
            })
            .finally(() => setLoading(false))
    }, [searchQuery, page, session?.access_token])

    const handleLoadMore = () => setPage(p => p + 1)

    // Function to download and upload sticker
    const handleStickerDownload = async (sticker: GiphySticker) => {
        if (!session?.access_token) {
            throw new Error('Not signed in')
        }

        try {
            // 1. Get the sticker URL
            const mediaUrl = sticker.images.original.url
            if (!mediaUrl) {
                throw new Error('Could not find sticker URL')
            }

            // 2. Download the sticker
            const response = await fetch(mediaUrl)
            if (!response.ok) {
                throw new Error('Failed to download sticker')
            }

            // 3. Get the file blob and create a File object
            const blob = await response.blob()
            const file = new File([blob], `${sticker.id}.gif`, {
                type: 'image/gif'
            })

            // 4. Upload to our server
            const form = new FormData()
            form.append('file', file)
            form.append('duration', '3') // 3 seconds for GIFs (server expects seconds, not ms)

            const uploadResponse = await fetch(apiPath('assets/upload'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: form,
            })

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload sticker')
            }

            const uploadedAsset = await uploadResponse.json()
            refresh() // Refresh the assets list
            return uploadedAsset
        } catch (err) {
            console.error('Sticker download/upload error:', err)
            throw err
        }
    }

    // Expose the function to the window object
    React.useEffect(() => {
        const panel = document.querySelector('[data-stickers-panel]')
        if (panel) {
            (panel as any).handleStickerDownload = handleStickerDownload
        }
        return () => {
            if (panel) {
                delete (panel as any).handleStickerDownload
            }
        }
    }, [session?.access_token]) // Re-expose when session changes

    return (
        <div className="flex flex-col h-full bg-white rounded-lg" data-stickers-panel>
            <div className="p-4">
                <PanelHeader icon={Sticker} title="Stickers" />
            </div>
            <div className="px-4">
                <input
                    type="text"
                    placeholder="Search stickers"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
            <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                {
                    loading && stickers.length === 0 && (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        </div>
                    )
                }
                {
                    error && (
                        <div className="text-red-500 text-center py-4">{error}</div>
                    )
                }
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {
                        stickers.map((sticker, index) => {
                            const handleDragStart = async (e: React.DragEvent<HTMLElement>) => {
                                e.preventDefault()
                                e.stopPropagation()

                                try {
                                    // Download and upload the sticker
                                    const uploadedAsset = await handleStickerDownload(sticker)

                                    // Create a payload with the uploaded asset ID and external asset info
                                    const dragData = {
                                        type: 'external_asset',
                                        assetType: 'image',
                                        asset: {
                                            ...sticker,
                                            isSticker: true
                                        }
                                    }

                                    e.dataTransfer.setData(
                                        'application/json',
                                        JSON.stringify(dragData)
                                    )
                                    e.dataTransfer.effectAllowed = 'copy'

                                    // Set a drag image if needed
                                    if (e.target instanceof HTMLElement) {
                                        e.dataTransfer.setDragImage(e.target, 0, 0)
                                    }
                                } catch (err) {
                                    console.error('Failed to handle sticker drag:', err)
                                    e.preventDefault()
                                }
                            }

                            // Handle click to add sticker to track
                            const handleClick = async (e: React.MouseEvent) => {
                                e.preventDefault()
                                e.stopPropagation()
                                
                                if (!projectId) {
                                    console.error('No project ID available')
                                    return
                                }
                                
                                console.log('Adding sticker to track via click:', sticker)
                                
                                // Format the sticker object properly with isSticker flag
                                const stickerAsset = {
                                    ...sticker,
                                    isSticker: true
                                }
                                
                                // Add the sticker directly to a track as external asset
                                addAssetToTrack(stickerAsset, tracks, clips, executeCommand, projectId, {
                                    isExternal: true,
                                    assetType: 'image'
                                })
                            }

                            return (
                                <div
                                    key={index}
                                    className="relative aspect-square rounded-lg overflow-hidden group shadow hover:shadow-lg transition-shadow cursor-pointer hover:ring-2 hover:ring-blue-400"
                                    draggable={true}
                                    onDragStart={handleDragStart}
                                    onClick={handleClick}
                                >
                                    <img
                                        src={sticker.images.fixed_height.url}
                                        alt={sticker.title}
                                        className="w-full h-full object-contain transition-transform group-hover:scale-105 pointer-events-none"
                                    />
                                    {sticker.user && (
                                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-white text-xs truncate">
                                                By{' '}
                                                <a
                                                    href={sticker.user.profile_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="underline"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    {sticker.user.display_name}
                                                </a>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    }
                </div>
                {
                    stickers.length > 0 && !loading && (
                        <button
                            onClick={handleLoadMore}
                            className="w-full mt-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            Load More
                        </button>
                    )
                }
            </div>
        </div>
    )
}

export default StickersToolPanel