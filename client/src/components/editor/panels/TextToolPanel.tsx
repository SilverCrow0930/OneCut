import React, { useState } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'
import { Plus, Type } from 'lucide-react'

export default function TextToolPanel() {
    const [text, setText] = useState('')
    const [duration, setDuration] = useState(3) // Default duration in seconds
    const { tracks, executeCommand } = useEditor()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

    const handleAddText = () => {
        if (!text.trim()) return

        // Create a new text track at index 0
        const newTrack = {
            id: uuid(),
            projectId: projectId!,
            index: 0, // Insert at the beginning
            type: 'video' as TrackType,
            createdAt: new Date().toISOString(),
        }

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
                text: text.trim()
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

        // Reset the form
        setText('')
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Type className="w-4 h-4" />
                <span>Add Text</span>
            </div>

            <div className="space-y-4">
                <div>
                    <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-1">
                        Text Content
                    </label>
                    <textarea
                        id="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter your text here..."
                        className="w-full h-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                </div>

                <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (seconds)
                    </label>
                    <input
                        type="number"
                        id="duration"
                        value={duration}
                        onChange={(e) => setDuration(Math.max(1, Math.min(60, Number(e.target.value))))}
                        min="1"
                        max="60"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <button
                    onClick={handleAddText}
                    disabled={!text.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Text Clip
                </button>
            </div>
        </div>
    )
}