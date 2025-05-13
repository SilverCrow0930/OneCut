import React, { useEffect } from 'react'
import { useAssets } from '@/contexts/AssetsContext'
import AssetUploader from '@/components/editor/upload/AssetUploader'
import AssetThumbnail from '../upload/AssetThumbnail'

const UploadToolPanel: React.FC = () => {
    const { assets, loading, error, refresh } = useAssets()

    // Fetch assets on mount (and after each upload)
    useEffect(() => {
        refresh()
    }, [refresh])

    return (
        <div className="flex flex-col items-center w-full h-full p-1 space-y-2 overflow-auto">
            <AssetUploader
                onUpload={refresh}
            />
            {
                loading &&
                <p>Loading assets ...</p>
            }
            {
                error &&
                <p className="text-red-500">{error}</p>
            }
            {
                !loading && !error && (
                    <div className="grid grid-cols-3 gap-2">
                        {
                            assets.map((asset, index) => (
                                <AssetThumbnail
                                    key={index}
                                    asset={asset}
                                />
                            ))
                        }
                    </div>
                )
            }
        </div>
    )
}

export default UploadToolPanel
