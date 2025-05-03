export interface Asset {
    id: string
    user_id: string
    name: string
    url: string
    mime_type: string
    duration: number | null
    created_at: string
}