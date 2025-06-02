import React, { useState } from 'react'
import { Wand2, Download, Copy, RotateCcw, Mic } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAssets } from '@/contexts/AssetsContext'
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
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const { clips } = useEditor()
    const { assets } = useAssets()
    const { session } = useAuth()

    // Get video/audio clips that can be transcribed
    const transcribableClips = clips.filter(clip => {
        // Must have an assetId (not text clips or corrupted clips)
        if (!clip.assetId) return false
        
        // Find the associated asset
        const asset = assets.find(a => a.id === clip.assetId)
        
        // Check if this is an external asset (from properties)
        const externalAsset = clip.properties?.externalAsset
        
        let hasAudio = false
        
        if (externalAsset) {
            // For external assets, check if it's a video or audio type
            hasAudio = externalAsset.mime_type?.startsWith('video/') || 
                      externalAsset.mime_type?.startsWith('audio/')
        } else if (asset) {
            // For regular assets, check mime type
            hasAudio = asset.mime_type?.startsWith('video/') || 
                      asset.mime_type?.startsWith('audio/')
        } else {
            // Fallback to clip type if no asset found
            hasAudio = clip.type === 'video' || clip.type === 'audio'
        }
        
        return hasAudio
    })

    console.log('Clips filtering debug:', {
        totalClips: clips.length,
        transcribableClips: transcribableClips.length,
        allClips: clips.map(c => ({
            id: c.id,
            type: c.type,
            assetId: c.assetId,
            hasAsset: !!assets.find(a => a.id === c.assetId),
            assetMimeType: assets.find(a => a.id === c.assetId)?.mime_type,
            externalAsset: !!c.properties?.externalAsset,
            externalMimeType: c.properties?.externalAsset?.mime_type
        })),
        transcribableClipsDetails: transcribableClips.map(c => ({
            id: c.id,
            type: c.type,
            assetId: c.assetId
        }))
    })

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

    const handleGenerateTranscription = async () => {
        if (!selectedClipId || !session?.access_token) {
            setError('Please select a clip and ensure you are logged in')
            return
        }

        setIsGenerating(true)
        setError(null)
        setCaptions([])

        try {
            console.log('🎤 Starting transcription for clip:', selectedClipId)
            
            const response = await fetch(apiPath('transcription/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    clipId: selectedClipId
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
                setError('No captions were generated. The audio might be unclear or contain no speech.')
            }

        } catch (error: any) {
            console.error('❌ Transcription failed:', error)
            setError(error.message || 'Failed to generate transcription')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleCopyToClipboard = async () => {
        if (captions.length === 0) return
        
        const srtText = convertToSRT(captions)
        try {
            await navigator.clipboard.writeText(srtText)
            // Could add a toast notification here
        } catch (error) {
            console.error('Failed to copy to clipboard:', error)
        }
    }

    const handleDownloadSRT = () => {
        if (captions.length === 0) return

        const srtText = convertToSRT(captions)
        const blob = new Blob([srtText], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'captions.srt'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleClearCaptions = () => {
        setCaptions([])
        setError(null)
        setSelectedClipId(null)
    }

    return (
        <div className="flex flex-col w-full gap-4 p-4">
            <PanelHeader 
                icon={Mic} 
                title="AI Captions" 
            />
            
            {/* Clip Selection */}
            <div className="flex flex-col gap-3">
                <h4 className="text-base font-medium text-gray-700">Select Clip to Transcribe</h4>
                {transcribableClips.length === 0 ? (
                    <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                        No video or audio clips found. Add media to your timeline first.
                    </div>
                ) : (
                    <select 
                        value={selectedClipId || ''} 
                        onChange={(e) => setSelectedClipId(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                        <option value="">Choose a clip...</option>
                        {transcribableClips.map((clip, index) => {
                            // Get asset or external asset name
                            const asset = assets.find(a => a.id === clip.assetId)
                            const externalAsset = clip.properties?.externalAsset
                            const assetName = externalAsset?.name || asset?.name || 'Unknown Asset'
                            
                            return (
                                <option key={clip.id} value={clip.id}>
                                    {clip.type === 'video' ? '📹' : '🎵'} {assetName} (Clip {index + 1})
                                </option>
                            )
                        })}
                    </select>
                )}
            </div>

            {/* Generate Button */}
            <div className="flex flex-col gap-3">
                <button 
                    onClick={handleGenerateTranscription}
                    disabled={!selectedClipId || isGenerating}
                    className="
                        flex items-center justify-center gap-3 w-full px-4 py-3
                        bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg
                        hover:from-purple-700 hover:to-blue-700 transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        font-medium shadow-md hover:shadow-lg
                    "
                >
                    <Wand2 size={20} className={isGenerating ? 'animate-spin' : ''} />
                    {isGenerating ? 'Generating Captions...' : 'Generate AI Captions'}
                </button>
                
                {isGenerating && (
                    <div className="text-sm text-center text-gray-600">
                        🎬 Analyzing audio with Gemini AI...
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {/* Captions Display */}
            {captions.length > 0 && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base font-medium text-gray-700">
                            Generated Captions ({captions.length})
                        </h4>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCopyToClipboard}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Copy to clipboard"
                            >
                                <Copy size={16} />
                            </button>
                            <button
                                onClick={handleDownloadSRT}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Download SRT file"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={handleClearCaptions}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Clear captions"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Captions List */}
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                        {captions.map((caption) => (
                            <div key={caption.id} className="p-3 border-b border-gray-100 last:border-b-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono text-gray-500">
                                        {caption.startTime} → {caption.endTime}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-800">{caption.text}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tips */}
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="text-sm font-semibold text-blue-800 mb-1">💡 Tips</h5>
                        <ul className="text-xs text-blue-700 space-y-1">
                            <li>• Download the SRT file to use in other video editors</li>
                            <li>• Copy captions to clipboard for easy sharing</li>
                            <li>• For best results, use clear audio without background noise</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}

export default CaptionsToolPanel