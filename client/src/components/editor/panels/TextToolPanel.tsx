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
import { getNextAvailableIndex, shiftTracksForNewTrack } from '@/lib/editor/utils'

export default function TextToolPanel() {
    const { tracks, executeCommand, selectedClipId, clips } = useEditor()
    const { projectId } = useParams<{ projectId: string }>()
    const [text, setText] = useState('')
    const [fontSize, setFontSize] = useState(20)
    const [fontFamily, setFontFamily] = useState('Arial')
    const [color, setColor] = useState('#FFFFFF')
    const [backgroundColor, setBackgroundColor] = useState('rgba(0,0,0,0.8)')
    const [textAlign, setTextAlign] = useState('center')
    const [position, setPosition] = useState('center')
    const [selectedStyleIdx, setSelectedStyleIdx] = useState(0)
    const [useAIStyle, setUseAIStyle] = useState(false)
    const [stylePrompt, setStylePrompt] = useState('')
    const [aiGeneratedStyle, setAiGeneratedStyle] = useState<any>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [styleError, setStyleError] = useState<string | null>(null)
    const [createNewTrack, setCreateNewTrack] = useState(true)
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
    const { session } = useAuth()
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Find the selected text clip if we're editing
    const selectedClip = clips.find(clip => clip.id === selectedClipId && clip.type === 'text')

    // Get available text tracks
    const textTracks = useMemo(() => {
        return tracks.filter(t => t.type === 'text').sort((a, b) => a.index - b.index)
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

        setIsGenerating(true)
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
            setIsGenerating(false)
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

    const handleAddText = () => {
        if (!text.trim()) return

        const properties = {
            text: text.trim(),
            style: {
                fontSize: fontSize,
                fontFamily: fontFamily,
                color: color,
                backgroundColor: backgroundColor,
                textAlign: textAlign,
                position: position
            }
        }

        if (createNewTrack) {
            // Get the next available index for text track
            const newIndex = getNextAvailableIndex(tracks, 'text')

            // Shift tracks if needed
            shiftTracksForNewTrack(tracks, newIndex, executeCommand)

            // Create a new text track
            const newTrack = {
                id: uuid(),
                projectId: projectId!,
                index: newIndex,
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
                timelineStartMs: 0,
                timelineEndMs: duration * 1000,
                assetDurationMs: duration * 1000,
                volume: 1,
                speed: 1,
                properties,
                createdAt: new Date().toISOString(),
            }

            // Add the new track and text clip
            executeCommand({
                type: 'BATCH',
                payload: {
                    commands: [
                        { type: 'ADD_TRACK', payload: { track: newTrack } },
                        { type: 'ADD_CLIP', payload: { clip: textClip } }
                    ]
                }
            })
        } else if (selectedTrackId) {
            // Find the selected track
            const track = tracks.find(t => t.id === selectedTrackId)
            if (!track) return

            // Find the last clip in this track
            const trackClips = clips.filter(c => c.trackId === track.id)
            const lastClip = trackClips.length > 0 
                ? trackClips.reduce((latest, clip) => 
                    clip.timelineEndMs > latest.timelineEndMs ? clip : latest
                  )
                : null

            // Default duration is 5 seconds
            const duration = 5
            const startTime = lastClip ? lastClip.timelineEndMs : 0

            // Create the text clip
            const textClip = {
                id: uuid(),
                trackId: track.id,
                type: 'text' as const,
                sourceStartMs: 0,
                sourceEndMs: duration * 1000,
                timelineStartMs: startTime,
                timelineEndMs: startTime + duration * 1000,
                assetDurationMs: duration * 1000,
                volume: 1,
                speed: 1,
                properties,
                createdAt: new Date().toISOString(),
            }

            // Add the text clip to existing track
            executeCommand({
                type: 'ADD_CLIP',
                payload: { clip: textClip }
            })
        }

        // Clear the text input
        setText('')
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
                        Track Options
                    </label>
                    
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="trackType"
                                checked={createNewTrack}
                                onChange={() => setCreateNewTrack(true)}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium">Create new track</span>
                        </label>
                        
                        <label className="flex items-center gap-2">
                            <input
                                type="radio"
                                name="trackType"
                                checked={!createNewTrack}
                                onChange={() => setCreateNewTrack(false)}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium">Add to existing track</span>
                        </label>
                        </div>
                        
                    {!createNewTrack && (
                        <select
                            value={selectedTrackId || ''}
                            onChange={(e) => setSelectedTrackId(e.target.value || null)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            disabled={textTracks.length === 0}
                        >
                            {textTracks.length === 0 ? (
                                <option value="">No text tracks available</option>
                            ) : (
                                <>
                                    <option value="">Select a track</option>
                                    {textTracks.map(track => (
                                        <option key={track.id} value={track.id}>
                                            Text Track {track.index}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    )}

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
                                disabled={isGenerating || !stylePrompt.trim()}
                                className={`
                                    w-full px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                                    ${isGenerating || !stylePrompt.trim()
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                                    }
                                `}
                            >
                                {isGenerating ? (
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

                <div className="space-y-3">
                    <label className="block text-sm font-medium text-black/50">
                        Timeline Options
                    </label>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-sm text-gray-600">Duration</label>
                            <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="3">3 seconds</option>
                                <option value="5" selected>5 seconds</option>
                                <option value="10">10 seconds</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm text-gray-600">Position</label>
                            <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="start">Start of timeline</option>
                                <option value="cursor">At cursor</option>
                                <option value="end">End of timeline</option>
                            </select>
                        </div>
                    </div>
            </div>
                
                <button
                    onClick={handleAddText}
                    disabled={!text.trim() || (!createNewTrack && !selectedTrackId)}
                    className={`
                        w-full px-4 py-3 rounded-lg font-medium transition-all duration-200
                        ${!text.trim() || (!createNewTrack && !selectedTrackId)
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95'
                        }
                    `}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        {createNewTrack ? 'Add Text in New Track' : 'Add Text to Selected Track'}
                    </div>
                </button>
            </div>
        </div>
    )
}