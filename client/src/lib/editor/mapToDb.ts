import { Track, Clip } from '../../types/editor'

export function toDbTrack(t: Track, projectId: string) {
    // Validate required fields
    if (!t.id || !projectId) {
        throw new Error(`Invalid track data: missing id (${t.id}) or projectId (${projectId})`)
    }
    
    // Ensure index is a valid number
    const index = typeof t.index === 'number' ? t.index : 0
    
    return {
        id: t.id,
        project_id: projectId,
        index: index,
        type: t.type === 'caption' ? 'text' : t.type, // Convert caption to text for database
        created_at: t.createdAt ?? new Date().toISOString(),
    };
}

export function toDbClip(c: Clip) {
    // Validate required fields
    if (!c.id || !c.trackId) {
        throw new Error(`Invalid clip data: missing id (${c.id}) or trackId (${c.trackId})`)
    }
    
    // Validate timeline positions
    if (typeof c.timelineStartMs !== 'number' || typeof c.timelineEndMs !== 'number') {
        throw new Error(`Invalid clip timeline positions: start=${c.timelineStartMs}, end=${c.timelineEndMs}`)
    }
    
    if (c.timelineEndMs <= c.timelineStartMs) {
        throw new Error(`Invalid clip duration: end (${c.timelineEndMs}) must be after start (${c.timelineStartMs})`)
    }
    
    // Handle external assets - they have fake asset IDs that don't exist in the database
    const isExternalAsset = c.assetId?.startsWith('external_') || c.properties?.externalAsset
    
    // Ensure asset_duration_ms is valid - fallback to timeline duration if missing
    const assetDurationMs = c.assetDurationMs && c.assetDurationMs > 0 
        ? c.assetDurationMs 
        : Math.max(c.timelineEndMs - c.timelineStartMs, 1000) // Minimum 1 second
    
    return {
        id: c.id,
        track_id: c.trackId,             // FK matches the new track's id
        asset_id: isExternalAsset ? null : c.assetId, // Use null for external assets
        type: c.type === 'caption' ? 'text' : c.type, // Convert caption to text for database
        source_start_ms: c.sourceStartMs || 0,
        source_end_ms: c.sourceEndMs || assetDurationMs,
        timeline_start_ms: c.timelineStartMs,
        timeline_end_ms: c.timelineEndMs,
        asset_duration_ms: assetDurationMs,
        volume: c.volume || 1.0,
        speed: c.speed || 1.0,
        properties: c.properties || null,
        created_at: c.createdAt ?? new Date().toISOString(),
    };
}