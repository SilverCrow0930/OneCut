import React, { useState, useEffect, useRef } from 'react'
import AssetThumbnail from './AssetThumbnail'

interface MasonryGridProps {
    assets: Array<{
        id: string
        name?: string
        mime_type: string
        duration: number | null
    }>
    highlightedAssetId?: string | null
    uploadingAssetId?: string | null
    columnCount?: number
    gap?: number
}

const MasonryGrid: React.FC<MasonryGridProps> = ({
    assets,
    highlightedAssetId,
    uploadingAssetId,
    columnCount = 2,
    gap = 8
}) => {
    const containerRef = useRef<HTMLDivElement>(null)

    // Simple predefined heights for varied layout (Canva-style)
    const getItemHeight = (index: number, mimeType: string) => {
        // Create varied heights based on content type and index for visual variety
        const heights = [120, 160, 140, 180, 200, 150, 170, 130, 190, 110]
        
        // Adjust height based on media type
        if (mimeType.startsWith('audio/')) {
            return 80 // Audio files are shorter
        } else if (mimeType.startsWith('video/')) {
            return heights[index % heights.length] * 0.9 // Videos slightly shorter for 16:9 ratio
        } else {
            return heights[index % heights.length] // Images get full variety
        }
    }

    return (
        <div 
            ref={containerRef}
            className="columns-2 gap-2 space-y-2"
        >
            {assets.map((asset, index) => (
                <div 
                    key={asset.id}
                    className="break-inside-avoid mb-2"
                    style={{ 
                        height: getItemHeight(index, asset.mime_type)
                    }}
                >
                    <AssetThumbnail
                        asset={asset}
                        highlight={highlightedAssetId === asset.id}
                        uploading={uploadingAssetId === asset.id}
                        style={{
                            width: '100%',
                            height: '100%'
                        }}
                    />
                </div>
            ))}
        </div>
    )
}

export default MasonryGrid 