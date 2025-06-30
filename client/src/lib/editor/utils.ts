import { Clip, Track } from "@/types/editor";
import { Command, HistoryState } from "@/types/editor";

// Helper function to generate UUID
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

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
    let end = Number(r.timeline_end_ms) || 0
    
    // Ensure end is after start - add default duration for zero-duration clips
    if (end <= start) {
        // For images and text, add a default 5-second duration
        if (r.type === 'image' || r.type === 'text') {
            end = start + 5000 // 5 seconds default
            console.log(`[dbToClip] Added default 5s duration for ${r.type} clip: ${start}ms -> ${end}ms`)
        } else {
            // For other types, use asset duration or minimum 1 second
            const assetDuration = Number(r.asset_duration_ms) || 1000
            end = start + assetDuration
            console.log(`[dbToClip] Fixed zero duration for ${r.type} clip: ${start}ms -> ${end}ms`)
        }
    }

    // Handle external assets that have null asset_id by checking properties
    const hasExternalAsset = r.properties?.externalAsset
    // NOTE: For clips without valid asset_id (like captions/text), create a temporary "missing_" ID
    // This gets filtered out in mapToDb.ts to prevent database save errors
    const assetId = r.asset_id || (hasExternalAsset ? hasExternalAsset.id : `missing_${r.id}`)

    return {
        id: r.id,
        trackId: r.track_id,
        assetId: assetId,
        type: r.type,
        sourceStartMs: Number(r.source_start_ms) || 0,
        sourceEndMs: Number(r.source_end_ms) || (end - start), // Use calculated duration
        timelineStartMs: start,
        timelineEndMs: end,
        assetDurationMs: Number(r.asset_duration_ms) || (end - start),
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
        assetType?: 'image' | 'video' | 'music' | 'sound',
        trackIndex?: number,
        startTimeMs?: number
    } = {}
) {
    const { isExternal = false, assetType, trackIndex } = options
    
    console.log('Adding asset to track:', { asset, isExternal, assetType, trackIndex })
    
    // Determine track type and asset details
    let trackType: 'audio' | 'video' | 'stickers' = 'video'
    let duration = 0
    let externalAsset = null
    
    if (isExternal) {
        // Handle external assets (Pexels, Giphy stickers, Freesound audio)
        if (assetType === 'music' || assetType === 'sound') {
            trackType = 'audio'
        } else {
            trackType = assetType === 'video' ? 'video' : 'video' // Images also go on video tracks
        }
        
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
        } else if (assetType === 'music' || assetType === 'sound') {
            // Freesound audio
            mediaUrl = asset.previews?.['preview-hq-mp3'] || asset.previews?.['preview-lq-mp3'] || asset.download
        }
        
        if (!mediaUrl) {
            console.error('Could not extract media URL from external asset:', asset)
            return
        }
        
        // Calculate duration and ensure it's an integer
        let calculatedDuration = 0
        if (assetType === 'video') {
            calculatedDuration = 10000
        } else if (assetType === 'music' || assetType === 'sound') {
            calculatedDuration = asset.duration ? Math.round(asset.duration * 1000) : 30000
        } else if (asset.isSticker || mediaUrl.includes('.gif')) {
            calculatedDuration = 3000
        } else {
            calculatedDuration = 5000
        }

        // Create external asset data
        externalAsset = {
            id: `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: mediaUrl,
            name: asset.title || asset.name || asset.alt || `External ${assetType}`,
            mime_type: assetType === 'video' ? 'video/mp4' : 
                      assetType === 'music' || assetType === 'sound' ? 'audio/mpeg' :
                      (asset.isSticker || mediaUrl.includes('.gif')) ? 'image/gif' : 'image/jpeg',
            duration: calculatedDuration,
            isExternal: true,
            originalData: asset
        }
        duration = calculatedDuration
    } else {
        // Handle regular uploaded assets
        trackType = asset.mime_type.startsWith('audio/') ? 'audio' : 'video'
        duration = asset.duration ? Math.floor(asset.duration) : 0
        
        // Ensure minimum duration for images and other assets
        if (duration <= 0) {
            if (asset.mime_type.startsWith('image/')) {
                duration = 5000 // 5 seconds for images
                console.log('Added default 5s duration for uploaded image')
            } else {
                duration = 1000 // 1 second minimum for other assets
                console.log('Added default 1s duration for asset with no duration')
            }
        }
    }
    
    // Find the target track or create a new one
    let targetTrack: any = null
    let targetTrackIndex = trackIndex ?? tracks.length // Default to end
    let startTimeMs = options.startTimeMs ?? 0
    
    // Special handling for stickers - use stickers track type
    if (isExternal && asset.isSticker) {
        // Try to find an existing stickers track
        targetTrack = tracks.find(t => t.type === 'stickers');
        
        if (!targetTrack) {
            // If no stickers track exists, create one at index 0 (top)
            targetTrackIndex = 0;
            // Shift all tracks down by 1
            for (const track of tracks) {
                executeCommand({
                    type: 'UPDATE_TRACK',
                    payload: { 
                        before: track,
                        after: { ...track, index: track.index + 1 }
                    }
                });
            }
            targetTrack = null; // Force creation of new track
            trackType = 'stickers'; // Set track type to stickers
        } else {
            targetTrackIndex = targetTrack.index;
        }
    } else {
        // Special handling for audio tracks - always place at the bottom
        if (trackType === 'audio') {
            targetTrackIndex = tracks.length; // Add at the end (bottom)
            targetTrack = null; // Force creation of new track
        } else {
            // For non-audio tracks, add at the top (index 0) and shift others down
            if (trackIndex === undefined) {
                // Try to find an existing track of the same type
                targetTrack = tracks.find(t => t.type === trackType)
                if (targetTrack) {
                    targetTrackIndex = targetTrack.index
                } else {
                    // Create at top and shift everything down
                    targetTrackIndex = 0;
                    // Shift all tracks down by 1
                    for (const track of tracks) {
                        executeCommand({
                            type: 'UPDATE_TRACK',
                            payload: { 
                                before: track,
                                after: { ...track, index: track.index + 1 }
                            }
                        });
                    }
                }
            } else if (trackIndex < tracks.length) {
                targetTrack = tracks[trackIndex]
                targetTrackIndex = trackIndex
            }
        }
        
        // Calculate start time - place at the end of existing content on the track
        if (options.startTimeMs === undefined && targetTrack) {
            // Find the latest end time for clips on this track to prevent overlap
            const trackClips = clips.filter(clip => clip.trackId === targetTrack.id)
            if (trackClips.length > 0) {
                const latestEndTime = Math.max(...trackClips.map(clip => clip.timelineEndMs))
                startTimeMs = latestEndTime // Place new clip after the last one
                console.log('Placing clip after existing content at:', startTimeMs)
            } else {
                startTimeMs = 0 // First clip on track starts at 0
                console.log('First clip on track, starting at 0')
            }
        }
    }
    
    // Create new track if needed
    if (!targetTrack) {
        targetTrack = {
            id: generateUUID(),
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
        
        // For new tracks, start at 0 since there are no existing clips
        startTimeMs = 0
    }
    
    // Final safety check - ensure duration is valid and integer
    if (duration <= 0) {
        duration = 5000 // 5 seconds default
        console.warn('Duration was still 0, using 5s default')
    }
    
    // Ensure all duration and time values are integers to prevent database errors
    duration = Math.round(duration)
    startTimeMs = Math.round(startTimeMs)
    
    // Create the clip
    const newClip = {
        id: generateUUID(),
        trackId: targetTrack.id,
        assetId: isExternal ? externalAsset!.id : asset.id,
        type: (isExternal && asset.isSticker) ? 'image' : trackType,
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
