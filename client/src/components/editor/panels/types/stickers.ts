export interface GiphySticker {
    id: string;
    title: string;
    images: {
        original: {
            url: string;
            width: string;
            height: string;
        };
        fixed_height: {
            url: string;
            width: string;
            height: string;
        };
    };
    user?: {
        display_name: string;
        profile_url: string;
    };
} 