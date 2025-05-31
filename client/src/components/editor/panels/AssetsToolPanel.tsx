import React, { useState, useEffect } from 'react'
import { Image, Search } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Asset } from './types/assets'
import { ASSET_TABS } from './constants/assets'
import AssetGridItem from './components/AssetGridItem'
import { useAssets } from '@/contexts/AssetsContext'
import { useEditor } from '@/contexts/EditorContext'

interface AssetsToolPanelProps {
    setHighlightedAssetId?: (id: string | null) => void
    setUploadingAssetId?: (id: string | null) => void
}

const AssetsToolPanel: React.FC<AssetsToolPanelProps> = ({ setHighlightedAssetId, setUploadingAssetId }) => {
    const [selectedTab, setSelectedTab] = useState<'image' | 'video'>('video')
    const [assets, setAssets] = useState<Asset[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const { session } = useAuth()
    const { refresh } = useAssets()
    const { selectedTool } = useEditor()

    useEffect(() => {
        setAssets([])
        setPage(1)
    }, [selectedTab, searchQuery])

    useEffect(() => {
        if (!session?.access_token) {
            return
        }

        setLoading(true)
        setError(null)

        const queryParams = new URLSearchParams({
            type: selectedTab,
            page: page.toString(),
            ...(searchQuery && { query: searchQuery }),
        })

        fetch(apiPath(`assets/pexels?${queryParams}`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
            .then(res => res.json())
            .then(data => {
                setAssets(prev => prev.concat(selectedTab === 'image' ? data.photos : data.videos))
            })
            .catch(() => setError('Failed to fetch assets'))
            .finally(() => setLoading(false))
    }, [selectedTab, page, searchQuery, session?.access_token])

    const handleTabChange = (tabId: 'image' | 'video') => {
        setSelectedTab(tabId)
        setAssets([])
        setPage(1)
    }

    const handleLoadMore = () => setPage(p => p + 1)

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value)
        setAssets([])
        setPage(1)
    }

    // Function to handle upload and highlight state
    const handleUploadAndHighlight = (assetId: string, uploading?: boolean) => {
        if (setUploadingAssetId && setHighlightedAssetId) {
            if (uploading) {
                setUploadingAssetId(assetId)
                setHighlightedAssetId(null)
            } else {
                setUploadingAssetId(null)
                setHighlightedAssetId(assetId)
                setTimeout(() => setHighlightedAssetId(null), 1600)
            }
        }
    }

    // Function to download and upload Pexels asset
    const handlePexelsAssetDownload = async (asset: any, assetType: 'image' | 'video') => {
        if (!session?.access_token) {
            throw new Error('Not signed in')
        }

        try {
            // 1. Get the media URL based on asset type
            let mediaUrl = ''
            if (assetType === 'image') {
                mediaUrl = asset.src?.original || asset.src?.large2x || asset.src?.large
            } else {
                mediaUrl = asset.video_files?.[0]?.link || asset.url
            }

            if (!mediaUrl) {
                throw new Error('Could not find media URL')
            }

            // 2. Download the asset
            const response = await fetch(mediaUrl)
            if (!response.ok) {
                throw new Error('Failed to download asset')
            }

            // 3. Get the file blob and create a File object
            const blob = await response.blob()
            const file = new File([blob], `${asset.id}.${assetType === 'video' ? 'mp4' : 'jpg'}`, {
                type: assetType === 'video' ? 'video/mp4' : 'image/jpeg'
            })

            // 4. Get media duration if it's a video
            let durationSeconds = 0
            if (assetType === 'video') {
                const url = URL.createObjectURL(file)
                const video = document.createElement('video')
                video.preload = 'metadata'
                video.src = url

                await new Promise<void>((resolve, reject) => {
                    video.onloadedmetadata = () => resolve()
                    video.onerror = () => reject(new Error('Could not load video metadata'))
                })

                durationSeconds = video.duration || 0
                URL.revokeObjectURL(url)
            }

            // 5. Upload to our server
            const form = new FormData()
            form.append('file', file)
            form.append('duration', String(durationSeconds))

            const uploadResponse = await fetch(apiPath('assets/upload'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: form,
            })

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload asset')
            }

            const uploadedAsset = await uploadResponse.json()
            refresh() // Refresh the assets list
            return uploadedAsset
        } catch (err) {
            console.error('Asset download/upload error:', err)
            throw err
        }
    }

    // Expose the function to the window object
    React.useEffect(() => {
        const panel = document.querySelector('[data-assets-panel]')
        if (panel) {
            (panel as any).handlePexelsAssetDownload = handlePexelsAssetDownload
        }
        return () => {
            if (panel) {
                delete (panel as any).handlePexelsAssetDownload
            }
        }
    }, [session?.access_token]) // Re-expose when session changes

    return (
        <div className="flex flex-col h-full bg-white rounded-lg" data-assets-panel>
            <div className="p-4">
                <PanelHeader icon={Image} title="Assets" />
            </div>
            <div className="px-4 space-y-4">
                <div className="flex gap-2">
                    {
                        ASSET_TABS.map((tab, index) => (
                            <button
                                key={index}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTab === tab.id
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))
                    }
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={handleSearch}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
                {
                    loading && assets.length === 0 && (
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
                        assets.map((asset, index) => (
                            <AssetGridItem
                                key={`${selectedTab}-${index}`}
                                asset={asset}
                                type={selectedTab}
                                onUploadAndHighlight={handleUploadAndHighlight}
                            />
                        ))
                    }
                </div>
                {
                    assets.length > 0 && !loading && (
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

export default AssetsToolPanel