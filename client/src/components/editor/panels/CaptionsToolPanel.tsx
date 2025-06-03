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
    highlightedHtml?: string // Store the HTML with highlights
}

// Highlight colors for short video captions - vibrant colors that pop
export const highlightColors = [
    '#FFFF00', // Bright Yellow
    '#00FF41', // Bright Green  
    '#FF3366', // Bright Pink
    '#00D4FF', // Bright Cyan
    '#FF8C00', // Bright Orange
    '#DA70D6', // Bright Orchid
]

// Trending short video font styles - Optimized for maximum impact and readability
export const captionStyles = [
    {
        name: 'Classic Impact',
        style: {
            fontFamily: 'Impact, "Arial Black", "Franklin Gothic Bold", sans-serif',
            fontSize: 32,
            fontWeight: 900,
            color: '#FFFF00',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.8)',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
        },
    },
    {
        name: 'Bold Knockout',
        style: {
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: 30,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '4px #000000',
            textShadow: 'none',
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
        },
    },
    {
        name: 'Neon Pop',
        style: {
            fontFamily: 'Impact, "Trebuchet MS", sans-serif',
            fontSize: 28,
            fontWeight: 900,
            color: '#00FF41',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '0px 0px 10px #00FF41, 3px 3px 0px #000000',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
        },
    },
    {
        name: 'Heavy Shadow',
        style: {
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: 29,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '2px #000000',
            textShadow: '5px 5px 0px #000000, 10px 10px 20px rgba(0, 0, 0, 0.5)',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
        },
    },
    {
        name: 'Bright Pink',
        style: {
            fontFamily: 'Impact, "Franklin Gothic Bold", sans-serif',
            fontSize: 31,
            fontWeight: 900,
            color: '#FF3366',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 0px rgba(0, 0, 0, 0.8)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.8px',
        },
    },
    {
        name: 'Electric Blue',
        style: {
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: 30,
            fontWeight: 900,
            color: '#00D4FF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '0px 0px 8px #00D4FF, 2px 2px 0px #000000',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
        },
    },
    {
        name: 'Fire Orange',
        style: {
            fontFamily: 'Impact, "Trebuchet MS", sans-serif',
            fontSize: 32,
            fontWeight: 900,
            color: '#FF8C00',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            textTransform: 'uppercase' as const,
            letterSpacing: '1.2px',
        },
    },
    {
        name: 'Clean White',
        style: {
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: 30,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px rgba(0, 0, 0, 0.8)',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
        },
    },
    {
        name: 'Purple Power',
        style: {
            fontFamily: 'Impact, "Franklin Gothic Bold", sans-serif',
            fontSize: 29,
            fontWeight: 900,
            color: '#DA70D6',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '0px 0px 6px #DA70D6, 3px 3px 0px #000000',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
        },
    },
    {
        name: 'Classic Yellow',
        style: {
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontSize: 33,
            fontWeight: 900,
            color: '#FFFF00',
            textAlign: 'center' as const,
            WebkitTextStroke: '4px #000000',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
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
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [progressStage, setProgressStage] = useState<'upload' | 'processing' | 'generating' | null>(null)
    const [progressPercent, setProgressPercent] = useState(0)
    
    // Workflow states: 'initial' | 'generating' | 'editing' | 'styling'
    const [workflowPhase, setWorkflowPhase] = useState<'initial' | 'generating' | 'editing' | 'styling'>('initial')
    
    // Caption customization states
    const [selectedStyleIdx, setSelectedStyleIdx] = useState(0)
    const [selectedPlacement, setSelectedPlacement] = useState('bottom')
    
    // Editing states
    const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null)
    const [editText, setEditText] = useState('')
    
    const { clips, tracks, executeCommand, updateCaptionTrackPlacement } = useEditor()
    const { session } = useAuth()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

    // Get tracks that have transcribable clips (video or audio)
    const transcribableTracks = tracks.filter(track => {
        const trackClips = clips.filter(clip => clip.trackId === track.id)
        return trackClips.some(clip => 
            (clip.type === 'video' || clip.type === 'audio') && clip.assetId
        )
    })

    // Auto-select the first available track
    useEffect(() => {
        if (transcribableTracks.length > 0 && !selectedTrackId) {
            setSelectedTrackId(transcribableTracks[0].id)
        } else if (transcribableTracks.length === 0) {
            setSelectedTrackId(null)
        }
    }, [transcribableTracks, selectedTrackId])

    // Smart random highlighting - highlights meaningful words
    const addRandomHighlights = (text: string): string => {
        // Words to skip (articles, prepositions, common words)
        const skipWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
            'above', 'below', 'between', 'among', 'this', 'that', 'these', 'those', 'i',
            'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
            'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must'
        ])

        const words = text.split(/(\s+)/)
        const meaningfulWords = words.filter((word, index) => 
            index % 2 === 0 && // Only actual words, not spaces
            word.length > 2 && // Skip very short words
            !skipWords.has(word.toLowerCase().replace(/[^a-z]/g, '')) // Skip common words
        )

        // Highlight 1-2 meaningful words randomly
        const highlightCount = Math.min(meaningfulWords.length, Math.random() > 0.6 ? 2 : 1)
        if (highlightCount === 0 || meaningfulWords.length === 0) return text

        // Select random words to highlight
        const wordsToHighlight = new Set()
        while (wordsToHighlight.size < highlightCount) {
            const randomWord = meaningfulWords[Math.floor(Math.random() * meaningfulWords.length)]
            wordsToHighlight.add(randomWord.toLowerCase().replace(/[^a-z]/g, ''))
        }

        // Apply highlights
        return words.map(word => {
            const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '')
            if (wordsToHighlight.has(cleanWord)) {
                const color = highlightColors[Math.floor(Math.random() * highlightColors.length)]
                return `<span color="${color}">${word}</span>`
            }
            return word
        }).join('')
    }

    // Parse enhanced SRT format with word highlights
    const parseEnhancedSRT = (srtText: string): Caption[] => {
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
                    // Remove any existing highlights from AI transcription
                    const plainText = textLines.replace(/<span[^>]*>(.*?)<\/span>/g, '$1')
                    
                    // Add random highlights to meaningful words
                    const highlightedText = addRandomHighlights(plainText)
                    
                    parsedCaptions.push({
                        id: index + 1,
                        startTime: timeMatch[1],
                        endTime: timeMatch[2],
                        text: plainText,
                        highlightedHtml: highlightedText
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
        if (!selectedTrackId || !session?.access_token) {
            setError('Please add a video or audio clip to your timeline first')
            return
        }

        setIsGenerating(true)
        setWorkflowPhase('generating')
        setError(null)
        setSuccessMessage(null)
        setCaptions([])
        setProgressStage('upload')
        setProgressPercent(0)

        // Start smooth progress animation
        let currentProgress = 0
        const progressInterval = setInterval(() => {
            setProgressPercent(prev => {
                // Smooth progress curve - starts fast, slows down towards the end
                const increment = Math.max(0.3, (85 - prev) * 0.015) // Exponential decay
                const newProgress = Math.min(85, prev + increment)
                currentProgress = newProgress
                
                // Update stage based on progress
                if (newProgress < 25) {
                    setProgressStage('upload')
                } else if (newProgress < 60) {
                    setProgressStage('processing')
                } else {
                    setProgressStage('generating')
                }
                
                return newProgress
            })
        }, 150) // Update every 150ms for smooth animation

        try {
            console.log('🎤 Starting one-click transcription for track:', selectedTrackId)
            
            const response = await fetch(apiPath('transcription/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    trackId: selectedTrackId
                })
            })

            // Clear the progress interval once API call completes
            clearInterval(progressInterval)
            
            // Complete the progress to 100%
            setProgressPercent(100)
            setProgressStage('generating')

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `Transcription failed: ${response.status}`)
            }

            const result = await response.json()
            console.log('✅ Transcription completed:', result)

            // Parse the enhanced SRT format transcription
            const parsedCaptions = parseEnhancedSRT(result.transcription)
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
            clearInterval(progressInterval)
        } finally {
            setIsGenerating(false)
            setProgressStage(null)
            setTimeout(() => setProgressPercent(0), 500) // Reset progress after a delay
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
            // Create a new caption track at the top
            const newTrack = {
                id: uuid(),
                projectId: projectId,
                index: 0, // Insert at the beginning
                type: 'caption' as TrackType,
                createdAt: new Date().toISOString(),
            }

            // Get selected style
            const selectedStyle = captionStyles[selectedStyleIdx].style

            // Create caption clips for each caption with custom styling
            const captionClips = captions.map(caption => ({
                id: uuid(),
                trackId: newTrack.id,
                type: 'caption' as const,
                sourceStartMs: 0,
                sourceEndMs: srtTimeToMs(caption.endTime) - srtTimeToMs(caption.startTime),
                timelineStartMs: srtTimeToMs(caption.startTime),
                timelineEndMs: srtTimeToMs(caption.endTime),
                assetDurationMs: srtTimeToMs(caption.endTime) - srtTimeToMs(caption.startTime),
                volume: 1,
                speed: 1,
                properties: {
                    text: caption.highlightedHtml || caption.text, // Use highlighted HTML if available
                    style: {
                        ...selectedStyle,
                    },
                    placement: selectedPlacement, // Store placement for the editor
                    isCaptionClip: true, // Mark as caption clip
                },
                createdAt: new Date().toISOString(),
            }))

            // Create commands to:
            // 1. Shift all existing tracks down
            // 2. Add the new caption track
            // 3. Add all caption clips
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
                // Then add the new caption track
                {
                    type: 'ADD_TRACK' as const,
                    payload: { track: newTrack }
                },
                // Finally add all caption clips
                ...captionClips.map(clip => ({
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

    // Get the selected track and its clips for display
    const selectedTrack = tracks.find(track => track.id === selectedTrackId)
    const selectedTrackClips = clips.filter(clip => clip.trackId === selectedTrackId && (clip.type === 'video' || clip.type === 'audio'))
    const selectedClip = selectedTrackClips.length > 0 ? selectedTrackClips[0] : null

    // Progress indicator content
    const getProgressContent = () => {
        switch (progressStage) {
            case 'upload':
                return { text: '📤 Uploading to AI...', percent: progressPercent }
            case 'processing':
                return { text: '🎯 Analyzing audio...', percent: progressPercent }
            case 'generating':
                return { text: '✨ Generating captions...', percent: progressPercent }
            default:
                return { text: '🧠 Processing...', percent: progressPercent || 50 }
        }
    }

    const progressContent = getProgressContent()

    // Render highlighted text as React elements
    const renderHighlightedText = (htmlText: string) => {
        if (!htmlText) return null
        
        // Split text by span tags and render appropriately
        const parts = htmlText.split(/(<span[^>]*>.*?<\/span>)/g)
        
        return parts.map((part, index) => {
            const spanMatch = part.match(/<span color="([^"]*)">(.*?)<\/span>/)
            if (spanMatch) {
                const [, color, text] = spanMatch
                return (
                    <span key={index} style={{ color, fontWeight: 'bold' }}>
                        {text}
                    </span>
                )
            }
            return part
        })
    }

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
                transcribableTracks.length === 0 ? (
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
                        {/* Track Selection */}
                        {transcribableTracks.length > 1 && (
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700">Select Track to Caption</label>
                                <select
                                    value={selectedTrackId || ''}
                                    onChange={(e) => setSelectedTrackId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {transcribableTracks.map((track) => {
                                        const trackClips = clips.filter(clip => clip.trackId === track.id && (clip.type === 'video' || clip.type === 'audio'))
                                        const clipCount = trackClips.length
                                        const totalDuration = trackClips.reduce((sum, clip) => sum + (clip.timelineEndMs - clip.timelineStartMs), 0)
                                        return (
                                            <option key={track.id} value={track.id}>
                                                Track {track.index + 1} • {track.type} • {clipCount} clip{clipCount !== 1 ? 's' : ''} • {Math.round(totalDuration / 1000)}s
                                            </option>
                                        )
                                    })}
                                </select>
                            </div>
                        )}

                        {/* Track Info */}
                        {selectedTrack && selectedClip && (
                            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-lg">
                                        {selectedTrack.type === 'video' ? '📹' : '🎵'}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-blue-800">
                                            Track {selectedTrack.index + 1} • {selectedTrack.type} 
                                        </div>
                                        <div className="text-xs text-blue-600">
                                            {selectedTrackClips.length} clip{selectedTrackClips.length !== 1 ? 's' : ''} • Total duration: {Math.round(selectedTrackClips.reduce((sum, clip) => sum + (clip.timelineEndMs - clip.timelineStartMs), 0) / 1000)}s
                                        </div>
                                    </div>
                                    {transcribableTracks.length === 1 && (
                                        <div className="ml-auto">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                                <Sparkles size={12} />
                                                Ready
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {transcribableTracks.length > 1 && (
                                    <p className="text-xs text-blue-600">
                                        Selected track for caption generation
                                    </p>
                                )}
                            </div>
                        )}

                        {/* One-Click Generate Button */}
                        <button 
                            onClick={handleOneClickGenerate}
                            disabled={!selectedTrackId}
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

                    {/* Random Highlighting Info */}
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={16} className="text-blue-500" />
                            <span className="text-sm font-medium text-blue-700">Smart Highlighting Active</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full" style={{backgroundColor: highlightColors[Math.floor(Math.random() * highlightColors.length)]}}></div>
                                <span className="text-gray-600">Random Highlight</span>
                            </div>
                            <span className="text-gray-500">• 1-2 key words per caption highlighted with vibrant colors</span>
                        </div>
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
                                            {renderHighlightedText(caption.highlightedHtml || caption.text)}
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
                                        border rounded-lg p-3 flex items-center justify-center transition-all duration-200 h-16 text-xs font-bold
                                        ${selectedStyleIdx === i ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' : 'hover:bg-blue-50 hover:border-blue-300 shadow-sm hover:shadow-md'}
                                    `}
                                    style={{
                                        backgroundColor: '#000000', // Black background to show outline properly
                                        ...style.style,
                                        fontSize: 14, // Readable size for preview
                                        padding: '8px 12px',
                                        WebkitTextStroke: style.style.WebkitTextStroke ? '2px #000000' : undefined,
                                        textShadow: style.style.textShadow ? '2px 2px 4px rgba(0, 0, 0, 0.8)' : undefined,
                                    }}
                                    onClick={() => setSelectedStyleIdx(i)}
                                    title={style.name}
                                >
                                    SAMPLE
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