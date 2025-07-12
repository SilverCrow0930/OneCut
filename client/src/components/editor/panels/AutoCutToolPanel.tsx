import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAssets } from '@/contexts/AssetsContext'
import { apiPath } from '@/lib/config'
import { useRouter } from 'next/navigation'

import { CheckCircle2, AlertCircle, Loader2, Brain, Sparkles, Play, Download, RefreshCw, Clock, Eye, Upload, Video, Edit } from 'lucide-react'
import VideoDetailsSection from './VideoDetailsSection'
import { useEditor } from '@/contexts/EditorContext'
import { v4 as uuid } from 'uuid'
import { useParams } from 'next/navigation'
import { TrackType } from '@/types/editor'
import PanelHeader from './PanelHeader'
import { FilePreview } from './auto-cut/FilePreview'
import { ActionButtons } from './auto-cut/ActionButtons'
import { ProcessingStatus } from './auto-cut/ProcessingStatus'
import { useCredits } from '@/contexts/CreditsContext'
import { calculateSmartCutCredits } from '@/lib/utils';
import { useCallback as useCallbackEffect } from 'react';

type ProcessingState = 'idle' | 'starting' | 'queued' | 'processing' | 'completed' | 'failed'

interface QuickClipsJob {
    id: string
    projectId: string
    status: ProcessingState
    progress: number
    message: string
    error?: string
    clips?: any[]
    description?: string
    transcript?: string
    originalProjectId?: string // Reference to the original project when created from editor
}

// Video type selection constants
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

