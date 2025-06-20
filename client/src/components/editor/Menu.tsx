import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, Redo2, Undo2, Edit2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import SaveStatusIndicator from './SaveStatusIndicator'
import ShareButton from './ShareButton'
import { useRouter } from 'next/navigation'

const Menu = () => {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [editedName, setEditedName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const {
        project,
        undo,
        redo,
        canUndo,
        canRedo,
        updateProjectName
    } = useEditor()

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleTitleClick = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }
        if (!project) return
        
        setEditedName(project.name)
        setIsEditing(true)
    }

    const handleSave = async () => {
        if (!project || editedName.trim() === project.name) {
            setIsEditing(false)
            return
        }

        const trimmedName = editedName.trim()
        if (!trimmedName) {
            setEditedName(project.name)
            setIsEditing(false)
            return
        }

        try {
            await updateProjectName(trimmedName)
            setIsEditing(false)
        } catch (error) {
            console.error('Failed to update project name:', error)
            // Revert to original name on error
            setEditedName(project.name)
            setIsEditing(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
        } else if (e.key === 'Escape') {
            setEditedName(project?.name || '')
            setIsEditing(false)
        }
    }

    return (
        <div
            className="
                flex flex-row items-center justify-between w-full 
                px-6 py-3
                bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-500 text-white
                border-b border-indigo-400/20
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
                
                {/* Project Title - Editable */}
                <div className="flex items-center gap-2 group" data-project-name-editor>
                    {isEditing ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={handleKeyDown}
                            className="
                                text-xl font-bold bg-transparent border-b-2 border-white/50
                                focus:border-white focus:outline-none
                                text-white placeholder-white/70
                                min-w-[200px] max-w-[400px]
                            "
                            placeholder="Project name..."
                        />
                    ) : (
                        <div 
                            onClick={handleTitleClick}
                            onMouseDown={(e) => e.preventDefault()}
                            className="
                                text-xl font-bold cursor-pointer 
                                hover:bg-white/10 rounded px-2 py-1 -mx-2 -my-1
                                transition-colors duration-200
                                flex items-center gap-2
                                select-none
                                min-h-[32px]
                            "
                            role="button"
                            tabIndex={0}
                        >
                            {project?.name || 'Untitled Project'}
                            <Edit2 size={16} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                        </div>
                    )}
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