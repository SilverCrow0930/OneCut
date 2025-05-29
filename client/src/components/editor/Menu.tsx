import React from 'react'
import { ChevronLeft, Redo2, Undo2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import SaveStatusIndicator from './SaveStatusIndicator'
import ShareButton from './ShareButton'
import { useRouter } from 'next/navigation'

const Menu = () => {
    const router = useRouter()

    const {
        project,
        undo,
        redo,
        canUndo,
        canRedo
    } = useEditor()

    return (
        <div
            className="
                flex flex-row items-center justify-between w-full 
                px-6 py-3
                bg-blue-400 text-white
            "
        >
            <div className="
                flex flex-row items-center w-full gap-6
            ">
                <ChevronLeft
                    className="cursor-pointer"
                    onClick={() => {
                        router.push(`/creation`)
                    }}
                />
                <p className="text-xl font-bold">
                    {project?.name}
                </p>
                {/* <div className="flex flex-row items-center gap-3 mb-[2px]">
                    <Undo2
                        onClick={undo}
                        size={24}
                        className={`cursor-pointer ${!canUndo ? 'opacity-50' : ''}`}
                    />
                    <Redo2
                        onClick={redo}
                        size={24}
                        className={`cursor-pointer ${!canRedo ? 'opacity-50' : ''}`}
                    />
                </div> */}
                <div className="flex flex-row items-center gap-3">
                    <SaveStatusIndicator />
                </div>
            </div>
            <div className="flex flex-row items-center gap-3">
                <ShareButton />
            </div>
        </div>
    )
}

export default Menu