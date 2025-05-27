import { HistoryState, Tool, ToolPanel } from "@/types/editor"

import UploadToolPanel from "@/components/editor/panels/UploadToolPanel"
import TextToolPanel from "@/components/editor/panels/TextToolPanel"
import AssetsToolPanel from "@/components/editor/panels/AssetsToolPanel"
import StickersToolPanel from "@/components/editor/panels/StickersToolPanel"
import VoiceoverToolPanel from "@/components/editor/panels/VoiceoverToolPanel"
import CaptionsToolPanel from "@/components/editor/panels/CaptionsToolPanel"
import AutoCutToolPanel from "@/components/editor/panels/AutoCutToolPanel"

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
        label: 'Voiceover',
        icon: '/assets/icons/voiceover.png',
        aiTool: true,
    },
    // {
    //     label: 'Captions',
    //     icon: '/assets/icons/captions.png',
    //     aiTool: true,
    // },
    {
        label: 'AI Pilot',
        icon: '/assets/icons/scissors.png',
        aiTool: true,
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
        label: 'Voiceover',
        component: VoiceoverToolPanel
    },
    {
        label: 'Captions',
        component: CaptionsToolPanel
    },
    {
        label: 'AI Pilot',
        component: AutoCutToolPanel
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

// Base time scale (pixels per millisecond)
export const BASE_TIME_SCALE = 0.1

// Function to calculate time scale based on zoom level
export const getTimeScale = (zoomLevel: number) => BASE_TIME_SCALE * zoomLevel