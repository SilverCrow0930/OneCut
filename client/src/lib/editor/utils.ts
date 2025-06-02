import { Clip, Track } from "@/types/editor";
import { Command, HistoryState } from "@/types/editor";

export function applyCommand(
    state: { tracks: Track[]; clips: Clip[] },
    cmd: Command
): { tracks: Track[]; clips: Clip[] } {
    const { tracks, clips } = state
    switch (cmd.type) {
        case 'BATCH': {
            // Apply each command in sequence
            return cmd.payload.commands.reduce(
                (state, cmd) => applyCommand(state, cmd),
                state
            )
        }
        case 'ADD_TRACK': {
            // insert & re-index so no gaps
            const newTracks = [...tracks, cmd.payload.track]
                .sort((a, b) => a.index - b.index)
                .map((t, i) => ({ ...t, index: i }))
            return { tracks: newTracks, clips }
        }
        case 'REMOVE_TRACK': {
            const { track, affectedClips } = cmd.payload
            return {
                tracks: tracks.filter(t => t.id !== track.id),
                clips: clips.filter(c => c.trackId !== track.id),
            }
        }
        case 'UPDATE_TRACK': {
            const { before, after } = cmd.payload
            return {
                tracks: tracks.map(t => t.id === before.id ? after : t),
                clips
            }
        }
        case 'ADD_CLIP':
            return { tracks, clips: [...clips, cmd.payload.clip] }
        case 'REMOVE_CLIP':
            return { tracks, clips: clips.filter(c => c.id !== cmd.payload.clip.id) }
        case 'UPDATE_CLIP': {
            const { before, after } = cmd.payload
            return {
                tracks,
                clips: clips.map(c => c.id === before.id ? after : c),
            }
        }
        case 'RESET':
            return {
                tracks: cmd.payload.tracks,
                clips: cmd.payload.clips,
            }
        default:
            return state
    }
}

export function inverseCommand(cmd: Command): Command {
    switch (cmd.type) {
        case 'BATCH': {
            // Reverse the commands and invert each one
            return {
                type: 'BATCH',
                payload: {
                    commands: [...cmd.payload.commands].reverse().map(inverseCommand)
                }
            }
        }
        case 'ADD_TRACK':
            return { type: 'REMOVE_TRACK', payload: { track: cmd.payload.track, affectedClips: [] } }
        case 'REMOVE_TRACK':
            return {
                type: 'ADD_TRACK',
                payload: {
                    track: cmd.payload.track
                }
            }
        case 'UPDATE_TRACK':
            return {
                type: 'UPDATE_TRACK',
                payload: {
                    before: cmd.payload.after,
                    after: cmd.payload.before
                }
            }
        case 'ADD_CLIP':
            return { type: 'REMOVE_CLIP', payload: { clip: cmd.payload.clip } }
        case 'REMOVE_CLIP':
            return { type: 'ADD_CLIP', payload: { clip: cmd.payload.clip } }
        case 'UPDATE_CLIP':
            return {
                type: 'UPDATE_CLIP',
                payload: { before: cmd.payload.after, after: cmd.payload.before },
            }
        default:
            return cmd
    }
}

export function historyReducer(
    state: HistoryState,
    action: { type: string; cmd?: Command; tracks?: Track[]; clips?: Clip[] }
): HistoryState {
    const { past, present, future } = state
    switch (action.type) {
        case 'EXECUTE': {
            const cmd = action.cmd!
            const next = applyCommand(present, cmd)
            return { past: [...past, cmd], present: next, future: [] }
        }
        case 'UNDO': {
            if (!past.length) return state
            const cmd = past[past.length - 1]
            const inv = inverseCommand(cmd)
            return {
                past: past.slice(0, -1),
                present: applyCommand(present, inv),
                future: [cmd, ...future],
            }
        }
        case 'REDO': {
            if (!future.length) return state
            const cmd = future[0]
            return {
                past: [...past, cmd],
                present: applyCommand(present, cmd),
                future: future.slice(1),
            }
        }
        case 'RESET':
            return { past: [], present: { tracks: action.tracks!, clips: action.clips! }, future: [] }
        default:
            return state
    }
}

export function dbToTrack(r: any): Track {
    return {
        id: r.id,                               // uuid
        projectId: r.project_id,                       // uuid FK
        index: Number(r.index) || 0,         // ordering in UI
        type: r.type as Track['type'],            // 'video' | 'audio'
        createdAt: r.created_at ?? new Date().toISOString(),
    }
}

export function dbToClip(r: any): Clip {
    const start = Number(r.timeline_start_ms) || 0
    const end = Number(r.timeline_end_ms) || start   // never NaN, never < start

    return {
        id: r.id,
        trackId: r.track_id,
        assetId: r.asset_id,
        type: r.type,
        sourceStartMs: Number(r.source_start_ms) || 0,
        sourceEndMs: Number(r.source_end_ms) || 0,
        timelineStartMs: start,
        timelineEndMs: end,
        assetDurationMs: Number(r.asset_duration_ms) || 0,
        volume: Number(r.volume) || 1,
        speed: Number(r.speed) || 1,
        properties: r.properties ?? {},
        createdAt: r.created_at,
    }
}

