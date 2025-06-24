import React, { useState, useRef, useEffect } from 'react'
import { Zap, Upload, Clock, Video, Download, Play, X, Edit } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { useRouter } from 'next/navigation'

interface QuickClip {
    id: string
    title: string
    description: string
    start_time: number
    end_time: number
    duration: number
    significance: number
    narrative_role: string
    transition_note: string
    downloadUrl: string
    previewUrl: string
    thumbnailUrl: string
    format: string
    aspectRatio: string
}

// Video type selection constants (same as AutoCutToolPanel and HomeHeroSection)
const VIDEO_TYPES = {
    talk_audio: {
        label: "Talk & Audio",
        icon: "🎙️",
        description: "Podcasts, interviews, tutorials, meetings",
        contentType: "talking_video"
    },
    action_visual: {
        label: "Action & Visual", 
        icon: "🎬",
        description: "Gaming, reactions, demos, sports",
        contentType: "visual_content"
    }
}

const QuickClipsButton = () => {
    const { user, session, signIn } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60)
    const [videoType, setVideoType] = useState<'talk_audio' | 'action_visual'>('talk_audio') // Default to cheaper option
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingProgress, setProcessingProgress] = useState(0)
    const [processingMessage, setProcessingMessage] = useState('')
    const [generatedClips, setGeneratedClips] = useState<QuickClip[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]

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
            // 1. Create new project
            const projectResponse = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `Smart Cut - ${selectedFile.name}`,
                    processing_status: 'queued',
                    processing_type: 'quickclips',
                    processing_progress: 0,
                    processing_message: 'Preparing for processing...',
                    processing_data: {
                        contentType: VIDEO_TYPES[videoType].contentType,
                        videoFormat: targetDuration < 120 ? 'short' : 'long',
                        targetDuration,
                        filename: selectedFile.name
                    }
                })
            })

            if (!projectResponse.ok) {
                let errorMessage = 'Failed to create project'
                try {
                    const errorData = await projectResponse.json()
                    errorMessage = errorData?.error || errorMessage
                } catch (e) {
                    // If JSON parsing fails, use the status text or generic message
                    errorMessage = projectResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            const project = await projectResponse.json()

            // 2. Upload file to assets
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('projectId', project.id)

            const uploadResponse = await fetch(apiPath('assets/upload-to-gcs'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: formData
            })

            if (!uploadResponse.ok) {
                let errorMessage = 'Failed to upload file'
                try {
                    const errorData = await uploadResponse.json()
                    errorMessage = errorData?.error || errorMessage
                } catch (e) {
                    // If JSON parsing fails, use the status text or generic message
                    errorMessage = uploadResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            const uploadResult = await uploadResponse.json()
            console.log('Upload response:', uploadResult)
            
            const fileUri = uploadResult.gsUri
            console.log('Extracted fileUri:', fileUri)
            
            if (!fileUri) {
                console.error('No gsUri found in upload response. Available fields:', Object.keys(uploadResult))
                throw new Error('File upload did not return a valid GCS URI')
            }

            // 3. Start QuickClips processing
            const jobResponse = await fetch(apiPath('quickclips/start'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: project.id,
                    fileUri,
                    mimeType: selectedFile.type,
                    contentType: VIDEO_TYPES[videoType].contentType,
                    targetDuration
                })
            })

            if (!jobResponse.ok) {
                let errorMessage = 'Failed to start processing'
                try {
                    const errorData = await jobResponse.json()
                    console.error('QuickClips API Error Details:', errorData)
                    
                    if (errorData.errors && Array.isArray(errorData.errors)) {
                        // Validation errors - show specific messages
                        const validationMessages = errorData.errors.map((err: any) => err.msg || err.message).join(', ')
                        errorMessage = `Validation error: ${validationMessages}`
                    } else {
                        errorMessage = errorData?.error || errorData?.message || errorMessage
                    }
                } catch (e) {
                    errorMessage = jobResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            const jobData = await jobResponse.json()
            console.log('Job started:', jobData)

            setIsUploading(false)

            // 4. Poll for job completion
            const pollJob = async () => {
                try {
                    const statusResponse = await fetch(apiPath(`quickclips/status/${jobData.jobId}`), {
                        headers: {
                            'Authorization': `Bearer ${session?.access_token}`
                        }
                    })

                    if (statusResponse.ok) {
                        const status = await statusResponse.json()
                        setProcessingProgress(status.progress || 0)
                        setProcessingMessage(status.message || 'Processing...')

                        if (status.status === 'completed' && status.clips) {
                            setGeneratedClips(status.clips)
                            setIsProcessing(false)
                            clearInterval(pollInterval)
                        } else if (status.status === 'failed') {
                            throw new Error(status.error || 'Processing failed')
                        }
                    }
                } catch (error) {
                    console.error('Error polling job status:', error)
                    setError('Failed to check processing status')
                    setIsProcessing(false)
                    clearInterval(pollInterval)
                }
            }

            const pollInterval = setInterval(pollJob, 3000)
            pollJob() // Initial call

        } catch (error) {
            console.error('Error starting processing:', error)
            setError(error instanceof Error ? error.message : 'Processing failed, please try again')
            setIsProcessing(false)
            setIsUploading(false)
        }
    }

    const handleDownload = (clip: QuickClip) => {
        // Create a temporary link to download the file
        const link = document.createElement('a')
        link.href = clip.downloadUrl
        link.download = `${clip.title}.mp4`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleReset = () => {
        setSelectedFile(null)
        setGeneratedClips([])
        setIsProcessing(false)
        setProcessingProgress(0)
        setProcessingMessage('')
        setError(null)
        setIsUploading(false)
        setUploadProgress(0)
    }

    const handleEditInTimeline = async (clip: QuickClip) => {
        try {
            // Navigate to editor with the clip data
            router.push(`/projects/new?clip=${encodeURIComponent(JSON.stringify(clip))}`)
        } catch (error) {
            console.error('Error navigating to editor:', error)
            alert('Failed to open editor')
        }
    }

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
                <Zap className="w-5 h-5" />
                                            <span>Smart Cut</span>
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-start justify-between px-8 py-6 border-b border-gray-200">
                            <div className="text-left">
                                <h2 className="text-2xl font-bold text-gray-900">Smart Cut</h2>
                                <p className="text-gray-600 mt-1">Transform Hours into Highlights</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-8 py-6">
                            {/* Error Message */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
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
                                            <div key={clip.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
                                                {/* Thumbnail Section */}
                                                <div className="relative group">
                                                                                        <img
                                        src={clip.thumbnailUrl}
                                        alt={clip.title}
                                        className="w-full h-48 object-cover"
                                    />
                                                    {/* Preview Overlay */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button 
                                                            onClick={() => window.open(clip.previewUrl, '_blank')}
                                                            className="bg-white/20 hover:bg-white/30 rounded-full p-3 backdrop-blur-sm transition-all transform hover:scale-110"
                                                        >
                                                            <Play className="w-6 h-6 text-white" />
                                                        </button>
                                                    </div>
                                                    {/* Duration Badge */}
                                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                                        {formatDuration(clip.duration)}
                                                    </div>
                                                    {/* Viral Score - Removed star emoji */}
                                                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                                        <span>{clip.significance}</span>
                                                    </div>
                                                </div>

                                                {/* Content Section */}
                                                <div className="p-4">
                                                    <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">{clip.title}</h4>
                                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{clip.description}</p>
                                                    
                                                    {/* Action Buttons */}
                                                    <div className="space-y-2">
                                                        <button
                                                            onClick={() => handleDownload(clip)}
                                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-medium rounded-lg transition-all duration-300"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                            Download Clip
                                                        </button>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleEditInTimeline(clip)}
                                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-lg transition-all duration-300"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                                Edit
                                                            </button>
                                                            <button 
                                                                onClick={() => window.open(clip.previewUrl, '_blank')}
                                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all duration-300"
                                                            >
                                                                <Play className="w-4 h-4" />
                                                                Preview
                                                            </button>
                                                        </div>
                                                    </div>
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
                                /* Upload View */
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
                                                                                                        <div className="text-center">
                                                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                                            <p className="text-lg text-gray-600 mb-2">Drop your video here</p>
                                                            <p className="text-sm text-gray-500">or click to browse</p>
                                                        </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Configuration Options - Only show after file upload */}
                                    {selectedFile && (
                                        <div className="space-y-6">
                                            {/* Video Type Selection */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                                    Select Video Type
                                                </label>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {Object.entries(VIDEO_TYPES).map(([key, type]) => (
                                                        <button
                                                            key={key}
                                                            onClick={() => setVideoType(key as 'talk_audio' | 'action_visual')}
                                                            className={`p-4 rounded-lg border-2 transition-all text-left ${
                                                                videoType === key 
                                                                    ? 'border-blue-500 bg-blue-50' 
                                                                    : 'border-gray-200 hover:border-gray-300'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-2xl">{type.icon}</div>
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-gray-800">{type.label}</div>
                                                                    <div className="text-sm text-gray-600 mt-1">{type.description}</div>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Target Duration */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Clock className="w-5 h-5 text-blue-600" />
                                                    <label className="text-sm font-medium text-gray-700">
                                                        Target Length: {formatDuration(targetDuration)}
                                                    </label>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    <input
                                                        type="range"
                                                        min="20"
                                                        max="1800"
                                                        value={targetDuration}
                                                        onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                                                        className="
                                                            w-full h-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full appearance-none cursor-pointer
                                                            [&::-webkit-slider-thumb]:appearance-none 
                                                            [&::-webkit-slider-thumb]:w-6 
                                                            [&::-webkit-slider-thumb]:h-6 
                                                            [&::-webkit-slider-thumb]:rounded-full 
                                                            [&::-webkit-slider-thumb]:bg-gradient-to-r
                                                            [&::-webkit-slider-thumb]:from-blue-500
                                                            [&::-webkit-slider-thumb]:to-purple-500
                                                            [&::-webkit-slider-thumb]:border-3
                                                            [&::-webkit-slider-thumb]:border-white
                                                            [&::-webkit-slider-thumb]:shadow-lg
                                                            [&::-webkit-slider-thumb]:cursor-pointer
                                                            [&::-webkit-slider-thumb]:hover:scale-110
                                                            [&::-webkit-slider-thumb]:transition-transform
                                                        "
                                                    />
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span className="font-medium">20s</span>
                                                        <span className="font-medium">30m</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Generate Button */}
                                    <div className="pt-2">
                                        <button
                                            onClick={handleStartProcessing}
                                            disabled={!selectedFile || isProcessing || isUploading}
                                            className="
                                                w-full bg-gradient-to-r from-emerald-600 to-teal-600 
                                                hover:from-emerald-700 hover:to-teal-700
                                                disabled:from-gray-400 disabled:to-gray-500
                                                text-white font-bold text-lg
                                                px-6 py-4 rounded-2xl 
                                                transition-all duration-300 shadow-lg hover:shadow-xl 
                                                disabled:cursor-not-allowed 
                                                transform hover:scale-105 active:scale-95
                                                relative overflow-hidden group
                                            "
                                        >
                                            {/* Button glow effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl"></div>
                                            
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                <Zap className="w-5 h-5" />
                                                Generate AI Clips
                                            </span>
                                        </button>

                                    </div>
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