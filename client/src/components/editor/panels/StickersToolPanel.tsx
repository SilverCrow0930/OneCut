import React, { useState, useEffect } from 'react'
import { Sticker } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { GiphySticker } from './types/stickers'

const StickersToolPanel = () => {
    const [stickers, setStickers] = useState<GiphySticker[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const { session } = useAuth()

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

    return (
        <div className="flex flex-col h-full bg-white rounded-lg">
            <div className="p-4">
                <PanelHeader icon={Sticker} title="Stickers" />
            </div>
            <div className="px-4">
                <input
                    type="text"
                    placeholder="Search stickers..."
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
                            const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
                                // Create a payload with sticker information
                                const dragData = {
                                    type: 'external_asset',
                                    assetType: 'image',
                                    asset: {
                                        id: sticker.id,
                                        title: sticker.title,
                                        url: sticker.images.original.url,
                                        width: sticker.images.original.width,
                                        height: sticker.images.original.height,
                                        isSticker: true
                                    }
                                };
                                
                                e.dataTransfer.setData(
                                    'application/json',
                                    JSON.stringify(dragData)
                                );
                                e.dataTransfer.effectAllowed = 'copy';
                                
                                // Set a drag image if needed
                                if (e.target instanceof HTMLElement) {
                                    e.dataTransfer.setDragImage(e.target, 0, 0);
                                }
                            };

                            return (
                                <div
                                    key={index}
                                    className="relative aspect-square rounded-lg overflow-hidden group shadow hover:shadow-lg transition-shadow cursor-grab active:cursor-grabbing"
                                    draggable={true}
                                    onDragStart={handleDragStart}
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
                            );
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
    );
}

export default StickersToolPanel