import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'
import { Plus, Type, Sparkles, Wand2, RefreshCw } from 'lucide-react'
import TextStyleSelector, { stylePresets } from './text/TextStyleSelector'
import PanelHeader from './PanelHeader'
import { apiPath } from '@/lib/config'
import { usePlayback } from '@/contexts/PlaybackContext'

export default function TextToolPanel() {
    const [text, setText] = useState('')
    const [selectedStyleIdx, setSelectedStyleIdx] = useState(0)
    const [useAIStyle, setUseAIStyle] = useState(false)
    const [stylePrompt, setStylePrompt] = useState('')
    const [aiGeneratedStyle, setAiGeneratedStyle] = useState<any>(null)
    const [isGeneratingStyle, setIsGeneratingStyle] = useState(false)
    const [styleError, setStyleError] = useState<string | null>(null)
    const [createNewTrack, setCreateNewTrack] = useState(false)
    
    const { tracks, executeCommand, selectedClipId, clips } = useEditor()
    const { currentTime } = usePlayback()
    const { session } = useAuth()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Find the selected text clip if we're editing
    const selectedClip = clips.find(clip => clip.id === selectedClipId && clip.type === 'text')

    // Find existing text tracks
    const textTracks = useMemo(() => {
        return tracks.filter(track => track.type === 'text')
    }, [tracks])

    // Update text and style when a clip is selected
    useEffect(() => {
        if (selectedClip?.properties) {
            const textProperties = selectedClip.properties as { text: string; style: any; aiStylePrompt?: string }
            setText(textProperties.text)
            
            // Check if this was an AI-generated style
            if (textProperties.aiStylePrompt) {
                setUseAIStyle(true)
                setStylePrompt(textProperties.aiStylePrompt)
                setAiGeneratedStyle(textProperties.style)
            } else {
                setUseAIStyle(false)
                // Find the matching style preset
                const styleIdx = stylePresets.findIndex(preset =>
                    JSON.stringify(preset.style) === JSON.stringify(textProperties.style)
                )
                if (styleIdx !== -1) {
                    setSelectedStyleIdx(styleIdx)
                }
            }
        } else {
            // Reset when no clip is selected
            setText('')
            setSelectedStyleIdx(0)
            setUseAIStyle(false)
            setStylePrompt('')
            setAiGeneratedStyle(null)
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

    const generateAIStyle = async () => {
        if (!stylePrompt.trim() || !session?.access_token) {
            setStyleError('Please enter a style description')
            return
        }

        setIsGeneratingStyle(true)
        setStyleError(null)

        try {
            const url = apiPath('ai/generate-text-style')
            console.log('=== AI STYLE GENERATION DEBUG ===')
            console.log('API URL:', url)
            console.log('Access token available:', !!session?.access_token)
            console.log('Prompt:', stylePrompt.trim())
            console.log('Sample text:', text || 'Sample Text')

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    prompt: stylePrompt.trim(),
                    sampleText: text || 'Sample Text'
                })
            })

            console.log('Response status:', response.status)
            console.log('Response ok:', response.ok)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
                console.error('Response error data:', errorData)
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
            }

            const result = await response.json()
            console.log('Success result:', result)
            setAiGeneratedStyle(result.style)
        } catch (error: any) {
            console.error('AI style generation failed:', error)
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            })
            setStyleError(error.message || 'Failed to generate style')
        } finally {
            setIsGeneratingStyle(false)
        }
    }

    const getCurrentStyle = () => {
        if (useAIStyle && aiGeneratedStyle) {
            return {
                ...aiGeneratedStyle,
                fontSize: 20, // Ensure consistent font size
            }
        }
        return {
            ...stylePresets[selectedStyleIdx].style,
            fontSize: 20,
        }
    }

    const handleAddOrUpdateText = () => {
        if (!text.trim()) return

        const currentStyle = getCurrentStyle()
        const properties: any = {
            text: text.trim(),
            style: currentStyle,
        }

        // Store AI prompt if using AI style
        if (useAIStyle && stylePrompt) {
            properties.aiStylePrompt = stylePrompt
        }

        if (selectedClip) {
            // Update existing clip
            executeCommand({
                type: 'UPDATE_CLIP',
                payload: {
                    before: selectedClip,
                    after: {
                        ...selectedClip,
                        properties
                    }
                }
            })
        } else {
            // Default duration is 5 seconds
            const duration = 5000 // 5 seconds in milliseconds
            const startTime = currentTime * 1000 // Convert seconds to milliseconds

            if (createNewTrack || textTracks.length === 0) {
                // Create a new text track at index 0
                const newTrack = {
                    id: uuid(),
                    projectId: projectId!,
                    index: 0,
                    type: 'text' as TrackType,
                    createdAt: new Date().toISOString(),
                }

                // Create the text clip
                const textClip = {
                    id: uuid(),
                    trackId: newTrack.id,
                    type: 'text' as const,
                    sourceStartMs: 0,
                    sourceEndMs: duration,
                    timelineStartMs: startTime,
                    timelineEndMs: startTime + duration,
                    assetDurationMs: duration,
                    volume: 1,
                    speed: 1,
                    properties,
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
            } else {
                // Use existing text track (use the first one) 
                const existingTrack = textTracks[0];
                
                // Create the text clip on the existing track
                const textClip = {
                    id: uuid(),
                    trackId: existingTrack.id,
                    type: 'text' as const,
                    sourceStartMs: 0,
                    sourceEndMs: duration,
                    timelineStartMs: startTime,
                    timelineEndMs: startTime + duration,
                    assetDurationMs: duration,
                    volume: 1,
                    speed: 1,
                    properties,
                    createdAt: new Date().toISOString(),
                }

                // Add the text clip to the existing track
                executeCommand({
                    type: 'ADD_CLIP',
                    payload: { clip: textClip }
                })
            }
        }

        // Reset the form if we're not editing
        if (!selectedClip) {
            setText('')
            setStylePrompt('')
            setAiGeneratedStyle(null)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-4 bg-white rounded-lg min-h-full" data-text-tool-panel>
            <PanelHeader icon={Type} title={selectedClip ? "Edit Text" : "Add Text"} />
            <div className="space-y-6 flex-1">
                <div className="space-y-2">
                    <label htmlFor="text" className="block text-sm font-medium text-black/50">
                        Text Content
                    </label>
                    <textarea
                        id="text"
                        ref={textareaRef}
                        value={text}
                        onChange={handleTextChange}
                        placeholder="Enter your text here"
                        className="
                            w-full px-4 py-3 text-sm border border-gray-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                            transition-all duration-200 placeholder:text-black/50 overflow-hidden
                            resize-none min-h-[80px]
                        "
                    />
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-medium text-black/50">
                        Style Options
                    </label>
                    
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="styleType"
                                checked={!useAIStyle}
                                onChange={() => setUseAIStyle(false)}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium">Presets</span>
                        </label>
                        
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="styleType"
                                checked={useAIStyle}
                                onChange={() => setUseAIStyle(true)}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium">AI Style</span>
                        </label>
                    </div>
                        
                    {useAIStyle ? (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Describe your desired style
                                </label>
                                <textarea
                                    value={stylePrompt}
                                    onChange={(e) => setStylePrompt(e.target.value)}
                                    placeholder="Bold neon cyberpunk style with glowing edges or Elegant gold text with shadow for luxury brand"
                                    className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                />
                            </div>
                            
                            <button
                                onClick={generateAIStyle}
                                disabled={isGeneratingStyle || !stylePrompt.trim()}
                                className={`
                                    w-full px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                                    ${isGeneratingStyle || !stylePrompt.trim()
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                                    }
                                `}
                            >
                                {isGeneratingStyle ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Generating Style...
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <Wand2 className="w-4 h-4" />
                                        Generate AI Style
                                    </div>
                                )}
                            </button>

                            {styleError && (
                                <p className="text-sm text-red-600">{styleError}</p>
                            )}
                        </div>
                    ) : (
                        <TextStyleSelector selectedStyleIdx={selectedStyleIdx} setSelectedStyleIdx={setSelectedStyleIdx} />
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Preview</label>
                        <div className="bg-gray-900 rounded-lg p-4 min-h-[60px] flex items-center justify-center">
                            <div style={getCurrentStyle()}>
                                {text || 'Your text will appear here'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Track options - simplified */}
                {!selectedClip && textTracks.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-black/50">
                                Track Placement
                            </label>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCreateNewTrack(false)}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2
                                    ${!createNewTrack 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Use Existing
                            </button>
                            <button
                                onClick={() => setCreateNewTrack(true)}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2
                                    ${createNewTrack 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                New Track
                            </button>
                        </div>
                    </div>
                )}
                
                <button
                    onClick={handleAddOrUpdateText}
                    disabled={!text.trim()}
                    className={`
                        w-full px-4 py-3 rounded-lg font-medium transition-all duration-200
                        ${!text.trim()
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95'
                        }
                    `}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        {selectedClip ? 'Update Text' : 'Add Text to Timeline'}
                    </div>
                </button>
            </div>
        </div>
    )
}