// Add asset directly to timeline track (helper for click-to-add functionality)
export function addAssetToTrack(
    asset: any,
    tracks: any[],
    clips: any[],
    executeCommand: any,
    projectId: string,
    options: {
        isExternal?: boolean,
        assetType?: 'image' | 'video',
        trackIndex?: number,
        startTimeMs?: number
    } = {}
) {
    const { isExternal = false, assetType, trackIndex } = options
    
    console.log('Adding asset to track:', { asset, isExternal, assetType, trackIndex })
    
    // Determine track type and asset details
    let trackType: 'audio' | 'video' = 'video'
    let duration = 0
    let externalAsset = null
    
    if (isExternal) {
        // Handle external assets (Pexels, Giphy stickers)
        trackType = assetType === 'video' ? 'video' : 'video' // Images also go on video tracks
        
        // Extract the correct URL based on asset type and source
        let mediaUrl = ''
        
        if (asset.isSticker) {
            // Giphy sticker
            mediaUrl = asset.url || asset.images?.original?.url
        } else if (assetType === 'image') {
            // Pexels image
            mediaUrl = asset.src?.original || asset.src?.large2x || asset.src?.large
        } else if (assetType === 'video') {
            // Pexels video
            mediaUrl = asset.video_files?.[0]?.link || asset.url
        }
        
        if (!mediaUrl) {
            console.error('Could not extract media URL from external asset:', asset)
            return
        }
        
        // Create external asset data
        externalAsset = {
            id: `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: mediaUrl,
            name: asset.title || asset.alt || `External ${assetType}`,
            mime_type: assetType === 'video' ? 'video/mp4' : 
                      (asset.isSticker || mediaUrl.includes('.gif')) ? 'image/gif' : 'image/jpeg',
            duration: assetType === 'video' ? 10000 : 
                     (asset.isSticker || mediaUrl.includes('.gif')) ? 3000 : 5000, // 3s for GIFs, 5s for images
            isExternal: true,
            originalData: asset
        }
        duration = externalAsset.duration
    } else {
        // Handle regular uploaded assets
        trackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'
        duration = asset.duration ? Math.floor(asset.duration) : 0
    }
    
    // Find the target track or create a new one
    let targetTrack
    let targetTrackIndex = trackIndex ?? tracks.length // Default to end
    
    // If no specific track index provided, try to find an existing track of the same type
    if (trackIndex === undefined) {
        const existingTrack = tracks.find(t => t.type === trackType)
        if (existingTrack) {
            targetTrack = existingTrack
            targetTrackIndex = existingTrack.index
        }
    } else if (trackIndex < tracks.length) {
        targetTrack = tracks[trackIndex]
    }
    
    // Calculate start time - place at the end of existing content on the track
    let startTimeMs = options.startTimeMs ?? 0
    if (options.startTimeMs === undefined && targetTrack) {
        // Find all clips on this track and get the latest end time
        const trackClips = clips.filter(clip => clip.trackId === targetTrack.id)
        if (trackClips.length > 0) {
            const latestEndTime = Math.max(...trackClips.map(clip => clip.timelineEndMs))
            startTimeMs = latestEndTime
            console.log('Placing clip after existing content at:', startTimeMs)
        } else {
            startTimeMs = 0 // First clip on this track
            console.log('First clip on track, placing at start')
        }
    }
    
    // Create new track if needed
    if (!targetTrack) {
        targetTrack = {
            id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            projectId: projectId,
            index: targetTrackIndex,
            type: trackType,
            createdAt: new Date().toISOString(),
        }
        
        console.log('Creating new track:', targetTrack)
        
        executeCommand({
            type: 'ADD_TRACK',
            payload: { track: targetTrack }
        })
    }
    
    // Create the clip
    const newClip = {
        id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        trackId: targetTrack.id,
        assetId: isExternal ? externalAsset!.id : asset.id,
        type: trackType,
        sourceStartMs: 0,
        sourceEndMs: duration,
        timelineStartMs: startTimeMs,
        timelineEndMs: startTimeMs + duration,
        assetDurationMs: duration,
        volume: 1,
        speed: 1,
        properties: isExternal ? {
            externalAsset: externalAsset
        } : (asset.mime_type.startsWith('image/') ? {
            crop: {
                width: 320,  // Default 16:9 aspect ratio
                height: 180,
                left: 0,
                top: 0
            },
            mediaPos: {
                x: 0,
                y: 0
            },
            mediaScale: 1
        } : {}),
        createdAt: new Date().toISOString(),
    }
    
    console.log('Creating clip:', newClip)
    
    executeCommand({
        type: 'ADD_CLIP',
        payload: { clip: newClip }
    })
    
    return { track: targetTrack, clip: newClip }
}
