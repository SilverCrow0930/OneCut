import React, { useState, useRef, useEffect } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'
import { Plus, Type, Sparkles, Wand2, RefreshCw } from 'lucide-react'
import TextStyleSelector, { stylePresets } from './text/TextStyleSelector'
import PanelHeader from './PanelHeader'
import { apiPath } from '@/lib/config'

export default function TextToolPanel() {
    const [text, setText] = useState('')
    const [selectedStyleIdx, setSelectedStyleIdx] = useState(0)
    const [useAIStyle, setUseAIStyle] = useState(false)
    const [stylePrompt, setStylePrompt] = useState('')
    const [aiGeneratedStyle, setAiGeneratedStyle] = useState<any>(null)
    const [isGeneratingStyle, setIsGeneratingStyle] = useState(false)
    const [styleError, setStyleError] = useState<string | null>(null)
    
    const { tracks, executeCommand, selectedClipId, clips } = useEditor()
    const { session } = useAuth()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Find the selected text clip if we're editing
    const selectedClip = clips.find(clip => clip.id === selectedClipId && clip.type === 'text')

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
        }

        // Reset the form if we're not editing
        if (!selectedClip) {
            setText('')
            setStylePrompt('')
            setAiGeneratedStyle(null)
        }
    }

    return (
        <div className="flex flex-col gap-6 p-4 bg-white rounded-lg" data-text-tool-panel>
            <PanelHeader icon={Type} title={selectedClip ? "Edit Text" : "Add Text"} />
            <div className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="text" className="block text-base font-medium text-black/50">
                        Content
                    </label>
                    <textarea
                        ref={textareaRef}
                        id="text"
                        value={text}
                        onChange={handleTextChange}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="Enter your text here"
                        className="
                            w-full px-4 py-4 text-base border border-gray-200 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                            transition-all duration-200 placeholder:text-black/50 overflow-hidden
                            resize-none text-black/50
                        "
                    />
                </div>

                {/* Style Selection Toggle */}
                <div className="space-y-3">
                    <label className="block text-base font-medium text-black/50">
                        Style
                    </label>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                        <button
                            onClick={() => setUseAIStyle(false)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
                                !useAIStyle ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Type size={16} />
                            <span className="text-sm font-medium">Presets</span>
                        </button>
                        <button
                            onClick={() => setUseAIStyle(true)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all duration-200 ${
                                useAIStyle ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Sparkles size={16} />
                            <span className="text-sm font-medium">AI Style</span>
                        </button>
                    </div>
                </div>

                {/* Preset Styles */}
                {!useAIStyle && (
                    <TextStyleSelector
                        selectedStyleIdx={selectedStyleIdx}
                        setSelectedStyleIdx={setSelectedStyleIdx}
                    />
                )}

                {/* AI Style Generator */}
                {useAIStyle && (
                    <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                            <Wand2 size={16} className="text-blue-600" />
                            <h6 className="font-semibold text-blue-700">AI Style Generator</h6>
                        </div>
                        
                        <div className="space-y-3">
                            <textarea
                                value={stylePrompt}
                                onChange={(e) => setStylePrompt(e.target.value)}
                                placeholder="Describe your desired style... e.g., 'Bold neon cyberpunk style with glowing edges' or 'Elegant gold text with shadow for luxury brand'"
                                className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                            />
                            
                            <button
                                onClick={generateAIStyle}
                                disabled={!stylePrompt.trim() || isGeneratingStyle}
                                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                {isGeneratingStyle ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        Generate Style
                                    </>
                                )}
                            </button>

                            {styleError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-600">{styleError}</p>
                                </div>
                            )}

                            {/* Style Preview */}
                            {aiGeneratedStyle && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Preview</label>
                                    <div className="p-4 bg-black rounded-lg">
                                        <div
                                            style={aiGeneratedStyle}
                                            className="text-center"
                                        >
                                            {text || 'Sample Text'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Live Preview */}
                {(text || (!useAIStyle || aiGeneratedStyle)) && (
                    <div className="space-y-2">
                        <label className="block text-base font-medium text-black/50">
                            Preview
                        </label>
                        <div className="p-4 bg-black rounded-lg">
                            <div
                                style={getCurrentStyle()}
                                className="text-center"
                            >
                                {text || 'Sample Text'}
                            </div>
                        </div>
                    </div>
                )}
                
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleAddOrUpdateText();
                    }}
                    disabled={!text.trim() || (useAIStyle && !aiGeneratedStyle)}
                    className="
                        flex items-center justify-center w-full gap-2 px-4 py-3 
                        text-base font-medium text-white bg-blue-600 rounded-lg 
                        hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        disabled:opacity-50 disabled:cursor-not-allowed 
                        transition-all duration-200 shadow-sm hover:shadow-md
                    "
                >
                    {selectedClip ? (
                        "Apply Edit"
                    ) : (
                        <>
                            <Plus className="w-6 h-6" />
                            Add Text Clip
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}