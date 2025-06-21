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

    const handleBackClick = (e: React.MouseEvent) => {
        console.log('Back button clicked') // Debug log
        e.preventDefault()
        e.stopPropagation()
        router.push('/creation')
    }

    const handleTitleClick = (e: React.MouseEvent) => {
        console.log('Title clicked') // Debug log
        e.preventDefault()
        e.stopPropagation()
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
        } else if (e.key === 'Escape') {
            setEditedName(project?.name || '')
            setIsEditing(false)
        }
    }

    const handleUndoClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (canUndo) {
            undo()
        }
    }

    const handleRedoClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (canRedo) {
            redo()
        }
    }

    // Prevent all menu events from bubbling
    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return (
        <div
            className="
                flex flex-row items-center justify-between w-full 
                px-4 py-2
                text-white
                border-b border-indigo-400/20
                relative z-50
            "
            style={{ background: 'linear-gradient(to right, #607eff, #6eb3f8)' }}
            data-menu-area
            onClick={handleMenuClick}
            onMouseDown={handleMenuClick}
        >
            <div className="
                flex flex-row items-center w-full gap-4
            ">
                <ChevronLeft
                    className="cursor-pointer hover:bg-white/10 p-1 rounded transition-colors"
                    size={24}
                    onClick={handleBackClick}
                />
                
                {/* Project Title - Editable */}
                <div className="flex items-center gap-2 group" data-project-name-editor>
                    {isEditing ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={editedName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedName(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={handleKeyDown}
                            onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                            onMouseDown={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                            className="
                                text-lg font-bold bg-transparent border-b-2 border-white/50
                                focus:border-white focus:outline-none
                                text-white placeholder-white/70
                                min-w-[200px] max-w-[400px]
                            "
                            placeholder="Project name..."
                        />
                    ) : (
                        <div 
                            onClick={handleTitleClick}
                            onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => e.preventDefault()}
                            className="
                                text-lg font-bold cursor-pointer 
                                hover:bg-white/10 rounded px-2 py-1 -mx-2 -my-1
                                transition-colors duration-200
                                flex items-center gap-2
                                select-none
                                min-h-[28px]
                            "
                            role="button"
                            tabIndex={0}
                        >
                            {project?.name || 'Untitled Project'}
                            <Edit2 size={16} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                        </div>
                    )}
                </div>

                <div className="flex flex-row items-center gap-4">
                    <SaveStatusIndicator />
                    
                    {/* Undo/Redo buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleUndoClick}
                            disabled={!canUndo}
                            className={`
                                p-1.5 rounded-md transition-all duration-200
                                ${canUndo 
                                    ? 'hover:bg-white/10 text-white' 
                                    : 'text-white/40 cursor-not-allowed'
                                }
                            `}
                            title="Undo"
                        >
                            <Undo2 size={22} />
                        </button>
                        
                        <button
                            onClick={handleRedoClick}
                            disabled={!canRedo}
                            className={`
                                p-1.5 rounded-md transition-all duration-200
                                ${canRedo 
                                    ? 'hover:bg-white/10 text-white' 
                                    : 'text-white/40 cursor-not-allowed'
                                }
                            `}
                            title="Redo"
                        >
                            <Redo2 size={22} />
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