import React from 'react'
import UploadToolPanel from './panels/UploadToolPanel'
import TextToolPanel from './panels/TextToolPanel'
import AssetsToolPanel from './panels/AssetsToolPanel'
import StickersToolPanel from './panels/StickersToolPanel'
import VoiceoverToolPanel from './panels/VoiceoverToolPanel'
import CaptionsToolPanel from './panels/CaptionsToolPanel'
import { useEditor } from '@/contexts/EditorContext'

const toolComponents: { [key: string]: React.ComponentType } = {
    Upload: UploadToolPanel,
    Text: TextToolPanel,
    Assets: AssetsToolPanel,
    Stickers: StickersToolPanel,
    Voiceover: VoiceoverToolPanel,
    Captions: CaptionsToolPanel,
}

const ToolPanel = () => {
    const { selectedTool } = useEditor()
    const ToolComponent = selectedTool ? toolComponents[selectedTool] : null

    return (
        <div className="
            flex flex-col w-full h-full
            p-1 border-l-2 border-r-2 border-gray-100
        ">
            {
                ToolComponent ?
                    <ToolComponent /> :
                    <div className='flex flex-col w-full h-full items-center justify-center'>
                        <p className='text-gray-700'>Select a tool to get started</p>
                    </div>
            }
        </div>
    )
}

export default ToolPanel