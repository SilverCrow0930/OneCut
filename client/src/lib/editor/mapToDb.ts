import { Track, Clip } from '../../types/editor'

export function toDbTrack(t: Track, projectId: string) {
    return {
        id: t.id,
        project_id: projectId,
        index: t.index,
        type: t.type,
        created_at: t.createdAt ?? new Date().toISOString(),
    };
}

export function toDbClip(c: Clip) {
    // Handle external assets - they have fake asset IDs that don't exist in the database
    const isExternalAsset = c.assetId?.startsWith('external_') || c.properties?.externalAsset
    
    return {
        id: c.id,
        track_id: c.trackId,             // FK matches the new track's id
        asset_id: isExternalAsset ? null : c.assetId, // Use null for external assets
        type: c.type,
        source_start_ms: c.sourceStartMs,
        source_end_ms: c.sourceEndMs,
        timeline_start_ms: c.timelineStartMs,
        timeline_end_ms: c.timelineEndMs,
        asset_duration_ms: c.assetDurationMs,
        volume: c.volume,
        speed: c.speed,
        properties: c.properties,
        created_at: c.createdAt ?? new Date().toISOString(),
    };
}