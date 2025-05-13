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
    return {
        id: c.id,
        track_id: c.trackId,             // FK matches the new track's id
        asset_id: c.assetId,
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