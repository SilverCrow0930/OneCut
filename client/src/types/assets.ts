export interface Asset {
    id: string
    user_id: string
    name: string
    mime_type: string
    duration: number | null
    object_key: string
    created_at: string
    last_used: string | null
}