import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, Redo2, Undo2, Edit2, Camera } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import SaveStatusIndicator from './SaveStatusIndicator'
import ShareButton from './ShareButton'
import { useRouter } from 'next/navigation'

const Menu = () => {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [editedName, setEditedName] = useState('')
    const [generatingThumbnail, setGeneratingThumbnail] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const {
        project,
        undo,
        redo,
        canUndo,
        canRedo,
        updateProjectName,
        generateThumbnail,
        clips
    } = useEditor()

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleTitleClick = () => {
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

    const handleGenerateThumbnail = async () => {
        setGeneratingThumbnail(true)
        try {
            await generateThumbnail()
        } catch (error) {
            console.error('Failed to generate thumbnail:', error)
        } finally {
            setGeneratingThumbnail(false)
        }
    }

    // Check if we have video clips for thumbnail generation
    const hasVideoClips = clips.some(clip => clip.type === 'video' && clip.assetId)

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
                    className="cursor-pointer"
                    onClick={() => {
                        router.push(`/creation`)
                    }}
                />
                
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
                        <div 
                            onClick={handleTitleClick}
                            className="
                                text-xl font-bold cursor-pointer 
                                hover:bg-white/10 rounded px-2 py-1 -mx-2 -my-1
                                transition-colors duration-200
                                flex items-center gap-2
                            "
                        >
                            {project?.name}
                            <Edit2 size={16} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                        </div>
                    )}
                </div>

                {/* Thumbnail Generation Button */}
                {hasVideoClips && (
                    <button
                        onClick={handleGenerateThumbnail}
                        disabled={generatingThumbnail}
                        className="
                            flex items-center gap-2 px-3 py-1.5 rounded-lg
                            bg-white/10 hover:bg-white/20 transition-colors duration-200
                            text-sm font-medium
                            disabled:opacity-50 disabled:cursor-not-allowed
                        "
                        title="Generate project thumbnail"
                    >
                        <Camera size={16} className={generatingThumbnail ? 'animate-pulse' : ''} />
                        {generatingThumbnail ? 'Generating...' : 'Generate Thumbnail'}
                    </button>
                )}

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