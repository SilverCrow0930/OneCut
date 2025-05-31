import React from 'react';
import { Asset, PexelsPhoto, PexelsVideo } from '../types/assets';

interface AssetGridItemProps {
    asset: Asset;
    type: 'image' | 'video';
}

const AssetGridItem: React.FC<AssetGridItemProps> = ({ asset, type }) => {
    const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
        // Create a payload with external asset information
        const dragData = {
            type: 'external_asset',
            assetType: type,
            asset: asset
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
            className="relative aspect-[9/16] rounded-lg overflow-hidden group shadow hover:shadow-lg transition-shadow cursor-grab active:cursor-grabbing"
            draggable={true}
            onDragStart={handleDragStart}
        >
            {type === 'image' ? (
                <img
                    src={(asset as PexelsPhoto).src.portrait}
                    alt="pexels asset"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 pointer-events-none"
                />
            ) : (
                <div className="w-full h-full bg-black flex items-center justify-center">
                    <img
                        src={(asset as PexelsVideo).image}
                        alt="pexels video thumbnail"
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 pointer-events-none"
                    />
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">
                    {type === 'image' ? (
                        <>
                            Photo by{' '}
                            <a
                                href={(asset as PexelsPhoto).photographer_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                                onClick={e => e.stopPropagation()}
                            >
                                {(asset as PexelsPhoto).photographer}
                            </a>
                        </>
                    ) : (
                        <>
                            Video by{' '}
                            <a
                                href={(asset as PexelsVideo).user?.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                                onClick={e => e.stopPropagation()}
                            >
                                {(asset as PexelsVideo).user?.name}
                            </a>
                        </>
                    )}
                </p>
            </div>
        </div>
    );
};

export default AssetGridItem; 