import React, { useState, useEffect, useRef } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { 
    FileText, 
    Save, 
    Check, 
    Bold, 
    Italic, 
    List, 
    Hash, 
    Clock,
    Type,
    Calendar,
    ChevronDown,
    ChevronRight
} from 'lucide-react'

interface NotesPanelProps {
    className?: string
}

const NotesPanel: React.FC<NotesPanelProps> = ({ className = '' }) => {
    const { project, updateProjectNotes } = useEditor()
    const [notes, setNotes] = useState<string>(project?.notes || '')
    const [isSaving, setIsSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [showFormatting, setShowFormatting] = useState(false)
    const [wordCount, setWordCount] = useState(0)
    const [charCount, setCharCount] = useState(0)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Update local notes when project notes change
    useEffect(() => {
        setNotes(project?.notes || '')
    }, [project?.notes])

    // Update word and character count
    useEffect(() => {
        const words = notes.trim() === '' ? 0 : notes.trim().split(/\s+/).length
        setWordCount(words)
        setCharCount(notes.length)
    }, [notes])

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

    // Insert text at cursor position
    const insertTextAtCursor = (textToInsert: string) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = notes.substring(0, start) + textToInsert + notes.substring(end)
        
        setNotes(newValue)
        
        // Set cursor position after inserted text
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length)
        }, 0)
    }

    // Formatting helpers
    const insertTimestamp = () => {
        const timestamp = new Date().toLocaleString()
        insertTextAtCursor(`[${timestamp}] `)
    }

    const insertBold = () => {
        insertTextAtCursor('**bold text**')
    }

    const insertItalic = () => {
        insertTextAtCursor('*italic text*')
    }

    const insertBulletList = () => {
        insertTextAtCursor('\n• ')
    }

    const insertNumberedList = () => {
        insertTextAtCursor('\n1. ')
    }

    const insertHeader = () => {
        insertTextAtCursor('\n## Header\n')
    }

    const insertSeparator = () => {
        insertTextAtCursor('\n---\n')
    }

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault()
                    debouncedSave(notes)
                    break
                case 'b':
                    e.preventDefault()
                    insertBold()
                    break
                case 'i':
                    e.preventDefault()
                    insertItalic()
                    break
                case 't':
                    e.preventDefault()
                    insertTimestamp()
                    break
            }
        }
        
        // Tab for indentation
        if (e.key === 'Tab') {
            e.preventDefault()
            insertTextAtCursor('    ')
        }
    }

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Notes Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-black opacity-70" />
                    <h2 className="text-sm font-medium text-black opacity-80">
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
                        <div className="flex items-center gap-1 text-xs text-green-600">
                            <Check className="w-3 h-3" />
                            <span>Saved</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Formatting Toolbar */}
            <div className="border-b border-gray-100">
                <button
                    onClick={() => setShowFormatting(!showFormatting)}
                    className="w-full flex items-center justify-between p-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <span className="flex items-center gap-1">
                        <Type className="w-3 h-3" />
                        Formatting Tools
                    </span>
                    {showFormatting ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                
                {showFormatting && (
                    <div className="p-2 bg-gray-50/50 border-t border-gray-100">
                        <div className="grid grid-cols-4 gap-1">
                            <button
                                onClick={insertBold}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                                title="Bold (Ctrl+B)"
                            >
                                <Bold className="w-3 h-3 text-gray-600" />
                            </button>
                            <button
                                onClick={insertItalic}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                                title="Italic (Ctrl+I)"
                            >
                                <Italic className="w-3 h-3 text-gray-600" />
                            </button>
                            <button
                                onClick={insertHeader}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                                title="Header"
                            >
                                <Hash className="w-3 h-3 text-gray-600" />
                            </button>
                            <button
                                onClick={insertTimestamp}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                                title="Timestamp (Ctrl+T)"
                            >
                                <Clock className="w-3 h-3 text-gray-600" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mt-1">
                            <button
                                onClick={insertBulletList}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors text-xs text-gray-600"
                                title="Bullet List"
                            >
                                <List className="w-3 h-3" />
                            </button>
                            <button
                                onClick={insertSeparator}
                                className="p-1.5 rounded hover:bg-gray-200 transition-colors text-xs text-gray-600"
                                title="Separator"
                            >
                                ---
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Notes Input Area */}
            <div className="flex-1 p-3 overflow-hidden">
                <textarea
                    ref={textareaRef}
                    value={notes}
                    onChange={handleNotesChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Start writing your notes...

Tips:
• Use **bold** and *italic* for emphasis
• Press Ctrl+T for timestamps
• Press Tab for indentation
• Use ## for headers
• Use --- for separators"
                    className="w-full h-full resize-none bg-transparent border-none outline-none 
                             text-sm text-black opacity-80
                             placeholder-gray-400
                             leading-relaxed
                             font-mono"
                    style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Liberation Mono", Menlo, monospace'
                    }}
                />
            </div>

            {/* Footer with stats and shortcuts */}
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                        <span>{wordCount} words</span>
                        <span>{charCount} chars</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>Auto-saves</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NotesPanel 