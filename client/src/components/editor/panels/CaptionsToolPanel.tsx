import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'
import { useCaptions, Caption } from '@/contexts/CaptionsContext'
import { useParams } from 'next/navigation'
import { apiPath } from '@/lib/config'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'

// Icons
import { 
    Mic, 
    Sparkles, 
    Edit2, 
    Check, 
    RotateCcw, 
    Plus, 
    ArrowUp, 
    AlignCenter, 
    ArrowDown,
    RefreshCw
} from 'lucide-react'

import PanelHeader from './PanelHeader'
import styles from './CaptionsToolPanel.module.css'
// Import styles and constants directly
const highlightColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
]



export const longVideoCaptionStyles = [
    {
        name: 'Classic White with Black Outline',
        style: {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 20,
            fontWeight: 700,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '1.5px #000000',
            textShadow: '1.5px 1.5px 3px #000000',
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
    {
        name: 'Yellow Netflix Style',
        style: {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            color: '#FFFF00',
            textAlign: 'center' as const,
            WebkitTextStroke: '1.5px #000000',
            textShadow: '1.5px 1.5px 3px #000000',
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
    {
        name: 'Semi-Transparent Box',
        style: {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 19,
            fontWeight: 600,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '6px',
            padding: '6px 10px',
            WebkitTextStroke: '0',
            textShadow: 'none',
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
    {
        name: 'Clean Lower Third',
        style: {
            fontFamily: 'Roboto, Arial, sans-serif',
            fontSize: 18,
            fontWeight: 500,
            color: '#FFFFFF',
            textAlign: 'left' as const,
            WebkitTextStroke: '0',
            textShadow: '1.5px 1.5px 3px #000000',
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
    {
        name: 'Bold Uppercase with Shadow',
        style: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontSize: 21,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '0',
            textShadow: '2px 2px 4px #000000',
            textTransform: 'uppercase' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
    {
        name: 'Minimalist Transparent',
        style: {
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontSize: 17,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.8)',
            textAlign: 'center' as const,
            WebkitTextStroke: '0',
            textShadow: 'none',
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
    {
        name: 'Colored Bar Background',
        style: {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 19,
            fontWeight: 600,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            background: 'rgba(59,130,246,0.8)',
            borderRadius: '0',
            padding: '6px 12px',
            WebkitTextStroke: '0',
            textShadow: 'none',
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
    {
        name: 'Professional News Style',
        style: {
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: 17,
            fontWeight: 500,
            color: '#FFFFFF',
            textAlign: 'left' as const,
            background: 'rgba(0,0,0,0.9)',
            borderRadius: '0',
            padding: '4px 10px',
            WebkitTextStroke: '0',
            textShadow: 'none',
            textTransform: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: '90%',
        },
    },
]

export const shortVideoCaptionStyles = [
    {
        name: 'Montserrat Heavy',
        style: {
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 36,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'uppercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Rubik Heavy',
        style: {
            fontFamily: 'Rubik, Arial, sans-serif',
            fontSize: 34,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'uppercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Fira Sans Condensed',
        style: {
            fontFamily: 'Fira Sans Condensed, Arial, sans-serif',
            fontSize: 36,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'uppercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Poppins Bold',
        style: {
            fontFamily: 'Poppins, Arial, sans-serif',
            fontSize: 34,
            fontWeight: 700,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'lowercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Gabarito Heavy',
        style: {
            fontFamily: 'Gabarito, Arial, sans-serif',
            fontSize: 36,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'uppercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'DM Serif Display',
        style: {
            fontFamily: 'DM Serif Display, serif',
            fontSize: 32,
            fontWeight: 500,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '2px #000000',
            textShadow: '2px 2px 4px #000000',
            textTransform: 'lowercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Opinion Heavy',
        style: {
            fontFamily: 'Opinion, Arial, sans-serif',
            fontSize: 36,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'uppercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Circular Medium',
        style: {
            fontFamily: 'Circular, Arial, sans-serif',
            fontSize: 34,
            fontWeight: 500,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '2px #000000',
            textShadow: '2px 2px 4px #000000',
            textTransform: 'lowercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Roboto Heavy',
        style: {
            fontFamily: 'Roboto, Arial, sans-serif',
            fontSize: 36,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'uppercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Anton Heavy',
        style: {
            fontFamily: 'Anton, Arial, sans-serif',
            fontSize: 38,
            fontWeight: 400,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'lowercase' as const,
        },
        supportsHighlight: true,
    },
    {
        name: 'Arial Heavy',
        style: {
            fontFamily: 'Arial, sans-serif',
            fontSize: 36,
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center' as const,
            WebkitTextStroke: '3px #000000',
            textShadow: '3px 3px 6px #000000',
            textTransform: 'lowercase' as const,
        },
        supportsHighlight: true,
    },
]

// Caption placement options
export const captionPlacements = [
    { id: 'top', name: 'Top', icon: ArrowUp },
    { id: 'middle', name: 'Middle', icon: AlignCenter },
    { id: 'bottom', name: 'Bottom', icon: ArrowDown },
]

const CaptionsToolPanel = () => {
    // Context state
    const {
        captions,
        setCaptions,
        selectedStyleCategory,
        setSelectedStyleCategory,
        selectedLongStyleIdx,
        setSelectedLongStyleIdx,
        selectedShortStyleIdx,
        setSelectedShortStyleIdx,
        selectedPlacement,
        setSelectedPlacement,
        workflowPhase,
        setWorkflowPhase,
        selectedTrackId,
        setSelectedTrackId,
        resetCaptions,
    } = useCaptions()

    // Local state for highlight color
    const [selectedHighlightColor, setSelectedHighlightColor] = useState<string | null>(null)

    // Local state for generation process
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [progressStage, setProgressStage] = useState<'upload' | 'processing' | 'generating' | null>(null)
    const [smoothProgress, setSmoothProgress] = useState(0)
    
    // Editing states
    const [editingCaptionId, setEditingCaptionId] = useState<number | null>(null)
    const [editText, setEditText] = useState('')
    
    const { clips, tracks, executeCommand } = useEditor()
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
    }, [transcribableTracks, selectedTrackId, setSelectedTrackId])

    // Smart random highlighting - highlights meaningful words
    const addRandomHighlights = (text: string, highlightColor?: string): string => {
        // If no highlight color is selected, return original text
        if (!highlightColor) return text

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

        // Apply highlights with the selected color
        return words.map(word => {
            const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '')
            if (wordsToHighlight.has(cleanWord)) {
                return `<span color="${highlightColor}">${word}</span>`
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
                    
                    // Add random highlights to meaningful words (will be applied later when adding to timeline)
                    const highlightedText = plainText
                    
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

    // Smooth progress animation
    const startSmoothProgress = () => {
        setSmoothProgress(0)
        let progress = 0
        const interval = setInterval(() => {
            progress += Math.random() * 3 + 1 // Random increment between 1-4%
            if (progress >= 95) {
                progress = 95 // Cap at 95% until completion
                clearInterval(interval)
            }
            setSmoothProgress(progress)
        }, 200) // Update every 200ms for smooth animation
        
        return interval
    }

    const handleOneClickGenerate = async () => {
        if (!selectedTrackId || !session?.access_token) {
            setError('Please add a video or audio clip to your timeline first')
            return
        }

        setIsGenerating(true)
        setWorkflowPhase('generating')
        setError(null)
        setCaptions([])
        setProgressStage('generating')

        // Start smooth progress animation
        const progressInterval = startSmoothProgress()

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

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `Transcription failed: ${response.status}`)
            }

            const result = await response.json()
            console.log('✅ Transcription completed:', result)

            // Complete the progress bar
            clearInterval(progressInterval)
            setSmoothProgress(100)

            // Parse the enhanced SRT format transcription
            const parsedCaptions = parseEnhancedSRT(result.transcription)
            setCaptions(parsedCaptions)


            setWorkflowPhase('editing')
        } catch (error: any) {
            console.error('❌ Transcription failed:', error)
            clearInterval(progressInterval)
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
            // Create a new caption track at the top
            const newTrack = {
                id: uuid(),
                projectId: projectId,
                index: 0, // Insert at the beginning
                type: 'caption' as TrackType,
                createdAt: new Date().toISOString(),
            }

            // Get selected style from presets
            const selectedStyle = selectedStyleCategory === 'long'
                ? longVideoCaptionStyles[selectedLongStyleIdx].style
                : shortVideoCaptionStyles[selectedShortStyleIdx].style;

            // Create caption clips for each caption with custom styling
            const captionClips = captions.map(caption => {
                // Apply highlight color if selected (only for short videos)
                const finalText = selectedStyleCategory === 'short' && selectedHighlightColor
                    ? addRandomHighlights(caption.text, selectedHighlightColor)
                    : caption.text

                return {
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
                        text: finalText,
                    style: {
                        ...selectedStyle,
                    },
                    placement: selectedPlacement, // Store placement for the editor
                    isCaptionClip: true, // Mark as caption clip
                },
                createdAt: new Date().toISOString(),
                }
            })

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

            // Execute all commands as a batch
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })


            
            // Don't reset captions - keep them for potential re-styling
            // setWorkflowPhase('initial')
        } catch (error: any) {
            console.error('❌ Failed to add captions to timeline:', error)
            setError('Failed to add captions to timeline')
        }
    }

    const handleRegenerateCaption = () => {
        resetCaptions()
        setError(null)
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
            case 'generating':
                return { text: '✨ Generating captions...', percent: Math.round(smoothProgress) }
            default:
                return { text: '🧠 Processing...', percent: Math.round(smoothProgress) }
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
            
            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}



            {/* Phase 1: Initial State or No Tracks */}
            {workflowPhase === 'initial' && transcribableTracks.length === 0 && (
                <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                        <Mic size={24} className="text-gray-400" />
                        </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Audio or Video Found</h3>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                            Add a video or audio clip to your timeline first, then come back here to generate captions.
                        </p>
                    </div>
                </div>
            )}

            {/* Phase 1: Ready to Generate */}
            {workflowPhase === 'initial' && transcribableTracks.length > 0 && (
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
                            </div>
                        )}

                    {/* Generate Button */}
                        <button 
                            onClick={handleOneClickGenerate}
                        disabled={isGenerating || !selectedTrackId}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] font-medium shadow-md text-base"
                    >
                        <Sparkles size={20} />
                        {isGenerating ? 'Generating...' : 'Generate Captions'}
                        </button>
                    </div>
            )}

            {/* Phase 2: Generating Progress */}
            {workflowPhase === 'generating' && (
                <div className="py-8 space-y-6">
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
                            onClick={handleRegenerateCaption}
                            className="flex items-center gap-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors text-sm"
                            title="Regenerate captions"
                        >
                            <RefreshCw size={16} />
                            Regenerate
                        </button>
                    </div>

                    {/* Editable Captions List - PLAIN TEXT ONLY */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="max-h-[500px] overflow-y-auto">
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
                                        <div 
                                            className={styles['plain-caption-text']}
                                            style={{
                                                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                                                fontSize: '14px',
                                                fontWeight: 400,
                                                color: '#1f2937',
                                                textShadow: 'none',
                                                WebkitTextStroke: 'none',
                                                background: 'transparent',
                                                border: 'none',
                                                textTransform: 'none' as const,
                                                letterSpacing: 'normal',
                                                textDecoration: 'none',
                                                outline: 'none',
                                                boxShadow: 'none',
                                                borderRadius: 0,
                                                padding: 0,
                                                margin: 0,
                                                lineHeight: '1.5',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => handleStartEdit(caption)}
                                        >
                                            {caption.text}
                                        </div>
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
                        <button
                            onClick={() => setWorkflowPhase('editing')}
                            className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors text-sm"
                        >
                            ← Back to Edit
                        </button>
                    </div>

                    {/* Style Selection */}
                    <div className="mb-4">
                        <div className="flex gap-2 mb-2">
                        <button
                                className={`px-3 py-1 rounded-lg font-semibold ${selectedStyleCategory === 'long' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                onClick={() => setSelectedStyleCategory('long')}
                            >
                                Long Video
                        </button>
                        <button
                                className={`px-3 py-1 rounded-lg font-semibold ${selectedStyleCategory === 'short' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                onClick={() => setSelectedStyleCategory('short')}
                            >
                                Short Video
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {(selectedStyleCategory === 'long' ? longVideoCaptionStyles : shortVideoCaptionStyles).map((preset, idx) => (
                                <button
                                    key={preset.name}
                                    className={`rounded-lg p-3 border-2 transition-all duration-200 text-left ${
                                        (selectedStyleCategory === 'long' ? selectedLongStyleIdx : selectedShortStyleIdx) === idx
                                            ? 'border-blue-600 scale-105 bg-blue-50'
                                            : 'border-gray-200 bg-white hover:border-blue-400'
                                    }`}
                                    onClick={() => {
                                        if (selectedStyleCategory === 'long') setSelectedLongStyleIdx(idx);
                                        else setSelectedShortStyleIdx(idx);
                                    }}
                                >
                                    {/* Style Preview */}
                                    <div className="mb-2 h-12 flex items-center justify-center bg-white rounded overflow-hidden border border-gray-200">
                                        <div 
                                            style={{
                                                ...preset.style,
                                                fontSize: '12px',
                                                lineHeight: '1.2',
                                                margin: 0,
                                                padding: ('background' in preset.style) ? '2px 4px' : '0',
                                                borderRadius: ('borderRadius' in preset.style) ? '4px' : '0',
                                                ...(('borderBottom' in preset.style) && { borderBottom: '2px solid #FF6B35' }),
                                            }}
                                        >
                                            Sample Text
                                        </div>
                                    </div>
                                    {/* Style Name */}
                                    <div className="text-sm font-medium text-gray-800">{preset.name}</div>
                        </button>
                            ))}
                        </div>
                    </div>

                    {/* Highlight Color Selection - Only for Short Videos */}
                    {selectedStyleCategory === 'short' && (
                        <div className="space-y-3">
                            <h5 className="text-base font-semibold text-gray-700">Highlight Color (Optional)</h5>
                            <div className="flex flex-wrap gap-2">
                                    <button
                                    onClick={() => setSelectedHighlightColor(null)}
                                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                        selectedHighlightColor === null
                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    No Highlight
                                    </button>
                                {highlightColors.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setSelectedHighlightColor(color)}
                                        className={`w-10 h-10 rounded-lg border-2 transition-all ${
                                            selectedHighlightColor === color
                                                ? 'border-blue-600 scale-110'
                                                : 'border-gray-200 hover:border-gray-400'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        title={`Highlight with ${color}`}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-gray-500">
                                Random words will be highlighted in the selected color for emphasis
                            </p>
                        </div>
                    )}

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
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-[1.02] font-medium shadow-md text-base"
                        >
                            <Plus size={20} />
                            Add to Timeline
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

            {/* Show existing captions if we have them but are in initial phase */}
            {workflowPhase === 'initial' && captions.length > 0 && (
                <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                                You have {captions.length} captions ready
                            </span>
                        </div>
                        <button
                            onClick={() => setWorkflowPhase('editing')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            Edit & Style →
                        </button>
                    </div>
                    <div className="text-xs text-blue-600">
                        Click "Edit & Style" to modify your captions or change their appearance
                    </div>
                </div>
            )}
        </div>
    )
}

export default CaptionsToolPanel