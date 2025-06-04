import React, { useState, useEffect, useRef } from 'react'
import AssetThumbnail from './AssetThumbnail'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'

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

interface MasonryItem {
    asset: any
    width: number
    height: number
    x: number
    y: number
}

const MasonryGrid: React.FC<MasonryGridProps> = ({
    assets,
    highlightedAssetId,
    uploadingAssetId,
    columnCount = 2,
    gap = 8
}) => {
    const [masonryItems, setMasonryItems] = useState<MasonryItem[]>([])
    const [containerHeight, setContainerHeight] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const containerRef = useRef<HTMLDivElement>(null)
    const { session } = useAuth()

    useEffect(() => {
        if (assets.length === 0) {
            setMasonryItems([])
            setContainerHeight(0)
            setIsLoading(false)
            return
        }

        calculateMasonryLayout()
    }, [assets, columnCount, gap])

    // Handle container resize
    useEffect(() => {
        if (!containerRef.current) return

        const resizeObserver = new ResizeObserver(() => {
            if (assets.length > 0) {
                calculateMasonryLayout()
            }
        })

        resizeObserver.observe(containerRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [assets, columnCount, gap])

    const calculateMasonryLayout = async () => {
        if (!containerRef.current) return

        setIsLoading(true)
        const containerWidth = containerRef.current.clientWidth
        const columnWidth = (containerWidth - (columnCount - 1) * gap) / columnCount
        
        // Initialize column heights
        const columnHeights = new Array(columnCount).fill(0)
        const items: MasonryItem[] = []

        // Process each asset
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i]
            
            // Get natural dimensions for this asset
            const dimensions = await getAssetDimensions(asset)
            
            // Calculate height maintaining aspect ratio
            const aspectRatio = dimensions.width / dimensions.height
            let itemHeight = columnWidth / aspectRatio
            
            // Apply min/max height constraints for better visual balance
            const minHeight = 80   // Don't make items too small
            const maxHeight = 300  // Don't make items too large
            itemHeight = Math.max(minHeight, Math.min(maxHeight, itemHeight))
            
            // Find the shortest column
            const shortestColumnIndex = columnHeights.reduce((minIndex, height, index) => 
                height < columnHeights[minIndex] ? index : minIndex, 0
            )
            
            // Calculate position
            const x = shortestColumnIndex * (columnWidth + gap)
            const y = columnHeights[shortestColumnIndex]
            
            // Add item
            items.push({
                asset,
                width: columnWidth,
                height: itemHeight,
                x,
                y
            })
            
            // Update column height
            columnHeights[shortestColumnIndex] += itemHeight + gap
        }

        setMasonryItems(items)
        setContainerHeight(Math.max(...columnHeights) - gap) // Remove last gap
        setIsLoading(false)
    }

    const getAssetDimensions = async (asset: any): Promise<{ width: number; height: number }> => {
        return new Promise((resolve) => {
            if (asset.mime_type.startsWith('video/')) {
                // For videos, use common aspect ratios based on likely content
                resolve({ width: 16, height: 9 }) // Standard widescreen
            } else if (asset.mime_type.startsWith('audio/')) {
                // Audio files get a wide, short aspect ratio
                resolve({ width: 3, height: 1 })
            } else if (asset.mime_type.startsWith('image/')) {
                // For images, try to load and get actual dimensions
                if (!session?.access_token) {
                    // Fallback to square if no auth
                    resolve({ width: 1, height: 1 })
                    return
                }

                const img = new Image()
                img.onload = () => {
                    // Constrain extreme aspect ratios for better layout
                    const naturalRatio = img.naturalWidth / img.naturalHeight
                    let width = img.naturalWidth
                    let height = img.naturalHeight
                    
                    // If too wide, limit to 3:1 ratio
                    if (naturalRatio > 3) {
                        width = 3
                        height = 1
                    }
                    // If too tall, limit to 1:2 ratio
                    else if (naturalRatio < 0.5) {
                        width = 1
                        height = 2
                    }
                    
                    resolve({ width, height })
                }
                img.onerror = () => {
                    // Common photo aspect ratios as fallbacks
                    const photoRatios = [
                        { width: 4, height: 3 },   // Classic photo
                        { width: 3, height: 2 },   // Standard photo
                        { width: 16, height: 9 },  // Widescreen
                        { width: 1, height: 1 },   // Square
                        { width: 9, height: 16 }   // Portrait
                    ]
                    const randomRatio = photoRatios[Math.floor(Math.random() * photoRatios.length)]
                    resolve(randomRatio)
                }
                
                // Fetch the asset URL with proper auth
                fetch(apiPath(`assets/${asset.id}/url`), {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                })
                    .then(res => res.json())
                    .then(data => {
                        img.src = data.url
                    })
                    .catch(() => {
                        resolve({ width: 4, height: 3 }) // Default photo ratio
                    })
            } else {
                // Fallback for other file types
                resolve({ width: 1, height: 1 })
            }
        })
    }

    if (isLoading) {
        // Show skeleton with varied heights to preview the masonry layout
        const skeletonHeights = [120, 160, 140, 180, 100, 200, 150, 130]
        
        return (
            <div className="grid grid-cols-2 gap-2">
                {assets.map((asset, index) => (
                    <div 
                        key={asset.id} 
                        className="bg-gray-200 animate-pulse rounded-lg transition-all duration-300" 
                        style={{ 
                            height: skeletonHeights[index % skeletonHeights.length]
                        }}
                    />
                ))}
            </div>
        )
    }

    return (
        <div 
            ref={containerRef}
            className="relative w-full transition-all duration-300"
            style={{ height: containerHeight }}
        >
            {masonryItems.map((item, index) => (
                <AssetThumbnail
                    key={item.asset.id}
                    asset={item.asset}
                    highlight={highlightedAssetId === item.asset.id}
                    uploading={uploadingAssetId === item.asset.id}
                    style={{
                        position: 'absolute',
                        left: item.x,
                        top: item.y,
                        width: item.width,
                        height: item.height,
                        transition: 'all 0.3s ease-in-out',
                        transitionDelay: `${index * 50}ms` // Staggered animation
                    }}
                />
            ))}
        </div>
    )
}

export default MasonryGrid 