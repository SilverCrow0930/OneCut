import React, { useState } from 'react'
import { Play, Download, Edit3, Clock, Eye, TrendingUp, Smartphone, Monitor } from 'lucide-react'

interface GeneratedClip {
    id: string
    title: string
    description: string
    duration: number
    src_start: number
    src_end: number
    viral_score?: number
    hook_type?: string
    preview_url: string // Low-res preview URL
    download_url: string // Final clip download URL
    thumbnail_url: string
    aspect_ratio: '9:16' | '16:9'
}

interface ClipResultsViewProps {
    clips: GeneratedClip[]
    onEditClip: (clip: GeneratedClip) => void
    onStartOver: () => void
    isGenerating?: boolean
}

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const getViralScoreColor = (score?: number) => {
    if (!score) return 'text-gray-500'
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-orange-600'
}

const getViralScoreLabel = (score?: number) => {
    if (!score) return 'Unknown'
    if (score >= 8) return 'High Viral'
    if (score >= 6) return 'Medium Viral'
    return 'Low Viral'
}

export const ClipResultsView: React.FC<ClipResultsViewProps> = ({
    clips,
    onEditClip,
    onStartOver,
    isGenerating = false
}) => {
    const [playingClipId, setPlayingClipId] = useState<string | null>(null)
    const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null)

    const handlePlayPreview = (clipId: string) => {
        setPlayingClipId(playingClipId === clipId ? null : clipId)
    }

    const handleDownload = async (clip: GeneratedClip) => {
        setDownloadingClipId(clip.id)
        try {
            const response = await fetch(clip.download_url)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.style.display = 'none'
            a.href = url
            a.download = `${clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error('Download failed:', error)
        } finally {
            setDownloadingClipId(null)
        }
    }

    if (isGenerating) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Generating Your Clips</h3>
                        <p className="text-sm text-gray-600">Creating low-resolution previews...</p>
                    </div>
                </div>
                
                {/* Placeholder cards while generating */}
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="bg-gray-100 rounded-lg p-4 animate-pulse">
                        <div className="flex gap-4">
                            <div className="w-32 h-20 bg-gray-300 rounded"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                                <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🎬 Your Clips Are Ready!
                </h2>
                <p className="text-gray-600">
                    {clips.length} clips generated • Download instantly or edit further
                </p>
            </div>

            {/* Clips Grid */}
            <div className="space-y-4">
                {clips.map((clip) => (
                    <div
                        key={clip.id}
                        className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
                    >
                        <div className="p-4">
                            <div className="flex gap-4">
                                {/* Video Preview */}
                                <div className="relative flex-shrink-0">
                                    <div 
                                        className={`relative rounded-lg overflow-hidden cursor-pointer group ${
                                            clip.aspect_ratio === '9:16' ? 'w-24 h-32' : 'w-40 h-24'
                                        }`}
                                        onClick={() => handlePlayPreview(clip.id)}
                                    >
                                        {playingClipId === clip.id ? (
                                            <video
                                                src={clip.preview_url}
                                                autoPlay
                                                muted
                                                loop
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <>
                                                <img
                                                    src={clip.thumbnail_url}
                                                    alt={clip.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <Play className="w-6 h-6 text-white drop-shadow-lg" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Format indicator */}
                                    <div className="absolute -top-2 -right-2 p-1 bg-blue-500 text-white rounded-full">
                                        {clip.aspect_ratio === '9:16' ? (
                                            <Smartphone className="w-3 h-3" />
                                        ) : (
                                            <Monitor className="w-3 h-3" />
                                        )}
                                    </div>
                                    
                                    {/* Duration badge */}
                                    <div className="absolute bottom-1 right-1 px-2 py-1 bg-black/70 text-white text-xs rounded">
                                        {formatDuration(clip.duration)}
                                    </div>
                                </div>

                                {/* Clip Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
                                            {clip.title}
                                        </h3>
                                        
                                        {/* Viral Score */}
                                        {clip.viral_score && (
                                            <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-full">
                                                <TrendingUp className={`w-3 h-3 ${getViralScoreColor(clip.viral_score)}`} />
                                                <span className={`text-xs font-medium ${getViralScoreColor(clip.viral_score)}`}>
                                                    {clip.viral_score}/10
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                                        {clip.description}
                                    </p>
                                    
                                    {/* Metadata */}
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatDuration(clip.src_start)} - {formatDuration(clip.src_end)}</span>
                                        </div>
                                        {clip.hook_type && (
                                            <div className="flex items-center gap-1">
                                                <Eye className="w-3 h-3" />
                                                <span>{clip.hook_type}</span>
                                            </div>
                                        )}
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
                                            {clip.aspect_ratio}
                                        </span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDownload(clip)}
                                            disabled={downloadingClipId === clip.id}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {downloadingClipId === clip.id ? (
                                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Download className="w-3 h-3" />
                                            )}
                                            Download
                                        </button>
                                        
                                        <button
                                            onClick={() => onEditClip(clip)}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-gray-200 flex items-center justify-between">
                <button
                    onClick={onStartOver}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
                >
                    ← Create New Clips
                </button>
                
                <div className="text-xs text-gray-500">
                    All clips are ready for download • No rendering needed
                </div>
            </div>
        </div>
    )
} 