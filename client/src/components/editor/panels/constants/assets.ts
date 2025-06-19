export const ASSET_TABS = [
    { id: 'video', label: 'Video' },
    { id: 'image', label: 'Image' },
    { id: 'music', label: 'Music' },
    { id: 'sound', label: 'SFX' }
] as const;

export type AssetType = typeof ASSET_TABS[number]['id']; 