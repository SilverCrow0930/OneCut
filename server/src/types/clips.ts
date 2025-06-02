// src/types/clip.ts

/** The allowed clip "kinds" */
export type ClipType = 'video' | 'image' | 'audio' | 'text'

/** A clip as stored in the database (snake_cased to match Supabase) */
export interface DBClip {
    id: string         // uuid
    track_id: string         // FK → tracks.id
    asset_id: string | null         // FK → assets.id (nullable for external assets)
    type: ClipType       // 'video' | 'image' | 'audio' | 'text'
    source_start_ms: number         // trim start in source media
    source_end_ms: number         // trim end in source media
    timeline_start_ms: number         // placement start on timeline
    timeline_end_ms: number         // placement end on timeline
    asset_duration_ms: number         // duration of the asset in ms
    volume: number         // 0.00–1.00
    speed: number         // playback rate override
    properties: Record<string, any> | null // JSONB for video/image settings
    created_at: string         // ISO timestamp
}

/** 
 * When inserting a new clip, you never supply `id` or `created_at`, so:
 * (you can use this for your Supabase insert payloads)
 */
export type NewClip = Omit<DBClip, 'id' | 'created_at'>
