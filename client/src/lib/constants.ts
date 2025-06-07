import { HistoryState, Tool, ToolPanel } from "@/types/editor"

import UploadToolPanel from "@/components/editor/panels/UploadToolPanel"
import TextToolPanel from "@/components/editor/panels/TextToolPanel"
import AssetsToolPanel from "@/components/editor/panels/AssetsToolPanel"
import StickersToolPanel from "@/components/editor/panels/StickersToolPanel"
import VoiceoverToolPanel from "@/components/editor/panels/VoiceoverToolPanel"
import CaptionsToolPanel from "@/components/editor/panels/CaptionsToolPanel"
import AutoCutToolPanel from "@/components/editor/panels/AutoCutToolPanel"
import AIGenerationToolPanel from "@/components/editor/panels/AIGenerationToolPanel"
import TransitionsToolPanel from "@/components/editor/panels/TransitionsToolPanel"

export const TOOLS: Tool[] = [
    {
        label: 'Upload',
        icon: '/assets/icons/upload.png',
        aiTool: false,
    },
    {
        label: 'Text',
        icon: '/assets/icons/text.png',
        aiTool: false,
    },
    {
        label: 'Assets',
        icon: '/assets/icons/assets.png',
        aiTool: false,
    },
    {
        label: 'Stickers',
        icon: '/assets/icons/stickers.png',
        aiTool: false,
    },
    {
        label: 'Autocut',
        icon: '/assets/icons/scissors.png',
        aiTool: true,
    },
    {
        label: 'Generation',
        icon: '/assets/icons/generation.png',
        aiTool: true,
    },
    {
        label: 'Voiceover',
        icon: '/assets/icons/voiceover.png',
        aiTool: true,
    },
    {
        label: 'Captions',
        icon: '/assets/icons/captions.png',
        aiTool: true,
    },
    {
        label: 'Transitions',
        icon: '/assets/icons/animation.png',
        aiTool: false,
    }
]

export const TOOL_PANELS: ToolPanel[] = [
    {
        label: 'Upload',
        component: UploadToolPanel
    },
    {
        label: 'Text',
        component: TextToolPanel
    },
    {
        label: 'Assets',
        component: AssetsToolPanel
    },
    {
        label: 'Stickers',
        component: StickersToolPanel
    },
    {
        label: 'Autocut',
        component: AutoCutToolPanel
    },
    {
        label: 'Generation',
        component: AIGenerationToolPanel
    },
    {
        label: 'Voiceover',
        component: VoiceoverToolPanel
    },
    {
        label: 'Captions',
        component: CaptionsToolPanel
    },
    {
        label: 'Transitions',
        component: TransitionsToolPanel
    }
]

export const initialHistory: HistoryState = {
    past: [],
    present: {
        tracks: [],
        clips: []
    },
    future: [],
}

// Base time scale (pixels per millisecond) - adjusted for 30 second intervals at 100% zoom
export const BASE_TIME_SCALE = 0.00333 // Reduced from 0.01 to show 30 second intervals instead of 10 seconds

// Function to calculate time scale based on zoom level
export const getTimeScale = (zoomLevel: number) => BASE_TIME_SCALE * zoomLevel

// If there is a zoom level array or max zoom constant, increase it to allow higher zooms (e.g., 400%)
// Example (add or update as needed):
export const MAX_ZOOM_LEVEL = 10; // 1000%

// Default durations for media types (in milliseconds)
export const DEFAULT_MEDIA_DURATIONS = {
    IMAGE: 5000,      // 5 seconds for static images
    GIF: 3000,        // 3 seconds for GIFs and stickers
    VIDEO: 10000,     // 10 seconds for video clips
    AUDIO: null       // Audio uses its actual duration
} as const