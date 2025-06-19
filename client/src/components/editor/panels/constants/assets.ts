import { Image, Video, Music, Volume2 } from 'lucide-react';

export const ASSET_TABS = [
    { id: 'video', label: 'Video', icon: Video },
    { id: 'image', label: 'Image', icon: Image },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'sound', label: 'Sound FX', icon: Volume2 }
] as const;

export type AssetType = typeof ASSET_TABS[number]['id']; 