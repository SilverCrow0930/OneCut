import React from 'react'
import { ChevronLeft, Redo2, Undo2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import SaveStatusIndicator from './SaveStatusIndicator'

const Menu = () => {
    const { project } = useEditor()
    return (
        <div className="
            flex flex-row items-center w-full 
            px-6 py-4 gap-6 
            bg-blue-400 text-white
        ">
            <ChevronLeft
                className="cursor-pointer"
                onClick={() => { }}
            />
            <p className="text-xl font-bold">
                {project?.name}
            </p>
            <div className="flex flex-row items-center gap-3 mb-[2px]">
                <Undo2
                    onClick={() => { }}
                    size={24}
                />
                <Redo2
                    onClick={() => { }}
                    size={24}
                />
            </div>
            <div className="flex flex-row items-center gap-3">
                <SaveStatusIndicator />
            </div>
        </div>
    )
}

export default Menu