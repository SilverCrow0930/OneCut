import React, { useState, useRef, useEffect } from 'react'
import { Zap, Upload, Clock, Users, BookOpen, Mic, Video, Download, Play, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuickClips, QuickClip } from '@/contexts/QuickClipsContext'
import { apiPath } from '@/lib/config'

const QuickClipsButton = () => {
    const { user, session, signIn } = useAuth()
    const { sendQuickClipsRequest, onQuickClipsResponse, onQuickClipsState } = useQuickClips()
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60)
    const [contentType, setContentType] = useState('talking_video')
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingProgress, setProcessingProgress] = useState(0)
    const [processingMessage, setProcessingMessage] = useState('')
    const [generatedClips, setGeneratedClips] = useState<QuickClip[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    
    const contentTypes = [
        { id: 'podcast', label: 'Podcast', icon: Mic },
        { id: 'professional_meeting', label: 'Meeting', icon: Users },
        { id: 'educational_video', label: 'Tutorial', icon: BookOpen },
        { id: 'talking_video', label: 'Talking Video', icon: Video }
    ]

    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]

    const getVideoFormat = (durationSeconds: number) => {
        return durationSeconds < 120 ? 'short_vertical' : 'long_horizontal'
    }

    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
        } else {
            const hours = Math.floor(seconds / 3600)
            const minutes = Math.floor((seconds % 3600) / 60)
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
        }
    }

    const getClosestInterval = (value: number) => {
        return timeIntervals.reduce((prev, curr) => 
            Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
        )
    }

    const handleDurationChange = (value: number) => {
        const closestInterval = getClosestInterval(value)
        setTargetDuration(closestInterval)
    }

    // WebSocket event listeners
    useEffect(() => {
        onQuickClipsState((state) => {
            console.log('QuickClips state update:', state)
            setProcessingProgress(state.progress)
            setProcessingMessage(state.message)
            
            if (state.state === 'error') {
                setError(state.message)
                setIsProcessing(false)
            } else if (state.state === 'completed') {
                setIsProcessing(false)
            }
        })

        onQuickClipsResponse((response) => {
            console.log('QuickClips response:', response)
            
            if (response.success && response.clips) {
                setGeneratedClips(response.clips)
                setIsProcessing(false)
            } else {
                setError(response.error || 'Processing failed')
                setIsProcessing(false)
            }
        })
    }, [onQuickClipsState, onQuickClipsResponse])

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith('video/')) {
            setSelectedFile(file)
            setError(null)
        }
    }

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        const files = Array.from(e.dataTransfer.files)
        const videoFile = files.find(file => file.type.startsWith('video/'))
        
        if (videoFile) {
            setSelectedFile(videoFile)
            setError(null)
        }
    }

    const uploadFileToGCS = async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append('file', file)

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100
                    setUploadProgress(progress)
                }
            })

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText)
                        resolve(response.gsUri)
                    } catch (error) {
                        reject(new Error('Failed to parse upload response'))
                    }
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`))
                }
            })

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'))
            })

            xhr.open('POST', apiPath('assets/upload-to-gcs'))
            xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
            xhr.send(formData)
        })
    }

    const handleStartProcessing = async () => {
        if (!user) {
            signIn()
            return
        }

        if (!selectedFile) {
            alert('Please select a video file first')
            return
        }

        setIsUploading(true)
        setIsProcessing(true)
        setProcessingProgress(0)
        setError(null)

        try {
            // Upload file to GCS
            const fileUri = await uploadFileToGCS(selectedFile)
            setIsUploading(false)

            // Send to QuickClips processing
            sendQuickClipsRequest({
                fileUri,
                mimeType: selectedFile.type,
                contentType,
                targetDuration,
                videoFormat: getVideoFormat(targetDuration)
            })

        } catch (error) {
            console.error('Error processing video:', error)
            setError(error instanceof Error ? error.message : 'Upload failed')
            setIsUploading(false)
            setIsProcessing(false)
        }
    }

    const handleDownload = (clip: QuickClip) => {
        // TODO: Implement actual download when backend provides real URLs
        console.log('Downloading clip:', clip)
        // For now, just open a new tab with the preview
        window.open(clip.previewUrl, '_blank')
    }

    const handleReset = () => {
        setSelectedFile(null)
        setGeneratedClips([])
        setProcessingProgress(0)
        setProcessingMessage('')
        setIsProcessing(false)
        setIsUploading(false)
        setUploadProgress(0)
        setError(null)
    }

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="
                    inline-flex items-center justify-center gap-2 
                    px-6 py-3 rounded-lg font-semibold text-white
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-700 hover:to-teal-700
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                    shadow-lg hover:shadow-xl
                    transform transition-all duration-200
                    hover:scale-105 active:scale-95
                "
            >
                <Zap className="w-5 h-5" />
                <span>Quick AI Clips</span>
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Quick AI Clips</h2>
                                <p className="text-gray-600">Get instant downloadable clips from your video</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Error Message */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-800 text-sm">{error}</p>
                                </div>
                            )}

                            {generatedClips.length > 0 ? (
                                /* Results View */
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Generated Clips ({generatedClips.length})
                                        </h3>
                                        <button
                                            onClick={handleReset}
                                            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            Process New Video
                                        </button>
                                    </div>

                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {generatedClips.map((clip) => (
                                            <div key={clip.id} className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-shadow">
                                                <div className="relative mb-3">
                                                    <img
                                                        src={clip.thumbnail}
                                                        alt={clip.title}
                                                        className="w-full h-32 object-cover rounded-lg"
                                                    />
                                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                                        {formatDuration(clip.duration)}
                                                    </div>
                                                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500 text-white text-xs px-2 py-1 rounded">
                                                        <Zap className="w-3 h-3" />
                                                        <span>{clip.viral_score}</span>
                                                    </div>
                                                </div>
                                                
                                                <h4 className="font-medium text-gray-900 mb-2">{clip.title}</h4>
                                                <p className="text-xs text-gray-600 mb-3">{clip.description}</p>
                                                
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleDownload(clip)}
                                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Download
                                                    </button>
                                                    <button 
                                                        onClick={() => window.open(clip.previewUrl, '_blank')}
                                                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (isProcessing || isUploading) ? (
                                /* Processing View */
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Zap className="w-8 h-8 text-white animate-pulse" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {isUploading ? 'Uploading Video...' : 'Processing Your Video'}
                                    </h3>
                                    <p className="text-gray-600 mb-6">
                                        {isUploading ? 'Uploading to cloud storage...' : processingMessage || 'AI is analyzing and creating clips...'}
                                    </p>
                                    
                                    <div className="max-w-xs mx-auto">
                                        <div className="bg-gray-200 rounded-full h-2 mb-2">
                                            <div 
                                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${isUploading ? uploadProgress : processingProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            {Math.round(isUploading ? uploadProgress : processingProgress)}% complete
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                /* Upload View - Same as before */
                                <div className="space-y-6">
                                    {/* Upload Area */}
                                    <div>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            accept="video/*"
                                            className="hidden"
                                        />
                                        
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDragOver={handleDragOver}
                                            onDrop={handleDrop}
                                            className={`
                                                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                                                transition-all duration-300
                                                ${selectedFile ? 
                                                    'border-emerald-400 bg-emerald-50' : 
                                                    isDragOver ?
                                                        'border-emerald-500 bg-emerald-100 scale-105' :
                                                        'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                                                }
                                            `}
                                        >
                                            {selectedFile ? (
                                                <div className="flex items-center justify-center gap-3">
                                                    <Video className="w-8 h-8 text-emerald-600" />
                                                    <div>
                                                        <p className="font-medium text-emerald-800">{selectedFile.name}</p>
                                                        <p className="text-sm text-emerald-600">Click to change file</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                                    <p className="text-lg text-gray-600 mb-2">Drop your video here</p>
                                                    <p className="text-sm text-gray-500">or click to browse</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Settings */}
                                    <div className="grid md:grid-cols-2 gap-6">
                                        {/* Content Type */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">Content Type</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {contentTypes.map((type) => {
                                                    const Icon = type.icon
                                                    return (
                                                        <button
                                                            key={type.id}
                                                            onClick={() => setContentType(type.id)}
                                                            className={`
                                                                flex items-center gap-2 p-3 rounded-lg border text-sm
                                                                ${contentType === type.id ? 
                                                                    'border-emerald-500 bg-emerald-50 text-emerald-700' : 
                                                                    'border-gray-200 hover:border-emerald-300'
                                                                }
                                                            `}
                                                        >
                                                            <Icon className="w-4 h-4" />
                                                            <span>{type.label}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Target Duration */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                                Target Length: {formatDuration(targetDuration)}
                                            </label>
                                            <div className="space-y-3">
                                                <input
                                                    type="range"
                                                    min="20"
                                                    max="1800"
                                                    value={targetDuration}
                                                    onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                                />
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>20s</span>
                                                    <span>30m</span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                                                        <Clock className="w-4 h-4" />
                                                        {getVideoFormat(targetDuration) === 'short_vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={handleStartProcessing}
                                        disabled={!selectedFile || isProcessing || isUploading}
                                        className="
                                            w-full bg-gradient-to-r from-emerald-600 to-teal-600 
                                            hover:from-emerald-700 hover:to-teal-700
                                            disabled:from-gray-400 disabled:to-gray-500
                                            text-white font-bold text-lg
                                            px-6 py-4 rounded-xl 
                                            transition-all duration-300 shadow-lg hover:shadow-xl 
                                            disabled:cursor-not-allowed 
                                            transform hover:scale-105 active:scale-95
                                        "
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            <Zap className="w-5 h-5" />
                                            Generate AI Clips
                                        </span>
                                    </button>

                                    <p className="text-xs text-gray-500 text-center">
                                        Get instant downloadable clips in minutes - no timeline editing required!
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default QuickClipsButton 