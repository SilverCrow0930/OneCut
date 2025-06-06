export interface Project {
    id: string
    user_id: string
    name: string
    thumbnail_url?: string
    duration?: number
    is_public: boolean
    created_at: string
    updated_at: string
    // QuickClips fields
    type?: 'project' | 'quickclips'
    processing_status?: 'idle' | 'processing' | 'completed' | 'error'
    processing_message?: string
    quickclips_data?: {
        clips: any[]
        contentType: string
        targetDuration: number
        videoFormat: string
        outputMode?: 'individual' | 'stitched'
        originalFilename: string
    }
}