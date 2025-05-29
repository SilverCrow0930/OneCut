import { ElementType } from 'react';

export interface AssetType {
    id: 'image' | 'video';
    label: string;
    icon: ElementType;
}

export interface PexelsPhoto {
    id: number;
    src: { portrait: string };
    photographer: string;
    photographer_url: string;
}

export interface PexelsVideo {
    id: number;
    image: string;
    user: { name: string; url: string };
    video_files: { link: string }[];
}

export type Asset = PexelsPhoto | PexelsVideo; 