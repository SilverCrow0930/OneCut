export type TrackType = 'audio' | 'video' | 'text' | 'caption' | 'sfx'

export interface DBTrack {
    /** UUID primary key */
    id: string
    /** Foreign key to projects.id */
    project_id: string
    /** Zero-based ordering of this track within its project */
    index: number
    /** Whether this is an audio or video track */
    type: TrackType
    /** When the row was created (ISO timestamp) */
    created_at: string
}