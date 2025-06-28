import React, { useState } from 'react'
import UploadToolPanel from './panels/UploadToolPanel'
import TextToolPanel from './panels/TextToolPanel'
import AssetsToolPanel from './panels/AssetsToolPanel'
import StickersToolPanel from './panels/StickersToolPanel'
import VoiceoverToolPanel from './panels/VoiceoverToolPanel'
import CaptionsToolPanel from './panels/CaptionsToolPanel'
import AutoCutToolPanel from './panels/AutoCutToolPanel'
import AIGenerationToolPanel from './panels/AIGenerationToolPanel'
import TransitionsToolPanel from './panels/TransitionsToolPanel'
import { useEditor } from '@/contexts/EditorContext'

const toolComponents: { [key: string]: React.ComponentType<any> } = {
    Upload: UploadToolPanel,
    Text: TextToolPanel,
    Assets: AssetsToolPanel,
    Stickers: StickersToolPanel,
    Voiceover: VoiceoverToolPanel,
    Captions: CaptionsToolPanel,
    'Smart Cut': AutoCutToolPanel,
    Generation: AIGenerationToolPanel,
    Transitions: TransitionsToolPanel,
}

const ToolPanel = () => {
    const { selectedTool } = useEditor()
    const [highlightedAssetId, setHighlightedAssetId] = useState<string | null>(null)
    const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null)

    // Custom wrapper for AssetsToolPanel to pass state setters
    const renderAssetsPanel = () => (
        <AssetsToolPanel
            setHighlightedAssetId={setHighlightedAssetId}
            setUploadingAssetId={setUploadingAssetId}
        />
    )

    // Custom wrapper for UploadToolPanel to pass highlight/uploading state
    const renderUploadPanel = () => (
        <UploadToolPanel
            highlightedAssetId={highlightedAssetId}
            uploadingAssetId={uploadingAssetId}
        />
    )

    let ToolComponent: React.ReactNode = null
    if (selectedTool === 'Assets') {
        ToolComponent = renderAssetsPanel()
    } else if (selectedTool === 'Upload') {
        ToolComponent = renderUploadPanel()
    } else if (selectedTool && toolComponents[selectedTool]) {
        ToolComponent = React.createElement(toolComponents[selectedTool])
    }

    return (
        <div className="
            flex flex-col w-full h-full
            p-2 rounded-lg overflow-hidden
        " data-tool-panel>
            <div className="flex-1 overflow-y-auto">
                {
                    ToolComponent ?
                        ToolComponent :
                        <div className='flex flex-col w-full h-full items-center justify-center p-4'>
                            <div className="flex flex-col items-center gap-3 text-center">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center">
                                    <div className="text-xl">🛠️</div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-semibold text-gray-700">Choose a Tool</h3>
                                    <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                                        Select a tool from the sidebar to start creating amazing content
                                    </p>
                                </div>
                            </div>
                        </div>
                }
            </div>
        </div>
    )
}

export default ToolPanel