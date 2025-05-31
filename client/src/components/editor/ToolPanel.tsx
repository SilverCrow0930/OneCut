import React, { useState } from 'react'
import UploadToolPanel from './panels/UploadToolPanel'
import TextToolPanel from './panels/TextToolPanel'
import AssetsToolPanel from './panels/AssetsToolPanel'
import StickersToolPanel from './panels/StickersToolPanel'
import VoiceoverToolPanel from './panels/VoiceoverToolPanel'
import CaptionsToolPanel from './panels/CaptionsToolPanel'
import AutoCutToolPanel from './panels/AutoCutToolPanel'
import { useEditor } from '@/contexts/EditorContext'

const toolComponents: { [key: string]: React.ComponentType<any> } = {
    Upload: UploadToolPanel,
    Text: TextToolPanel,
    Assets: AssetsToolPanel,
    Stickers: StickersToolPanel,
    Voiceover: VoiceoverToolPanel,
    Captions: CaptionsToolPanel,
    'AI Pilot': AutoCutToolPanel,
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
            p-1
        ">
            {
                ToolComponent ?
                    ToolComponent :
                    <div className='flex flex-col w-full h-full items-center justify-center'>
                        <p className='text-gray-700'>Select a tool to get started</p>
                    </div>
            }
        </div>
    )
}

export default ToolPanel