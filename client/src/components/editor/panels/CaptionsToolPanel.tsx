import React, { useState, useEffect } from 'react'
import { Wand2, Download, Copy, RotateCcw, Mic, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'

interface Caption {
    id: number
    startTime: string
    endTime: string
    text: string
}

const CaptionsToolPanel = () => {
    const [isGenerating, setIsGenerating] = useState(false)
    const [captions, setCaptions] = useState<Caption[]>([])
    const [autoSelectedClip, setAutoSelectedClip] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [progressStage, setProgressStage] = useState<'upload' | 'processing' | 'generating' | null>(null)
    const { clips } = useEditor()
    const { session } = useAuth()

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

    // Convert captions back to SRT format
    const convertToSRT = (captions: Caption[]): string => {
        return captions.map(caption => 
            `${caption.id}\n${caption.startTime} --> ${caption.endTime}\n${caption.text}\n`
        ).join('\n')
    }

    const handleOneClickGenerate = async () => {
        if (!autoSelectedClip || !session?.access_token) {
            setError('Please add a video or audio clip to your timeline first')
            return
        }

        setIsGenerating(true)
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
            } else {
                setSuccessMessage(`🎉 Generated ${parsedCaptions.length} captions in ${parsedCaptions[0].startTime.split(',')[0]} language!`)
                // Auto-clear success message after 5 seconds
                setTimeout(() => setSuccessMessage(null), 5000)
            }

        } catch (error: any) {
            console.error('❌ Transcription failed:', error)
            setError(error.message || 'Failed to generate captions')
        } finally {
            setIsGenerating(false)
            setProgressStage(null)
        }
    }

    const handleCopyToClipboard = async () => {
        if (captions.length === 0) return
        
        const srtText = convertToSRT(captions)
        try {
            await navigator.clipboard.writeText(srtText)
            setSuccessMessage('📋 Captions copied to clipboard!')
            setTimeout(() => setSuccessMessage(null), 2000)
        } catch (error) {
            console.error('Failed to copy to clipboard:', error)
            setError('Failed to copy to clipboard')
        }
    }

    const handleDownloadSRT = () => {
        if (captions.length === 0) return

        const srtText = convertToSRT(captions)
        const blob = new Blob([srtText], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `captions-${new Date().toISOString().split('T')[0]}.srt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        setSuccessMessage('📥 SRT file downloaded!')
        setTimeout(() => setSuccessMessage(null), 2000)
    }

    const handleClearCaptions = () => {
        setCaptions([])
        setError(null)
        setSuccessMessage(null)
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
                iconBgColor="bg-purple-50"
                iconColor="text-purple-600"
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

            {/* Main Action */}
            {transcribableClips.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                        <Mic size={32} className="text-purple-500" />
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
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-lg">
                                    {selectedClip.type === 'video' ? '📹' : '🎵'}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-purple-800">
                                        {selectedClip.type === 'video' ? 'Video' : 'Audio'} Clip {selectedClipIndex + 1}
                                    </div>
                                    <div className="text-xs text-purple-600">
                                        Duration: {Math.round((selectedClip.timelineEndMs - selectedClip.timelineStartMs) / 1000)}s
                                    </div>
                                </div>
                                {transcribableClips.length === 1 && !captions.length && (
                                    <div className="ml-auto">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                            <Sparkles size={12} />
                                            Ready
                                        </span>
                                    </div>
                                )}
                            </div>
                            {transcribableClips.length > 1 && (
                                <p className="text-xs text-purple-600">
                                    Auto-selected longest {selectedClip.type} clip
                                </p>
                            )}
                        </div>
                    )}

                    {/* One-Click Generate Button */}
                    <button 
                        onClick={handleOneClickGenerate}
                        disabled={!autoSelectedClip || isGenerating}
                        className="
                            relative overflow-hidden
                            flex items-center justify-center gap-3 w-full px-6 py-5
                            bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-2xl
                            hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 
                            disabled:opacity-50 disabled:cursor-not-allowed
                            font-semibold text-lg shadow-lg hover:shadow-xl
                            transform hover:scale-[1.02] active:scale-[0.98]
                            transition-all duration-300
                            group
                        "
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                        {isGenerating ? (
                            <>
                                <Loader2 size={28} className="animate-spin" />
                                <span>Generating Captions...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={28} />
                                <span>
                                    {transcribableClips.length === 1 ? 'Generate AI Captions' : 'Generate AI Captions'}
                                </span>
                            </>
                        )}
                    </button>
                    
                    {isGenerating && (
                        <div className="space-y-4 animate-in fade-in-50 duration-500">
                            <div className="text-center space-y-3">
                                <div className="text-base text-gray-700 font-medium">
                                    {progressContent.text}
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out"
                                        style={{width: `${progressContent.percent}%`}}
                                    ></div>
                                </div>
                                <div className="text-sm text-gray-500">
                                    This usually takes 30-60 seconds depending on audio length
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Results */}
            {captions.length > 0 && (
                <div className="space-y-5 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleCopyToClipboard}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 transform hover:scale-[1.02] font-medium shadow-md"
                        >
                            <Copy size={18} />
                            Copy Text
                        </button>
                        <button
                            onClick={handleDownloadSRT}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 transform hover:scale-[1.02] font-medium shadow-md"
                        >
                            <Download size={18} />
                            Download SRT
                        </button>
                        <button
                            onClick={handleClearCaptions}
                            className="px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Clear captions"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    {/* Captions Preview */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-200">
                            <h4 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-500" />
                                Generated Captions ({captions.length})
                            </h4>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {captions.slice(0, 6).map((caption, index) => (
                                <div key={caption.id} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-mono text-white bg-purple-500 px-2 py-1 rounded-md">
                                            {caption.startTime.split(',')[0]}
                                        </span>
                                        <span className="text-xs text-gray-400">#{index + 1}</span>
                                    </div>
                                    <p className="text-sm text-gray-800 leading-relaxed">{caption.text}</p>
                                </div>
                            ))}
                            {captions.length > 6 && (
                                <div className="p-4 text-center text-sm text-gray-500 bg-gray-50/50 border-t">
                                    <Sparkles size={14} className="inline mr-1" />
                                    ... and {captions.length - 6} more captions
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick tip */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700 flex items-center gap-1">
                            <span>💡</span>
                            <span>Use the SRT file in any video editor or upload platform</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CaptionsToolPanel