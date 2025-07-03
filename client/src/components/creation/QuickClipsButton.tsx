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

            setIsUploading(false)

            // 3. Start QuickClips processing
            console.log('Starting QuickClips with data:', {
                projectId: project.id,
                fileUri,
                mimeType: selectedFile.type,
                contentType: getContentType(),
                targetDuration: parseInt(String(targetDuration))
            })
            
            let jobResponse;
            const maxRetries = 3;
            let lastError;
            
            // Retry logic for network issues
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    jobResponse = await fetch(apiPath('quickclips/start'), {
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
                    break; // Success, exit retry loop
                } catch (fetchError) {
                    lastError = fetchError;
                    if (attempt === maxRetries) {
                        throw new Error(`Network error after ${maxRetries} attempts: ${fetchError instanceof Error ? fetchError.message : 'Connection failed'}`)
                    }
                    console.warn(`QuickClips request attempt ${attempt} failed, retrying...`)
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
                }
            }
            
            if (!jobResponse) {
                throw lastError || new Error('Failed to make request')
            }

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
                console.error('Full error context:', {
                    status: jobResponse.status,
                    statusText: jobResponse.statusText,
                    requestData: {
                        projectId: project.id,
                        fileUri,
                        mimeType: selectedFile.type,
                        contentType: getContentType(),
                        targetDuration: parseInt(String(targetDuration))
                    }
                })
                throw new Error(errorMessage)
            }

            // Close the modal and redirect to projects page with highlight
            setIsModalOpen(false)
            
            // Reset form state
            setSelectedFile(null)
            setVideoType('talk_audio')
            setUserPrompt('')
            setUploadProgress(0)
            
            // Redirect to projects page with the project highlighted
            router.push(`/projects?highlight=${project.id}`)

        } catch (error) {
            console.error('Error processing video:', error)
            setError(error instanceof Error ? error.message : 'Processing failed')
            setIsUploading(false)
        }
    }

    const handleReset = () => {
        setSelectedFile(null)
        setVideoType('talk_audio')
        setUserPrompt('')
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

                            {/* Upload View */}
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
                                        disabled={!selectedFile || isUploading}
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
                                            {isUploading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-5 h-5" />
                                                    Generate AI Clips
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default QuickClipsButton 