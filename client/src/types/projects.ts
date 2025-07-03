export interface Project {
    id: string
    user_id: string
    name: string
    thumbnail_url?: string
    duration?: number
    is_public: boolean
    
    // Project settings
    aspectRatio?: 'horizontal' | 'vertical'
    
    // Notes field for user's project notes
    notes?: string
    
    // Async processing fields
    processing_status?: 'idle' | 'queued' | 'processing' | 'completed' | 'failed'
    processing_type?: 'quickclips' | 'autocut' | null
    processing_job_id?: string | null
    processing_progress?: number
    processing_message?: string | null
    processing_error?: string | null
    processing_data?: any | null
    processing_result?: any | null
    processing_started_at?: string | null
    processing_completed_at?: string | null
    
    created_at: string
    updated_at: string
    last_opened?: string
}