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

    const handleTitleClick = () => {
        console.log('Title clicked!', project) // Debug log
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
                bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                border-b border-indigo-400/20
            "
        >
            {/* Left section - Back arrow gets its own space */}
            <div className="flex items-center">
                <ChevronLeft
                    size={36}
                    className="cursor-pointer hover:bg-white/10 rounded p-2 transition-colors flex-shrink-0"
                    onClick={() => {
                        router.push(`/creation`)
                    }}
                />
            </div>

            {/* Center section - Project title and controls */}
            <div className="flex items-center gap-6 flex-1 justify-center">
                {/* Project Title - Editable */}
                <div className="flex items-center gap-2 group">
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
                        <button 
                            onClick={handleTitleClick}
                            className="
                                text-xl font-bold cursor-pointer 
                                hover:bg-white/10 rounded px-3 py-2 -mx-3 -my-2
                                transition-all duration-200
                                flex items-center gap-2
                                border-2 border-transparent hover:border-white/20
                            "
                            title="Click to edit project name"
                        >
                            <span>{project?.name || 'Untitled Project'}</span>
                            <Edit2 size={16} className="opacity-0 group-hover:opacity-70 transition-opacity" />
                        </button>
                    )}
                </div>

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

            {/* Right section - Share button */}
            <div className="flex flex-row items-center gap-3">
                <ShareButton />
            </div>
        </div>
    )
}

export default Menu