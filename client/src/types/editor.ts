import React from 'react'

export interface Tool {
    label: string
    icon: string
    aiTool: boolean
}

export interface ToolPanel {
    label: string
    component: React.ComponentType
}

export type TrackType = 'video' | 'audio' | 'text' | 'caption'

export interface Track {
    id: string
    projectId: string
    index: number
    type: TrackType
    createdAt?: string
}

export type ClipType = 'video' | 'image' | 'audio' | 'text' | 'caption'

export interface Clip {
    id: string
    trackId: string
    assetId?: string
    type: ClipType
    sourceStartMs: number
    sourceEndMs: number
    timelineStartMs: number
    timelineEndMs: number
    assetDurationMs: number
    volume: number
    speed: number
    properties?: Record<string, any>
    createdAt?: string
}

export type Command
    = {
        type: 'ADD_TRACK';
        payload: {
            track: Track
        }
    }
    | {
        type: 'REMOVE_TRACK';
        payload: {
            track: Track; affectedClips: Clip[]
        }
    }
    | {
        type: 'UPDATE_TRACK';
        payload: {
            before: Track;
            after: Track;
        }
    }
    | {
        type: 'ADD_CLIP';
        payload: {
            clip: Clip
        }
    }
    | {
        type: 'REMOVE_CLIP';
        payload: {
            clip: Clip
        }
    }
    | {
        type: 'UPDATE_CLIP';
        payload: {
            before: Clip; after: Clip
        }
    }
    | {
        type: 'RESET';
        payload: {
            tracks: Track[]; clips: Clip[]
        }
    }
    | {
        type: 'BATCH';
        payload: {
            commands: Command[]
        }
    }

export type HistoryState = {
    past: Command[]
    present: { tracks: Track[]; clips: Clip[] }
    future: Command[]
}

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'