import React, { useState, useRef, useEffect } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'
import { Plus, Type } from 'lucide-react'
import TextStyleSelector, { stylePresets } from './text/TextStyleSelector'
import PanelHeader from './PanelHeader'

export default function TextToolPanel() {
    const [text, setText] = useState('')
    const [selectedStyleIdx, setSelectedStyleIdx] = useState(0)
    const { tracks, executeCommand, selectedClipId, clips } = useEditor()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Find the selected text clip if we're editing
    const selectedClip = clips.find(clip => clip.id === selectedClipId && clip.type === 'text')

    // Update text and style when a clip is selected
    useEffect(() => {
        if (selectedClip?.properties) {
            const textProperties = selectedClip.properties as { text: string; style: any }
            setText(textProperties.text)
            // Find the matching style preset
            const styleIdx = stylePresets.findIndex(preset =>
                JSON.stringify(preset.style) === JSON.stringify(textProperties.style)
            )
            if (styleIdx !== -1) {
                setSelectedStyleIdx(styleIdx)
            }
        } else {
            // Reset when no clip is selected
            setText('')
            setSelectedStyleIdx(0)
        }
    }, [selectedClipId])

    const adjustTextareaHeight = () => {
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = `${textarea.scrollHeight}px`
        }
    }

    useEffect(() => {
        adjustTextareaHeight()
    }, [text])

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setText(e.target.value)
    }

    const handleAddOrUpdateText = () => {
        if (!text.trim()) return

        if (selectedClip) {
            // Update existing clip
            executeCommand({
                type: 'UPDATE_CLIP',
                payload: {
                    before: selectedClip,
                    after: {
                        ...selectedClip,
                        properties: {
                            ...selectedClip.properties,
                            text: text.trim(),
                            style: {
                                ...stylePresets[selectedStyleIdx].style,
                                fontSize: 20, // Ensure font size is always 20 when editing
                            },
                        }
                    }
                }
            })
        } else {
            // Create a new text track at index 0
            const newTrack = {
                id: uuid(),
                projectId: projectId!,
                index: 0, // Insert at the beginning
                type: 'text' as TrackType,
                createdAt: new Date().toISOString(),
            }

            // Default duration is 5 seconds
            const duration = 5

            // Create the text clip
            const textClip = {
                id: uuid(),
                trackId: newTrack.id,
                type: 'text' as const,
                sourceStartMs: 0,
                sourceEndMs: duration * 1000,
                timelineStartMs: 0, // Start at the beginning
                timelineEndMs: duration * 1000,
                assetDurationMs: duration * 1000,
                volume: 1,
                speed: 1,
                properties: {
                    text: text.trim(),
                    style: {
                        ...stylePresets[selectedStyleIdx].style,
                        fontSize: 20, // Smaller default font size for new clips
                    },
                },
                createdAt: new Date().toISOString(),
            }

            // Create commands to:
            // 1. Shift all existing tracks down
            // 2. Add the new track
            // 3. Add the text clip
            const commands = [
                // First shift all existing tracks down
                ...tracks.map(track => ({
                    type: 'UPDATE_TRACK' as const,
                    payload: {
                        before: track,
                        after: {
                            ...track,
                            index: track.index + 1
                        }
                    }
                })),
                // Then add the new track
                {
                    type: 'ADD_TRACK' as const,
                    payload: { track: newTrack }
                },
                // Finally add the text clip
                {
                    type: 'ADD_CLIP' as const,
                    payload: { clip: textClip }
                }
            ]

            // Execute all commands in a single batch
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })
        }

        // Reset the form if we're not editing
        if (!selectedClip) {
            setText('')
        }
    }

    return (
        <div className="flex flex-col gap-6 p-4 bg-white rounded-lg" data-text-tool-panel>
            <PanelHeader icon={Type} title={selectedClip ? "Edit Text" : "Add Text"} />
            <div className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="text" className="block text-sm font-medium text-gray-700">
                        Content
                    </label>
                    <textarea
                        ref={textareaRef}
                        id="text"
                        value={text}
                        onChange={handleTextChange}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="Enter your text here..."
                        className="
                            w-full px-4 py-4 text-sm border border-gray-200 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                            transition-all duration-200 placeholder:text-gray-400 overflow-hidden
                            resize-none
                        "
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Style
                    </label>
                    <TextStyleSelector
                        selectedStyleIdx={selectedStyleIdx}
                        setSelectedStyleIdx={setSelectedStyleIdx}
                    />
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleAddOrUpdateText();
                    }}
                    disabled={!text.trim()}
                    className="
                        flex items-center justify-center w-full gap-2 px-4 py-3 
                        text-sm font-medium text-white bg-blue-600 rounded-lg 
                        hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        disabled:opacity-50 disabled:cursor-not-allowed 
                        transition-all duration-200 shadow-sm hover:shadow-md
                    "
                >
                    {selectedClip ? (
                        "Apply Edit"
                    ) : (
                        <>
                            <Plus className="w-4 h-4" />
                            Add Text Clip
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}