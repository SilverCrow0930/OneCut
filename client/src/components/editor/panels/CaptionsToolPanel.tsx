import React, { useState, useEffect } from 'react'
import { Wand2, Download, Copy, RotateCcw, Mic, CheckCircle, AlertCircle, Loader2, Sparkles, Plus, AlignCenter, ArrowUp, ArrowDown, Edit2, Check } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { useParams } from 'next/navigation'
import { apiPath } from '@/lib/config'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'

interface Caption {
    id: number
    startTime: string
    endTime: string
    text: string
}

// Trending font styles for short videos - Content Creator Edition
export const captionStyles = [
    {
        name: 'Impact Bold',
        style: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontSize: 22,
            fontWeight: 900,
            color: '#ffffff',
            backgroundColor: 'transparent',
            padding: '4px 8px',
            borderRadius: '0px',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '4px 4px 8px rgba(0, 0, 0, 0.8)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'YouTube Thumbnail',
        style: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontSize: 24,
            fontWeight: 900,
            color: '#ffff00',
            backgroundColor: 'transparent',
            padding: '6px 12px',
            borderRadius: '0px',
            textAlign: 'center' as const,
            WebkitTextStroke: '2px #000000',
            textShadow: '3px 3px 6px rgba(0, 0, 0, 0.9)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'Creator Orange',
        style: {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: 21,
            fontWeight: 900,
            color: '#ff6600',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: '8px 16px',
            borderRadius: '6px',
            textAlign: 'center' as const,
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'Beast Style',
        style: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontSize: 20,
            fontWeight: 900,
            color: '#ffffff',
            backgroundColor: 'transparent',
            padding: '4px 8px',
            borderRadius: '0px',
            textAlign: 'center' as const,
            WebkitTextStroke: '2px #333333',
            textShadow: '0 0 10px #ffffff, 2px 2px 8px rgba(0, 0, 0, 0.8)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'Viral Yellow',
        style: {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: 22,
            fontWeight: 900,
            color: '#000000',
            backgroundColor: '#ffff00',
            padding: '8px 16px',
            borderRadius: '8px',
            textAlign: 'center' as const,
            textShadow: '1px 1px 2px rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'Influencer White',
        style: {
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 19,
            fontWeight: 800,
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 16px',
            borderRadius: '12px',
            textAlign: 'center' as const,
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
        },
    },
    {
        name: 'Bold Outline',
        style: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontSize: 21,
            fontWeight: 900,
            color: '#ffffff',
            backgroundColor: 'transparent',
            padding: '4px 8px',
            borderRadius: '0px',
            textAlign: 'center' as const,
            WebkitTextStroke: '4px #000000',
            textShadow: '4px 4px 8px rgba(0, 0, 0, 0.9)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'Content King',
        style: {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: 20,
            fontWeight: 900,
            color: '#ff0000',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: '6px',
            textAlign: 'center' as const,
            textShadow: '1px 1px 3px rgba(0, 0, 0, 0.7)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'Trending Purple',
        style: {
            fontFamily: 'Helvetica, Arial, sans-serif',
            fontSize: 19,
            fontWeight: 700,
            color: '#ffffff',
            backgroundColor: '#8b00ff',
            padding: '8px 16px',
            borderRadius: '10px',
            textAlign: 'center' as const,
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
        },
    },
    {
        name: 'Social Star',
        style: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontSize: 22,
            fontWeight: 900,
            color: '#00ff88',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            padding: '6px 12px',
            borderRadius: '4px',
            textAlign: 'center' as const,
            textShadow: '0 0 8px #00ff88, 2px 2px 6px rgba(0, 0, 0, 0.9)',
            textTransform: 'uppercase' as const,
        },
    },
    {
        name: 'Clean Modern',
        style: {
            fontFamily: 'SF Pro Display, Helvetica, Arial, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            color: '#333333',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '8px 16px',
            borderRadius: '20px',
            textAlign: 'center' as const,
            border: '1px solid rgba(0, 0, 0, 0.1)',
        },
    },
    {
        name: 'Fire Orange',
        style: {
            fontFamily: 'Arial Black, Impact, sans-serif',
            fontSize: 21,
            fontWeight: 900,
            color: '#ff4500',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: '8px 16px',
            borderRadius: '6px',
            textAlign: 'center' as const,
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9)',
            textTransform: 'uppercase' as const,
            border: '2px solid #ff4500',
        },
    },
]

// Caption placement options
export const captionPlacements = [
    { id: 'top', name: 'Top', icon: ArrowUp },
    { id: 'middle', name: 'Middle', icon: AlignCenter },
    { id: 'bottom', name: 'Bottom', icon: ArrowDown },
]

const CaptionsToolPanel = () => {
    const [isGenerating, setIsGenerating] = useState(false)
    const [captions, setCaptions] = useState<Caption[]>([])
    const [autoSelectedClip, setAutoSelectedClip] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [progressStage, setProgressStage] = useState<'upload' | 'processing' | 'generating' | null>(null)
    
    // Workflow states: 'initial' | 'generating' | 'editing' | 'styling'
    const [workflowPhase, setWorkflowPhase] = useState<'initial' | 'generating' | 'editing' | 'styling'>('initial')
    
    // Caption customization states
    const [selectedStyleIdx, setSelectedStyleIdx] = useState(0)
    const [selectedPlacement, setSelectedPlacement] = useState('bottom')
    
    // Editing states
    const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null)
    const [editText, setEditText] = useState('')
    
    const { clips, tracks, executeCommand } = useEditor()
    const { session } = useAuth()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

    // Get video/audio clips that can be transcribed
    const transcribableClips = clips.filter(clip => 
        (clip.type === 'video' || clip.type === 'audio') && clip.assetId
    )

    // Auto-select the best clip for transcription (longest video clip first)
    useEffect(() => {
        if (transcribableClips.length > 0) {
            // Find the longest video clip first, or longest audio clip if no video
            const videoClips = transcribableClips.filter(clip => clip.type === 'video')
            const audioClips = transcribableClips.filter(clip => clip.type === 'audio')
            
            let bestClip = null
            if (videoClips.length > 0) {
                // Select longest video clip
                bestClip = videoClips.reduce((longest, current) => 
                    (current.timelineEndMs - current.timelineStartMs) > (longest.timelineEndMs - longest.timelineStartMs) 
                        ? current : longest
                )
            } else if (audioClips.length > 0) {
                // Select longest audio clip
                bestClip = audioClips.reduce((longest, current) => 
                    (current.timelineEndMs - current.timelineStartMs) > (longest.timelineEndMs - longest.timelineStartMs) 
                        ? current : longest
                )
            }
            
            setAutoSelectedClip(bestClip?.id || null)
        } else {
            setAutoSelectedClip(null)
        }
    }, [transcribableClips])

    // Parse SRT format to caption objects
    const parseSRT = (srtText: string): Caption[] => {
        const srtBlocks = srtText.trim().split('\n\n')
        const parsedCaptions: Caption[] = []

        srtBlocks.forEach((block, index) => {
            const lines = block.trim().split('\n')
            if (lines.length >= 3) {
                const timeLine = lines[1]
                const textLines = lines.slice(2).join(' ')
                
                // Parse time format: 00:00:01,000 --> 00:00:03,500
                const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/)
                if (timeMatch) {
                    parsedCaptions.push({
                        id: index + 1,
                        startTime: timeMatch[1],
                        endTime: timeMatch[2],
                        text: textLines
                    })
                }
            }
        })

        return parsedCaptions
    }

    // Convert SRT time format to milliseconds
    const srtTimeToMs = (srtTime: string): number => {
        const [time, ms] = srtTime.split(',')
        const [hours, minutes, seconds] = time.split(':').map(Number)
        return (hours * 3600 + minutes * 60 + seconds) * 1000 + Number(ms)
    }

    const handleOneClickGenerate = async () => {
        if (!autoSelectedClip || !session?.access_token) {
            setError('Please add a video or audio clip to your timeline first')
            return
        }

        setIsGenerating(true)
        setWorkflowPhase('generating')
        setError(null)
        setSuccessMessage(null)
        setCaptions([])
        setProgressStage('upload')

        try {
            console.log('🎤 Starting one-click transcription for clip:', autoSelectedClip)
            
            // Simulate progress stages
            setTimeout(() => setProgressStage('processing'), 1000)
            setTimeout(() => setProgressStage('generating'), 3000)
            
            const response = await fetch(apiPath('transcription/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    clipId: autoSelectedClip
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `Transcription failed: ${response.status}`)
            }

            const result = await response.json()
            console.log('✅ Transcription completed:', result)

            // Parse the SRT format transcription
            const parsedCaptions = parseSRT(result.transcription)
            setCaptions(parsedCaptions)

            if (parsedCaptions.length === 0) {
                setError('No speech detected. Try with clearer audio or a video with spoken content.')
                setWorkflowPhase('initial')
            } else {
                setSuccessMessage(`🎉 Generated ${parsedCaptions.length} captions successfully!`)
                setWorkflowPhase('editing')
                // Auto-clear success message after 5 seconds
                setTimeout(() => setSuccessMessage(null), 5000)
            }

        } catch (error: any) {
            console.error('❌ Transcription failed:', error)
            setError(error.message || 'Failed to generate captions')
            setWorkflowPhase('initial')
        } finally {
            setIsGenerating(false)
            setProgressStage(null)
        }
    }

    const handleStartEdit = (caption: Caption) => {
        setEditingCaptionId(caption.id)
        setEditText(caption.text)
    }

    const handleSaveEdit = () => {
        if (editingCaptionId !== null) {
            setCaptions(prev => prev.map(caption => 
                caption.id === editingCaptionId 
                    ? { ...caption, text: editText }
                    : caption
            ))
            setEditingCaptionId(null)
            setEditText('')
        }
    }

    const handleCancelEdit = () => {
        setEditingCaptionId(null)
        setEditText('')
    }

    const handleProceedToStyling = () => {
        setWorkflowPhase('styling')
    }

    const handleAddToTimeline = () => {
        if (captions.length === 0 || !projectId) return

        try {
            // Create a new text track at the top
            const newTrack = {
                id: uuid(),
                projectId: projectId,
                index: 0, // Insert at the beginning
                type: 'text' as TrackType,
                createdAt: new Date().toISOString(),
            }

            // Get selected style
            const selectedStyle = captionStyles[selectedStyleIdx].style

            // Create text clips for each caption with custom styling
            const textClips = captions.map(caption => ({
                id: uuid(),
                trackId: newTrack.id,
                type: 'text' as const,
                sourceStartMs: 0,
                sourceEndMs: srtTimeToMs(caption.endTime) - srtTimeToMs(caption.startTime),
                timelineStartMs: srtTimeToMs(caption.startTime),
                timelineEndMs: srtTimeToMs(caption.endTime),
                assetDurationMs: srtTimeToMs(caption.endTime) - srtTimeToMs(caption.startTime),
                volume: 1,
                speed: 1,
                properties: {
                    text: caption.text,
                    style: {
                        ...selectedStyle,
                    },
                    placement: selectedPlacement, // Store placement for the editor
                },
                createdAt: new Date().toISOString(),
            }))

            // Create commands to:
            // 1. Shift all existing tracks down
            // 2. Add the new track
            // 3. Add all text clips
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
                // Finally add all text clips
                ...textClips.map(clip => ({
                    type: 'ADD_CLIP' as const,
                    payload: { clip }
                }))
            ]

            // Execute all commands in a single batch
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })

            setSuccessMessage(`🎬 Added ${captions.length} captions to timeline!`)
            
            // Reset to initial state
            setWorkflowPhase('initial')
            setCaptions([])
            setTimeout(() => setSuccessMessage(null), 3000)

        } catch (error) {
            console.error('Failed to add captions to timeline:', error)
            setError('Failed to add captions to timeline')
        }
    }

    const handleStartOver = () => {
        setCaptions([])
        setError(null)
        setSuccessMessage(null)
        setWorkflowPhase('initial')
        setEditingCaptionId(null)
        setEditText('')
    }

    // Get the clip info for display
    const selectedClip = transcribableClips.find(clip => clip.id === autoSelectedClip)
    const selectedClipIndex = transcribableClips.findIndex(clip => clip.id === autoSelectedClip)

    // Progress indicator content
    const getProgressContent = () => {
        switch (progressStage) {
            case 'upload':
                return { text: '📤 Uploading to AI...', percent: 20 }
            case 'processing':
                return { text: '🎯 Analyzing audio...', percent: 60 }
            case 'generating':
                return { text: '✨ Generating captions...', percent: 90 }
            default:
                return { text: '🧠 Processing...', percent: 50 }
        }
    }

    const progressContent = getProgressContent()

    return (
        <div className="flex flex-col w-full gap-6 p-4">
            <PanelHeader 
                icon={Mic} 
                title="AI Captions" 
                description="Generate captions for your video with one click"
            />
            
            {/* Status Messages */}
            {successMessage && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top-2 duration-300">
                    <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700">{successMessage}</p>
                </div>
            )}
            
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Phase 1: Initial Generation */}
            {workflowPhase === 'initial' && (
                transcribableClips.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-blue-100 flex items-center justify-center">
                            <Mic size={32} className="text-blue-500" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-3">No Media Found</h3>
                        <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
                            Add a video or audio clip to your timeline to generate AI captions automatically
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Clip Info */}
                        {selectedClip && (
                            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-lg">
                                        {selectedClip.type === 'video' ? '📹' : '🎵'}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-blue-800">
                                            {selectedClip.type === 'video' ? 'Video' : 'Audio'} Clip {selectedClipIndex + 1}
                                        </div>
                                        <div className="text-xs text-blue-600">
                                            Duration: {Math.round((selectedClip.timelineEndMs - selectedClip.timelineStartMs) / 1000)}s
                                        </div>
                                    </div>
                                    {transcribableClips.length === 1 && (
                                        <div className="ml-auto">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                                <Sparkles size={12} />
                                                Ready
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {transcribableClips.length > 1 && (
                                    <p className="text-xs text-blue-600">
                                        Auto-selected longest {selectedClip.type} clip
                                    </p>
                                )}
                            </div>
                        )}

                        {/* One-Click Generate Button */}
                        <button 
                            onClick={handleOneClickGenerate}
                            disabled={!autoSelectedClip}
                            className="
                                relative overflow-hidden
                                flex items-center justify-center gap-3 w-full px-6 py-5
                                bg-gradient-to-r from-blue-600 to-blue-600 text-white rounded-2xl
                                hover:from-blue-700 hover:to-blue-700 
                                disabled:opacity-50 disabled:cursor-not-allowed
                                font-semibold text-lg shadow-lg hover:shadow-xl
                                transform hover:scale-[1.02] active:scale-[0.98]
                                transition-all duration-300
                                group
                            "
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                            <Wand2 size={28} />
                            <span>Generate AI Captions</span>
                        </button>
                    </div>
                )
            )}

            {/* Phase 2: Generating */}
            {workflowPhase === 'generating' && (
                <div className="space-y-4 animate-in fade-in-50 duration-500">
                    <div className="text-center space-y-3">
                        <div className="text-base text-gray-700 font-medium">
                            {progressContent.text}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                                className="bg-gradient-to-r from-blue-600 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out"
                                style={{width: `${progressContent.percent}%`}}
                            ></div>
                        </div>
                        <div className="text-sm text-gray-500">
                            This usually takes 30-60 seconds depending on audio length
                        </div>
                    </div>
                </div>
            )}

            {/* Phase 3: Edit Captions */}
            {workflowPhase === 'editing' && captions.length > 0 && (
                <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                            <Edit2 size={18} className="text-blue-500" />
                            Edit Your Captions ({captions.length})
                        </h4>
                        <button
                            onClick={handleStartOver}
                            className="text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Start over"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>

                    {/* Editable Captions List */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="max-h-80 overflow-y-auto">
                            {captions.map((caption, index) => (
                                <div key={caption.id} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs font-mono text-white bg-blue-500 px-2 py-1 rounded-md">
                                            {caption.startTime.split(',')[0]}
                                        </span>
                                        <span className="text-xs text-gray-400">#{index + 1}</span>
                                        <div className="ml-auto">
                                            {editingCaptionId === caption.id ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        className="text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                                                        title="Save"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="text-gray-500 hover:bg-gray-100 p-1 rounded transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleStartEdit(caption)}
                                                    className="text-blue-500 hover:bg-blue-50 p-1 rounded transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {editingCaptionId === caption.id ? (
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full p-2 border border-blue-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={2}
                                            autoFocus
                                        />
                                    ) : (
                                        <p className="text-sm text-gray-800 leading-relaxed cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleStartEdit(caption)}>
                                            {caption.text}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Proceed Button */}
                    <button
                        onClick={handleProceedToStyling}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 transform hover:scale-[1.02] font-medium shadow-md text-base"
                    >
                        <Sparkles size={20} />
                        Continue to Styling
                    </button>
                </div>
            )}

            {/* Phase 4: Style and Placement */}
            {workflowPhase === 'styling' && captions.length > 0 && (
                <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                            <Sparkles size={18} className="text-blue-500" />
                            Style Your Captions
                        </h4>
                        <button
                            onClick={() => setWorkflowPhase('editing')}
                            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors text-sm"
                        >
                            ← Back to Edit
                        </button>
                    </div>

                    {/* Style Selection */}
                    <div className="space-y-3">
                        <h5 className="text-base font-semibold text-gray-700">Font Style</h5>
                        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                            {captionStyles.map((style, i) => (
                                <button
                                    key={style.name}
                                    type="button"
                                    className={`
                                        border rounded-lg p-2 flex items-center justify-center transition-all duration-200 h-12 text-xs font-medium
                                        ${selectedStyleIdx === i ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' : 'hover:bg-blue-50 hover:border-blue-300 shadow-sm hover:shadow-md'}
                                    `}
                                    style={{
                                        ...style.style,
                                        fontSize: 12, // Smaller for preview
                                        padding: '4px 8px',
                                        WebkitTextStroke: style.style.WebkitTextStroke ? '1px #000000' : undefined,
                                        textShadow: style.style.textShadow ? '1px 1px 2px rgba(0, 0, 0, 0.5)' : undefined,
                                    }}
                                    onClick={() => setSelectedStyleIdx(i)}
                                    title={style.name}
                                >
                                    {style.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Placement Selection */}
                    <div className="space-y-3">
                        <h5 className="text-base font-semibold text-gray-700">Caption Placement</h5>
                        <div className="flex gap-2">
                            {captionPlacements.map((placement) => {
                                const Icon = placement.icon
                                return (
                                    <button
                                        key={placement.id}
                                        onClick={() => setSelectedPlacement(placement.id)}
                                        className={`
                                            flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all duration-200
                                            ${selectedPlacement === placement.id 
                                                ? 'bg-blue-100 border-2 border-blue-500 text-blue-700' 
                                                : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
                                            }
                                        `}
                                    >
                                        <Icon size={16} />
                                        <span className="text-sm font-medium">{placement.name}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Add to Timeline Button */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleAddToTimeline}
                            className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-[1.02] font-medium shadow-md text-base"
                        >
                            <Plus size={20} />
                            Add to Timeline
                        </button>
                        <button
                            onClick={handleStartOver}
                            className="px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Start over"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    {/* Quick tip */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700 flex items-center gap-1">
                            <span>✨</span>
                            <span>Captions will be added to a new text track at the top of your timeline</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CaptionsToolPanel