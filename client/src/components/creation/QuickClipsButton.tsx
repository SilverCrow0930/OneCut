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
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60)
    const [videoType, setVideoType] = useState<'talk_audio' | 'action_visual'>('talk_audio')
    const [userPrompt, setUserPrompt] = useState('') // Optional user prompt for Smart Cut

    const [isProcessing, setIsProcessing] = useState(false)
    const [processingProgress, setProcessingProgress] = useState(0)
    const [processingMessage, setProcessingMessage] = useState('')
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
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
                    errorMessage = uploadResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            const uploadResult = await uploadResponse.json()

            // 3. Start processing
            const processingResponse = await fetch(apiPath('quickclips/process'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: project.id,
                    assetId: uploadResult.id,
                    contentType: getContentType(),
                    videoFormat: getVideoFormat(),
                    targetDuration,
                    userPrompt
                })
            })

            if (!processingResponse.ok) {
                let errorMessage = 'Failed to start processing'
                try {
                    const errorData = await processingResponse.json()
                    errorMessage = errorData?.error || errorMessage
                } catch (e) {
                    errorMessage = processingResponse.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }

            // Navigate to projects page with this project highlighted
            router.push(`/projects?highlight=${project.id}&filter=quickclips`)

        } catch (error) {
            console.error('Error processing video:', error)
            setError(error instanceof Error ? error.message : 'Processing failed')
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
        setVideoType('talk_audio')
        setUserPrompt('')
        setProcessingProgress(0)
        setProcessingMessage('')
        setIsProcessing(false)
        setIsUploading(false)
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
        <div className="relative">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="video/*"
                className="hidden"
            />
            <button
                onClick={() => {
                    if (!user) {
                        signIn()
                        return
                    }
                    if (selectedFile) {
                        handleStartProcessing()
                    } else {
                        fileInputRef.current?.click()
                    }
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                    relative w-full px-6 py-4 rounded-xl border-2 border-dashed
                    transition-all duration-200 overflow-hidden
                    ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                    ${selectedFile ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white' : 'bg-white'}
                `}
                disabled={isProcessing || isUploading}
            >
                {/* Background animation */}
                <div className={`
                    absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
                    transition-opacity duration-500
                    ${selectedFile ? 'opacity-100' : 'opacity-0'}
                `} />

                {/* Content */}
                <div className="relative z-10">
                    {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-lg font-medium">
                                <Video className="w-5 h-5" />
                                {selectedFile.name}
                            </div>
                            <p className="text-sm opacity-80">
                                Click to start processing
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-lg font-medium text-gray-700">
                                <Upload className="w-5 h-5" />
                                Upload Video
                            </div>
                            <p className="text-sm text-gray-500">
                                Drag & drop or click to select
                            </p>
                        </div>
                    )}
                </div>

                {/* Processing/Upload State */}
                {(isProcessing || isUploading) && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="flex items-center gap-3 text-white">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {isUploading ? 'Uploading...' : 'Processing...'}
                        </div>
                    </div>
                )}
            </button>

            {error && (
                <div className="mt-2 text-sm text-red-500">
                    {error}
                </div>
            )}
        </div>
    )
}

export default QuickClipsButton 