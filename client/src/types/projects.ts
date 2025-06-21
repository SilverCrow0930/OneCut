export interface Project {
    id: string
    user_id: string
    name: string
    data?: any
    created_at: string
    updated_at: string
    thumbnail?: string
    processing_status?: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | null
    processing_progress?: number | null
    processing_message?: string | null
    processing_error?: string | null
    processing_type?: 'smartcut' | 'autocut' | null
    processing_result?: any | null
    processing_data?: any | null
    processing_job_id?: string | null
    processing_started_at?: string | null
    processing_completed_at?: string | null
    notes?: string | null
}