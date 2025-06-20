import React, { useState, useEffect, useRef } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { FileText, Save, Check } from 'lucide-react'

interface NotesPanelProps {
    className?: string
}

const NotesPanel: React.FC<NotesPanelProps> = ({ className = '' }) => {
    const { project, updateProjectNotes } = useEditor()
    const [notes, setNotes] = useState<string>(project?.notes || '')
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Update local notes when project notes change
    useEffect(() => {
        setNotes(project?.notes || '')
    }, [project?.notes])

    // Auto-save debounced function
    const debouncedSave = async (value: string) => {
        if (value === project?.notes) return // No changes to save

        setIsSaving(true)
        try {
            await updateProjectNotes(value)
            setLastSaved(new Date())
        } catch (error) {
            console.error('Failed to save notes:', error)
        } finally {
            setIsSaving(false)
        }
    }

    // Handle notes change with auto-save
    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value
        setNotes(value)

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        // Set new timeout for auto-save (1 second delay)
        saveTimeoutRef.current = setTimeout(() => {
            debouncedSave(value)
        }, 1000)
    }

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [])

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 's') {
                e.preventDefault()
                debouncedSave(notes)
            }
        }
    }

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Notes Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Project Notes
                    </h2>
                </div>
                
                <div className="flex items-center gap-2">
                    {isSaving && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Save className="w-3 h-3 animate-pulse" />
                            <span>Saving...</span>
                        </div>
                    )}
                    {lastSaved && !isSaving && (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <Check className="w-3 h-3" />
                            <span>Saved {lastSaved.toLocaleTimeString()}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Notes Input Area */}
            <div className="flex-1 p-4">
                <textarea
                    ref={textareaRef}
                    value={notes}
                    onChange={handleNotesChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Write your project notes here... 

✨ Tips:
• Jot down creative ideas and script thoughts
• Note timestamps for key moments
• Keep track of editing goals and priorities
• Use this space for any project-related notes

Ctrl/Cmd + S to save manually"
                    className="w-full h-full resize-none bg-transparent border-none outline-none 
                             text-sm text-gray-900 dark:text-gray-100 
                             placeholder-gray-500 dark:placeholder-gray-400
                             leading-relaxed
                             font-mono"
                    style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Liberation Mono", Menlo, monospace'
                    }}
                />
            </div>

            {/* Footer with helpful shortcuts */}
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Auto-saves after 1 second • Press Ctrl/Cmd + S to save manually
                </p>
            </div>
        </div>
    )
}

export default NotesPanel 