const AutoCutToolPanel = () => {
    const [videoType, setVideoType] = useState<'talk_audio' | 'action_visual'>('talk_audio')
    const [targetDuration, setTargetDuration] = useState(60) // Default 60 seconds (1 minute)
    const [userPrompt, setUserPrompt] = useState('') // Optional user prompt for Smart Cut
    const [showConfig, setShowConfig] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadedAsset, setUploadedAsset] = useState<any>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [currentJob, setCurrentJob] = useState<QuickClipsJob | null>(null)
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
    const [processedClips, setProcessedClips] = useState<any[]>([])
    const [transcript, setTranscript] = useState<string>('')
    
    // Drag and drop state
    const [isDragOver, setIsDragOver] = useState(false)
    
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { session } = useAuth()
    const { refresh, assets } = useAssets()
    const { tracks, executeCommand } = useEditor()
    const { consumeCredits } = useCredits()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId
    const router = useRouter()

    // Specific time intervals in seconds (20s to 30m)
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

    const getVideoFormat = () => {
        return 'long_horizontal'
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

    const getFormatInfo = () => {
        return { format: 'Horizontal', aspectRatio: '16:9', icon: '💻', description: 'Desktop/TV' }
    }

    const handleClipsReady = useCallback((clips: any[]) => {
        if (!uploadedAsset || clips.length === 0) return

        try {
            // Create new video track for clips
            const newTrack = {
                id: uuid(),
                name: `Smart Cut - ${selectedFile?.name || 'Video'}`,
                type: 'video' as TrackType,
                height: 120,
                isVisible: true,
                isMuted: false,
                isLocked: false,
                volume: 1,
                projectId: projectId || '',
                index: tracks.length
            }

            // Create clips for timeline
            const newClips = clips.map((clip, index) => {
                const duration = (clip.end_time - clip.start_time) * 1000 // Convert to ms
                const timelineStartMs = index === 0 ? 0 : clips.slice(0, index).reduce((acc, c) => acc + ((c.end_time - c.start_time) * 1000), 0)

                return {
                    id: uuid(),
                    trackId: newTrack.id,
                    assetId: uploadedAsset.id,
                    type: 'video' as const,
                    sourceStartMs: clip.start_time * 1000,
                    sourceEndMs: clip.end_time * 1000,
                    timelineStartMs,
                    timelineEndMs: timelineStartMs + duration,
                    assetDurationMs: uploadedAsset.duration || 0,
                    volume: 1,
                    speed: 1,
                    properties: {
                        name: `${clip.title} (${clip.significance || 'N/A'}/10)`,
                        isLocked: false,
                        isMuted: false,
                        isSolo: false,
                    },
                    createdAt: new Date().toISOString(),
                }
            })

            // Add track and clips to timeline
            executeCommand({
                type: 'BATCH',
                payload: {
                    commands: [
                        {
                            type: 'ADD_TRACK',
                            payload: { track: newTrack }
                        },
                        ...newClips.map(clip => ({
                            type: 'ADD_CLIP' as const,
                            payload: { clip }
                        }))
                    ]
                }
            })

            console.log(`Added ${clips.length} clips to timeline`)
            
        } catch (error) {
            console.error('Error adding clips to timeline:', error)
            setError('Failed to add clips to timeline')
        }
    }, [uploadedAsset, selectedFile, projectId, tracks.length, executeCommand])

    // Poll for job status when processing
    useEffect(() => {
        if (!currentJob || !['queued', 'processing'].includes(currentJob.status)) {
            return
        }

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(apiPath(`quickclips/status/${currentJob.id}`), {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                })

                if (response.ok) {
                    const jobData = await response.json()
                    setCurrentJob(prev => prev ? { ...prev, ...jobData } : null)

                    // If completed, process the clips
                    if (jobData.status === 'completed' && jobData.clips?.length > 0) {
                        setCurrentJob(prev => prev ? { 
                            ...prev, 
                            clips: jobData.clips,
                            description: jobData.description 
                        } : null)
                        
                        // Store transcript if available
                        if (jobData.transcript) {
                            setTranscript(jobData.transcript)
                        }
                        
                        // Add clips to timeline
                        handleClipsReady(jobData.clips)
                    }
                }
            } catch (error) {
                console.error('Error polling job status:', error)
            }
        }, 3000) // Poll every 3 seconds

        return () => clearInterval(pollInterval)
    }, [currentJob?.id, currentJob?.status, session?.access_token, handleClipsReady])

    // Check if there's already a Smart Cut project for this project on mount
    useEffect(() => {
        const checkExistingSmartCutProject = async () => {
            if (!projectId || !session) return

            try {
                const response = await fetch(apiPath(`projects/${projectId}`), {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                })

                if (response.ok) {
                    const project = await response.json()
                    
                    // Check if this project has Smart Cut results
                    if (project.processing_result?.clips && project.processing_result.clips.length > 0) {
                        setCurrentJob({
                            id: `existing_${projectId}`,
                            projectId,
                            status: 'completed',
                            progress: 100,
                            message: 'Smart Cut completed',
                            clips: project.processing_result.clips,
                            description: project.processing_result.description
                        })

                        if (project.processing_result.transcript) {
                            setTranscript(project.processing_result.transcript)
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking existing Smart Cut project:', error)
            }
        }

        checkExistingSmartCutProject()
    }, [projectId, session?.access_token])

    // Function to refresh projects list
    const refreshProjectsList = useCallbackEffect(async () => {
        try {
            const response = await fetch(apiPath('projects'), {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to refresh projects');
            }
            // The ProjectsList component will automatically update due to the fetch
        } catch (error) {
            console.error('Error refreshing projects:', error);
        }
    }, [session?.access_token]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith('video/')) {
            setSelectedFile(file)
            setShowConfig(true)
            setError(null)
        }
    }

    // Drag and drop handlers
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
            setShowConfig(true)
            setError(null)
        }
    }

    const resetState = () => {
        setSelectedFile(null)
        setUploadedAsset(null)
        setCurrentJob(null)
        setError(null)
        setUploadProgress(0)
        setShowConfig(false)
        setVideoType('talk_audio') // Reset to default cheaper option
        setTargetDuration(60) // Reset to default 60 seconds (1 minute)
        setUserPrompt('') // Reset user prompt
        setTranscript('') // Reset transcript
    }

    const handleStartProcessing = async () => {
        if (!selectedFile || !session) return

        // Calculate credits needed based on video duration and type
        try {
            // Create a temporary URL for the video to get its duration
            const videoUrl = URL.createObjectURL(selectedFile)
            const video = document.createElement('video')
            
            // Wait for video metadata to load to get duration
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = resolve
                video.onerror = reject
                video.src = videoUrl
            })
            
            // Get video duration and calculate credits
            const durationInSeconds = video.duration
            const creditsNeeded = calculateSmartCutCredits(durationInSeconds, videoType)
            
            console.log(`Video duration: ${Math.ceil(durationInSeconds / 60)} minutes (${(durationInSeconds / 3600).toFixed(2)} hours)`)
            console.log(`Credits needed: ${creditsNeeded} (${videoType} type)`)
            
            // Clean up
            URL.revokeObjectURL(videoUrl)
            
            // Consume credits before processing
            const featureName = videoType === 'talk_audio' ? 'smart-cut-audio' : 'smart-cut-visual'
            const success = await consumeCredits(creditsNeeded, featureName)
            
            if (!success) {
                setError('Insufficient credits. Please upgrade your plan or try a shorter video.')
                return
            }
            
            // If credits were successfully consumed, continue with upload and processing
        } catch (error) {
            console.error('Error calculating video duration:', error)
            setError('Failed to calculate video duration. Please try again.')
            return
        }

        setIsUploading(true)
        setError(null)

        try {
            // 1. Upload file
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('projectId', projectId || '')

            const xhr = new XMLHttpRequest()
            
            const uploadPromise = new Promise<any>((resolve, reject) => {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded * 100) / event.total)
                        setUploadProgress(progress)
                    }
                })

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText))
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status}`))
                    }
                })

                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed'))
                })

                xhr.open('POST', apiPath('assets/upload-to-gcs'))
                xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
                xhr.send(formData)
            })

            const uploadResult = await uploadPromise
            const fileUri = uploadResult.gsUri
            
            if (!fileUri) {
                console.error('No gsUri found in upload response. Available fields:', Object.keys(uploadResult))
                throw new Error('File upload did not return a valid GCS URI')
            }

            setUploadedAsset({
                id: uploadResult.id,
                mime_type: uploadResult.mimeType || selectedFile.type,
                duration: uploadResult.duration || null
            })

            // 2. Start QuickClips processing
            let jobResponse;
            const maxRetries = 3;
            let lastError;
            
            // First create a new project specifically for Smart Cut
            const smartCutProjectName = `Smart Cut: ${selectedFile.name}`;
            const createProjectResponse = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: smartCutProjectName,
                    processing_type: 'quickclips',
                    processing_status: 'queued',
                    processing_message: 'Preparing for Smart Cut...',
                    processing_data: {
                        originalProjectId: projectId,
                        contentType: VIDEO_TYPES[videoType].contentType,
                        targetDuration
                    }
                })
            });
            
            if (!createProjectResponse.ok) {
                throw new Error('Failed to create Smart Cut project');
            }
            
            const smartCutProject = await createProjectResponse.json();
            const smartCutProjectId = smartCutProject.id;
            
            // Retry logic for network issues
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    jobResponse = await fetch(apiPath('quickclips/start'), {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            projectId: smartCutProjectId,
                            fileUri,
                            mimeType: selectedFile.type,
                            contentType: VIDEO_TYPES[videoType].contentType,
                            targetDuration,
                            userPrompt: userPrompt.trim() || undefined,
                            isEditorMode: false // Now we can use the standard flow
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
                throw new Error(errorMessage)
            }

            const jobData = await jobResponse.json()
            
            // Store both project IDs for reference
            setCurrentJob({
                id: jobData.jobId,
                projectId: smartCutProjectId, // Use the Smart Cut project ID
                status: 'queued',
                progress: 0,
                message: 'Queued for processing...',
                originalProjectId: projectId // Keep track of original project
            })

            // Show success message with link to view the Smart Cut project
            setShowConfig(false)
            
            // Refresh the projects list to show the new project immediately
            await refreshProjectsList();
            
            // Redirect to projects page with highlight parameter to show processing status
            router.push(`/projects?highlight=${smartCutProjectId}`);
        } catch (error) {
            console.error('Error starting processing:', error)
            setError(error instanceof Error ? error.message : 'Processing failed')
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
        }
    }

    const getDescription = () => {
        if (currentJob) {
            switch (currentJob.status) {
                case 'queued':
                    return 'Waiting for AI processing...'
                case 'processing':
                    return `Processing video content (${currentJob.progress || 0}%)...`
                case 'completed':
                    return `Ready! ${currentJob.clips?.length || 0} clips generated`
                case 'failed':
                    return 'Processing failed - try again'
                default:
                    return 'AI-powered video segmentation'
            }
        }
        if (selectedFile || uploadedAsset) {
            return 'Configure and start processing'
        }
        return 'Upload video to extract AI clips'
    }

    const getStatusIcon = () => {
        if (currentJob) {
            switch (currentJob.status) {
                case 'queued':
                case 'processing':
                    return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                case 'completed':
                    return <CheckCircle2 className="w-4 h-4 text-green-600" />
                case 'failed':
                    return <AlertCircle className="w-4 h-4 text-red-600" />
                default:
                    return <Brain className="w-4 h-4 text-purple-600" />
            }
        }
        return <Brain className="w-4 h-4 text-purple-600" />
    }

    // Add function to format duration for clips display
    const formatClipDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = Math.floor(seconds % 60)
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Add function to handle clip actions
    const handleDownloadClip = (clip: any) => {
        if (clip.downloadUrl) {
            const link = document.createElement('a')
            link.href = clip.downloadUrl
            link.download = `${clip.title}.mp4`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    const handlePreviewClip = (clip: any) => {
        if (clip.previewUrl) {
            window.open(clip.previewUrl, '_blank')
        }
    }

    const handleEditClip = async (clip: any) => {
        // Navigate to main editor with this specific clip
        router.push(`/projects/${projectId}`)
    }

    return (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <PanelHeader
                    icon={Brain}
                    title="Smart Cut"
                    description={getDescription()}
                    iconBgColor="bg-purple-50"
                    iconColor="text-purple-600"
                />
                {(selectedFile || uploadedAsset || currentJob) && (
                    <button
                        onClick={resetState}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {!selectedFile && !uploadedAsset && !currentJob ? (
                    /* Upload State */
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="video/*"
                        className="hidden"
                    />
                    
                    {/* Drag and Drop Upload Area */}
                    <div 
                                onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`
                            relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
                            transition-all duration-200 group overflow-hidden
                            ${isDragOver ?
                                'border-blue-400 bg-blue-50 shadow-sm' :
                                'border-gray-300 hover:border-blue-300 hover:bg-blue-50/30'
                            }
                        `}
                    >
                        {/* Subtle gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 to-purple-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        
                        <div className="relative z-10 flex flex-col items-center space-y-3">
                            <div className={`
                                p-3 rounded-xl transition-all duration-200 
                                ${isDragOver ? 
                                    'bg-blue-100 shadow-sm scale-105' : 
                                    'bg-gray-100 group-hover:bg-blue-100/70 group-hover:scale-105'
                                }
                            `}>
                                <Upload className={`
                                    w-5 h-5 transition-colors duration-200
                                    ${isDragOver ? 
                                        'text-blue-600' : 
                                        'text-gray-500 group-hover:text-blue-500'
                                    }
                                `} />
                            </div>
                            
                            <div className="space-y-1">
                                <p className={`
                                    text-sm font-medium transition-colors duration-200
                                    ${isDragOver ? 
                                        'text-blue-700' : 
                                        'text-gray-700 group-hover:text-blue-600'
                                    }
                                `}>
                                    Drop video here
                                </p>
                                <p className="text-xs text-gray-500">or click to browse</p>
                            </div>
                            
                            <div className={`
                                px-3 py-1 rounded-full text-xs transition-all duration-200
                                ${isDragOver ?
                                    'bg-blue-100 text-blue-700 border border-blue-200' :
                                    'bg-gray-100 text-gray-600 group-hover:bg-blue-100/70 group-hover:text-blue-600'
                                }
                            `}>
                                MP4, MOV, AVI • 2GB max
                            </div>
                        </div>
                        </div>
                    </div>
                ) : showConfig ? (
                    /* Configuration State */
                    <div className="space-y-4">
                        {selectedFile && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-2">Selected Video</h4>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        📹
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                                        <p className="text-xs text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                                    </div>
                                </div>
                        </div>
                    )}
                    
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Custom Instructions (Optional)
                            </label>
                            <textarea
                                value={userPrompt}
                                onChange={(e) => setUserPrompt(e.target.value)}
                                placeholder="Tell AI what to focus on... e.g., 'Extract the main discussion points and key insights' or 'Focus on the most engaging moments with good visual content'"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
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

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4">
                            <button
                                onClick={() => setShowConfig(false)}
                                className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleStartProcessing}
                                disabled={isUploading}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Start Processing
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Upload Progress */}
                        {isUploading && (
                            <div className="mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-600">Uploading...</span>
                                    <span className="text-sm text-gray-500">{uploadProgress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                        
                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                </div>
                ) : (
                    /* Processing State */
                    <div className="space-y-4">
                        {/* Video Details */}
                        <VideoDetailsSection
                            isExpanded={true}
                            setIsExpanded={() => {}}
                            processingState={currentJob?.status || 'idle'}
                            selectedFile={selectedFile}
                            uploadedAsset={uploadedAsset}
                            prompt=""
                            lastPrompt=""
                            assets={assets}
                            showThoughts={false}
                            showResponse={false}
                        />

                        {/* Generated Clips Section - Show when completed */}
                        {currentJob?.status === 'completed' && currentJob.clips && currentJob.clips.length > 0 && (
                            <div className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                        <span className="text-lg">🎬</span>
                                        Generated Clips ({currentJob.clips.length})
                                    </h4>
                                    <button
                                        onClick={() => router.push(`/projects/quickclips/${projectId}`)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    >
                                        <Eye className="w-3 h-3" />
                                        View All
                                    </button>
                                </div>
                                
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                    {currentJob.clips.map((clip: any, index: number) => (
                                        <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h5 className="font-medium text-gray-900 text-sm mb-1">
                                                        {clip.title}
                                                    </h5>
                                                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                                        {clip.description}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {formatClipDuration(clip.duration)}
                                                        </span>
                                                        <span>
                                                            {formatClipDuration(clip.start_time)} - {formatClipDuration(clip.end_time)}
                                                        </span>
                                                        {clip.significance && (
                                                            <span className="flex items-center gap-1">
                                                                <span className="text-yellow-500">⭐</span>
                                                                {clip.significance.toFixed(1)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-1 ml-3">
                                                    <button
                                                        onClick={() => handlePreviewClip(clip)}
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="Preview"
                                                    >
                                                        <Play className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadClip(clip)}
                                                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Download"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {currentJob.description && (
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <h5 className="font-medium text-blue-900 text-sm mb-2">Analysis Summary</h5>
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            {currentJob.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Transcript Section - Only show for Talk & Audio content when completed */}
                        {transcript && videoType === 'talk_audio' && currentJob?.status === 'completed' && (
                            <div className="border border-gray-200 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                    <span className="text-lg">📝</span>
                                    Transcript
                                </h4>
                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <div className="max-h-48 overflow-y-auto">
                                        <p className="text-gray-700 text-xs leading-relaxed whitespace-pre-wrap">
                                            {transcript}
                                        </p>
                                    </div>
                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                                        <span className="text-xs text-gray-500">
                                            {transcript.length} characters
                                        </span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(transcript)}
                                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default AutoCutToolPanel