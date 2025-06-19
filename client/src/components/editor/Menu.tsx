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
        canRedo,
    } = useEditor()

    return (
        <div
            className="
                flex flex-row items-center justify-between w-full 
                px-6 py-3
                bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                border-b border-indigo-400/20
            "
        >
            <div className="
                flex flex-row items-center w-full gap-6
            ">
                <ChevronLeft
                    size={32}
                    className="cursor-pointer hover:bg-white/10 rounded p-2 transition-colors"
                    onClick={() => {
                        router.push(`/creation`)
                    }}
                />
                
                <div className="text-xl font-bold">
                    {project?.name || 'Untitled Project'}
                </div>

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
                <div className="flex flex-row items-center gap-6">
                    <SaveStatusIndicator />
                    
                    {/* Undo/Redo buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={undo}
                            disabled={!canUndo}
                            className={`
                                p-2 rounded-md transition-all duration-200
                                ${canUndo 
                                    ? 'hover:bg-white/10 text-white' 
                                    : 'text-white/40 cursor-not-allowed'
                                }
                            `}
                            title="Undo"
                        >
                            <Undo2 size={28} />
                        </button>
                        
                        <button
                            onClick={redo}
                            disabled={!canRedo}
                            className={`
                                p-2 rounded-md transition-all duration-200
                                ${canRedo 
                                    ? 'hover:bg-white/10 text-white' 
                                    : 'text-white/40 cursor-not-allowed'
                                }
                            `}
                            title="Redo"
                        >
                            <Redo2 size={28} />
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex flex-row items-center gap-3">
                <ShareButton />
            </div>
        </div>
    )
}

export default Menu