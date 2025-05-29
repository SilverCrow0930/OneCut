import React, { useState, useEffect } from 'react'
import { Image, Search } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Asset } from './types/assets'
import { ASSET_TABS } from './constants/assets'
import AssetGridItem from './components/AssetGridItem'

const AssetsToolPanel = () => {
    const [selectedTab, setSelectedTab] = useState<'image' | 'video'>('video')
    const [assets, setAssets] = useState<Asset[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [page, setPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const { session } = useAuth()

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

    return (
        <div className="flex flex-col h-full bg-white rounded-lg">
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