export interface Project {
    id: string
    user_id: string
    name: string
    thumbnail_url?: string
    duration?: number
    is_public: boolean
    created_at: string
    updated_at: string
}