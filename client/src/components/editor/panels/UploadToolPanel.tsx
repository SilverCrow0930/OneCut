import React from 'react'
import { useAssets, Asset } from '@/contexts/AssetsContext'
import AssetUploader from '@/components/editor/upload/AssetUploader'
import MasonryGrid from '../upload/MasonryGrid'
import { Upload, Loader2 } from 'lucide-react'
import PanelHeader from './PanelHeader'

interface UploadToolPanelProps {
    highlightedAssetId?: string | null
    uploadingAssetId?: string | null
}

const UploadToolPanel: React.FC<UploadToolPanelProps> = ({ highlightedAssetId, uploadingAssetId }) => {
    const { assets, loading, error, addAsset } = useAssets()

    // Sort assets by creation date (newest first)
    const sortedAssets = [...assets].sort((a, b) => {
        // Use created_at if available, otherwise fallback to id comparison
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA // Descending order (newest first)
    })

    // Handle successful uploads by adding assets to state instead of full refresh
    const handleUploadSuccess = (newAssets: Asset[]) => {
        newAssets.forEach(asset => addAsset(asset))
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-lg">
            <div className="p-4">
                <PanelHeader
                    icon={Upload}
                    title="Upload Media"
                />
                <div className="mt-4">
                    <AssetUploader
                        onUploadSuccess={handleUploadSuccess}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar-hidden">
                {
                    loading &&
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p className="text-sm">Loading assets...</p>
                    </div>
                }
                {
                    error &&
                    <p className="text-red-500">{error}</p>
                }
                {
                    !loading && !error && (
                        <MasonryGrid
                            assets={sortedAssets}
                            highlightedAssetId={highlightedAssetId}
                            uploadingAssetId={uploadingAssetId}
                        />
                    )
                }
            </div>
        </div>
    )
}

export default UploadToolPanel
