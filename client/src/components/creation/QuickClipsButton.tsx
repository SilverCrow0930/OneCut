import React, { useState, useRef, useEffect } from 'react'
import { Zap, Upload, Clock, Video, Download, Play, X, Edit, Sparkles } from 'lucide-react'
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

const QuickClipsButton = () => {
    const { user, session, signIn } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60)
    const [videoType, setVideoType] = useState<'talk_audio' | 'action_visual'>('talk_audio')
    const [userPrompt, setUserPrompt] = useState('') // Optional user prompt for Smart Cut

    const [isProcessing, setIsProcessing] = useState(false)
    const [processingProgress, setProcessingProgress] = useState(0)
    const [processingMessage, setProcessingMessage] = useState('')
    const [generatedClips, setGeneratedClips] = useState<QuickClip[]>([])
    const [transcript, setTranscript] = useState<string>('')
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    


    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]

    const getVideoFormat = () => {
        return 'long_horizontal'
    }

    const getContentType = () => {
        return videoType === 'talk_audio' ? 'talking_video' : 'visual_content'
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
        setProcessingMessage('Preparing...')
        setError(null)

        try {
            // 1. Create new project
            setProcessingProgress(5)
            setProcessingMessage('Creating project...')
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
                    processing_progress: 5,
                    processing_message: 'Creating project...',
                    processing_data: {
                        contentType: getContentType(),
                        videoFormat: getVideoFormat(),
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
                    errorMessage = projectResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            const project = await projectResponse.json()

            // 2. Upload file to assets
            setProcessingProgress(10)
            setProcessingMessage('Uploading video...')
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
                    errorMessage = uploadResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            const uploadResult = await uploadResponse.json()
            const fileUri = uploadResult.gsUri
            
            if (!fileUri) {
                console.error('No gsUri found in upload response. Available fields:', Object.keys(uploadResult))
                throw new Error('File upload did not return a valid GCS URI')
            }

            setIsUploading(false)
            setProcessingProgress(15)
            setProcessingMessage('Starting analysis...')

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
                        contentType: getContentType(),
                        targetDuration: parseInt(String(targetDuration)),
                        userPrompt: userPrompt.trim() || undefined
                    })
                    })

            if (!jobResponse.ok) {
                let errorMessage = 'Failed to start processing'
                try {
                    const errorData = await jobResponse.json()
                    errorMessage = errorData?.error || errorMessage
                } catch (e) {
                    errorMessage = jobResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            // Update project with initial processing state
            await fetch(apiPath(`projects/${project.id}`), {
                method: 'PATCH',
                        headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    processing_progress: 15,
                    processing_message: 'Analyzing video...'
                })
            })

            // Close modal and navigate to projects page with highlight
            setIsModalOpen(false)
            router.push(`/projects?highlight=${project.id}`)

        } catch (error) {
            console.error('Processing error:', error)
            setError(error instanceof Error ? error.message : 'An unknown error occurred')
            setIsProcessing(false)
            setIsUploading(false)
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
        setVideoType('talk_audio')
        setUserPrompt('')
        setGeneratedClips([])
        setTranscript('')
        setProcessingProgress(0)
        setProcessingMessage('')
        setIsProcessing(false)
        setIsUploading(false)
        setUploadProgress(0)
        setError(null)
    }

    const handleEditInTimeline = async (clip: QuickClip) => {
        if (!user || !session) {
            signIn()
            return
        }

        try {
            // Create a new project for editing this clip
            const response = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    name: `Edit: ${clip.title}`,
                    initial_clip_data: {
                        clipId: clip.id,
                        start_time: clip.start_time,
                        end_time: clip.end_time,
                        videoUrl: clip.previewUrl,
                        title: clip.title,
                        description: clip.description
                    }
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to create project for editing')
            }

            const project = await response.json()
            
            // Navigate to the new project with clip data in URL params
            router.push(`/projects/${project.id}?clipId=${clip.id}&start=${clip.start_time}&end=${clip.end_time}&url=${encodeURIComponent(clip.previewUrl)}`)
            
        } catch (error) {
            console.error('Failed to create edit project:', error)
            alert('Failed to create project for editing. Please try again.')
        }
    }

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="
                    inline-flex items-center justify-center gap-2 
                    px-6 py-3 rounded-lg font-semibold text-white
                    bg-gradient-to-br from-blue-500 to-teal-500
                    hover:from-blue-600 hover:to-teal-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    shadow-lg hover:shadow-xl
                    transform transition-all duration-200
                    hover:scale-105 active:scale-95
                "
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
                                                    {/* Viral Score */}
                                                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                                        <Sparkles className="w-3 h-3" />
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

                                    {/* Transcript Section - Only show for Talk & Audio content */}
                                    {transcript && getContentType() === 'talking_video' && (
                                        <div className="mt-8">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                <span className="text-2xl">📝</span>
                                                Transcript
                                            </h3>
                                            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                                                <div className="max-h-64 overflow-y-auto">
                                                    <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                                        {transcript}
                                                    </p>
                                                </div>
                                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                                                    <span className="text-xs text-gray-500">
                                                        {transcript.length} characters • Generated from audio analysis
                                                    </span>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(transcript)}
                                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                                    >
                                                        Copy to Clipboard
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
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
                                                                                                        <div className="text-center">
                                                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                                            <p className="text-lg text-gray-600 mb-2">Drop your video here</p>
                                                            <p className="text-sm text-gray-500">or click to browse</p>
                                                        </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Video Type Selection */}
                                    {selectedFile && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                                Select Video Type
                                            </label>
                                            <div className="grid grid-cols-1 gap-3">
                                                <button
                                                    onClick={() => setVideoType('talk_audio')}
                                                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                                                        videoType === 'talk_audio' 
                                                            ? 'border-emerald-500 bg-emerald-50' 
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-2xl">🎙️</div>
                                                        <div className="flex-1">
                                                            <div className="font-medium text-gray-800">Talk & Audio</div>
                                                            <div className="text-sm text-gray-600 mt-1">Podcasts, interviews, tutorials, meetings</div>
                                                        </div>
                                                    </div>
                                                </button>
                                                <button
                                                    onClick={() => setVideoType('action_visual')}
                                                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                                                        videoType === 'action_visual' 
                                                            ? 'border-emerald-500 bg-emerald-50' 
                                                            : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-2xl">🎬</div>
                                                        <div className="flex-1">
                                                            <div className="font-medium text-gray-800">Action & Visual</div>
                                                            <div className="text-sm text-gray-600 mt-1">Gaming, reactions, demos, sports</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Target Duration Settings */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Clock className="w-5 h-5 text-blue-600" />
                                            <label className="text-sm font-semibold text-gray-700">
                                                Target Length: {formatDuration(targetDuration)}
                                            </label>
                                        </div>
                                        

                                        
                                        {/* Slider */}
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

                                    {/* Optional User Prompt */}
                                    {selectedFile && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Custom Instructions (Optional)
                                            </label>
                                            <textarea
                                                value={userPrompt}
                                                onChange={(e) => setUserPrompt(e.target.value)}
                                                placeholder="Tell AI what to focus on... e.g., 'Extract the main discussion points and key insights' or 'Focus on the most engaging moments with good visual content'"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm"
                                                rows={3}
                                                maxLength={500}
                                            />
                                            <div className="flex justify-between items-center mt-1">
                                                <p className="text-xs text-gray-500">
                                                    Give AI specific guidance for better results
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {userPrompt.length}/500
                                                </p>
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