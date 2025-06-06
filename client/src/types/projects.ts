export interface Project {
    id: string
    user_id: string
    name: string
    thumbnail_url?: string
    duration?: number
    is_public: boolean
    created_at: string
    updated_at: string
    
    // QuickClips support
    project_type?: 'timeline' | 'quickclips'
    processing_status?: 'processing' | 'completed' | 'error' | 'pending'
    processing_progress?: number
    processing_message?: string
    original_file_uri?: string
    content_type?: string
    target_duration?: number
    video_format?: 'short_vertical' | 'long_horizontal'
    error_message?: string
    quickclips_data?: QuickClipsData
}

export interface QuickClipsData {
    clips: QuickClip[]
    processingTime?: number
    originalFilename?: string
}

export interface QuickClip {
    id: string
    title: string
    duration: number
    start_time: number
    end_time: number
    viral_score: number
    description: string
    thumbnail: string
    downloadUrl: string
    previewUrl: string
}