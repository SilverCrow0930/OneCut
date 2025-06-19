import { ElementType } from 'react';

export interface AssetType {
    id: 'image' | 'video' | 'music' | 'sound';
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

export interface FreesoundAudio {
    id: number;
    name: string;
    description: string;
    duration: number;
    previews: {
        'preview-hq-mp3': string;
        'preview-lq-mp3': string;
        'preview-hq-ogg': string;
        'preview-lq-ogg': string;
    };
    download: string;
    tags: string[];
    license: string;
    username?: string;
}

export type Asset = PexelsPhoto | PexelsVideo | FreesoundAudio; 