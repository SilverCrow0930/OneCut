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
        type: t.type === 'caption' ? 'text' : 
              t.type === 'stickers' ? 'video' :
              t.type === 'sfx' ? 'audio' : t.type, // Map sfx to audio type for database
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
    
    // Round all time values to integers to prevent floating-point database errors
    let timelineStartMs = Math.round(c.timelineStartMs)
    let timelineEndMs = Math.round(c.timelineEndMs)
    
    // Handle zero-duration clips (especially for images) by adding default duration
    if (timelineEndMs <= timelineStartMs) {
        // For images and text, add a default 5-second duration
        if (c.type === 'image' || c.type === 'text' || c.type === 'caption') {
            timelineEndMs = timelineStartMs + 5000 // 5 seconds default
            console.log(`[mapToDb] Added default 5s duration for ${c.type} clip: ${timelineStartMs}ms -> ${timelineEndMs}ms`)
        } else {
            throw new Error(`Invalid clip duration: end (${c.timelineEndMs}) must be after start (${c.timelineStartMs})`)
        }
    }
    
    // Handle external assets and missing assets - they have fake asset IDs that don't exist in the database
    const isExternalAsset = c.assetId?.startsWith('external_') || c.properties?.externalAsset
    const isMissingAsset = c.assetId?.startsWith('missing_')
    
    // Calculate corrected timeline duration
    const timelineDurationMs = timelineEndMs - timelineStartMs
    
    // Ensure asset_duration_ms is valid - fallback to timeline duration if missing
    const assetDurationMs = c.assetDurationMs && c.assetDurationMs > 0 
        ? Math.round(c.assetDurationMs)
        : Math.max(timelineDurationMs, 1000) // Minimum 1 second
    
    return {
        id: c.id,
        track_id: c.trackId,             // FK matches the new track's id
        asset_id: (isExternalAsset || isMissingAsset) ? null : c.assetId, // Use null for external and missing assets
        type: c.type === 'caption' ? 'text' : c.type, // Convert caption to text for database
        source_start_ms: Math.round(c.sourceStartMs || 0),
        source_end_ms: Math.round(c.sourceEndMs || assetDurationMs),
        timeline_start_ms: timelineStartMs, // Use corrected values
        timeline_end_ms: timelineEndMs,     // Use corrected values
        asset_duration_ms: assetDurationMs,
        volume: c.volume || 1.0,
        speed: c.speed || 1.0,
        properties: {
            ...(c.properties || {}),
            // Preserve the SFX flag when saving to database
            isSfx: c.properties?.isSfx || false
        },
        created_at: c.createdAt ?? new Date().toISOString(),
    };
}