import React, { useState, useRef, useEffect } from 'react'
import { UploadButton } from './auto-cut/UploadButton'
import { useAuth } from '@/contexts/AuthContext'
import { useAssets } from '@/contexts/AssetsContext'
import { apiPath } from '@/lib/config'

import { CheckCircle2, AlertCircle, Loader2, Brain, Sparkles, Play, Download, RefreshCw, Clock, Eye } from 'lucide-react'
import VideoDetailsSection from './VideoDetailsSection'
import { useEditor } from '@/contexts/EditorContext'
import { v4 as uuid } from 'uuid'
import { useParams } from 'next/navigation'
import { TrackType } from '@/types/editor'
import PanelHeader from './PanelHeader'

type ProcessingState = 'idle' | 'starting' | 'queued' | 'processing' | 'completed' | 'failed'

interface SmartCutJob {
    id: string
    projectId: string
    status: ProcessingState
    progress: number
    message: string
    error?: string
    clips?: any[]
    description?: string
}

const SmartCutToolPanel = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState<number>(120) // 2 minutes default
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [currentJob, setCurrentJob] = useState<SmartCutJob | null>(null)
    const [uploadedAsset, setUploadedAsset] = useState<{
        id: string
        mime_type: string
        duration: number | null
    } | null>(null)
    const [showConfig, setShowConfig] = useState(false)
    
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { session } = useAuth()
    const { refresh, assets } = useAssets()
    const { tracks, executeCommand } = useEditor()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

    // Time intervals for duration selection
    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600]

    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`
        } else {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
        }
    }

    const getVideoFormat = (durationSeconds: number) => {
        return durationSeconds < 120 ? 'short' : 'long'
    }

    const getFormatInfo = (durationSeconds: number) => {
        if (durationSeconds < 120) {
            return { format: 'Short', aspectRatio: '9:16', icon: '📱' }
        } else {
            return { format: 'Long', aspectRatio: '16:9', icon: '🖥️' }
        }
    }

    // Poll for job status when processing
    useEffect(() => {
        if (!currentJob || !['queued', 'processing'].includes(currentJob.status)) {
            return
        }

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(apiPath(`smartcut/status/${currentJob.id}`), {
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
                    }
                }
            } catch (error) {
                console.error('Error polling job status:', error)
            }
        }, 3000) // Poll every 3 seconds

        return () => clearInterval(pollInterval)
    }, [currentJob?.id, currentJob?.status, session?.access_token])

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith('video/')) {
            resetState()
            setSelectedFile(file)
            setShowConfig(true)
        }
    }

    const resetState = () => {
        setSelectedFile(null)
        setUploadedAsset(null)
        setCurrentJob(null)
        setError(null)
        setUploadProgress(0)
        setShowConfig(false)
    }

    const handleStartProcessing = async () => {
        if (!selectedFile || !session) return

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

            // 2. Start Smart Cut processing
            let jobResponse;
            const maxRetries = 3;
            let lastError;
            
            // Retry logic for network issues
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    jobResponse = await fetch(apiPath('smartcut/start'), {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            projectId: projectId || '',
                            fileUri,
                            mimeType: selectedFile.type,
                            contentType: 'talking_video',
                            targetDuration
                        })
                    })
                    break; // Success, exit retry loop
                } catch (fetchError) {
                    lastError = fetchError;
                    if (attempt === maxRetries) {
                        throw new Error(`Network error after ${maxRetries} attempts: ${fetchError instanceof Error ? fetchError.message : 'Connection failed'}`)
                    }
                    console.warn(`Smart Cut request attempt ${attempt} failed, retrying...`)
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
                    console.error('Smart Cut API Error Details:', errorData)
                    
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
            if (!projectId) throw new Error('Project ID is required')
            setCurrentJob({
                id: jobData.jobId,
                projectId,
                status: 'queued',
                progress: 0,
                message: 'Queued for processing...'
            })

            setShowConfig(false)
            
        } catch (error) {
            console.error('Error starting processing:', error)
            setError(error instanceof Error ? error.message : 'Processing failed')
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
        }
    }

    const handleClipsReady = (clips: any[]) => {
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
            <div className="flex-1 overflow-hidden">
                {!selectedFile && !uploadedAsset && !currentJob ? (
                    /* Enhanced Upload State */
                    <div className="flex flex-col h-full">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept="video/*"
                            className="hidden"
                        />
                        
                        {/* Main Upload Area */}
                        <div 
                            className="flex-1 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl p-8 transition-all duration-200 cursor-pointer group"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.add('border-purple-500', 'bg-purple-50')
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50')
                            }}
                            onDrop={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.remove('border-purple-500', 'bg-purple-50')
                                const files = e.dataTransfer.files
                                if (files[0] && files[0].type.startsWith('video/')) {
                                    resetState()
                                    setSelectedFile(files[0])
                                    setShowConfig(true)
                                }
                            }}
                        >
                            <div className="flex flex-col items-center justify-center text-center space-y-4">
                                {/* Icon */}
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                    <Brain className="w-8 h-8 text-purple-600" />
                                </div>
                                
                                {/* Main Text */}
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Upload Your Video
                                    </h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        Drop your video here or click to browse.<br/>
                                        AI will automatically extract the best clips.
                                    </p>
                                </div>
                                
                                {/* Upload Button */}
                                <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg">
                                    <Brain className="w-4 h-4" />
                                    Choose Video File
                                </button>
                                
                                {/* Format Info */}
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500 font-medium mb-1">Supported formats:</p>
                                    <p className="text-xs text-gray-400">MP4, MOV, AVI, WebM • Max 500MB</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Features Preview */}
                        <div className="mt-6 grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                                <Sparkles className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-medium text-blue-800">AI-Powered</span>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                                <Clock className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-medium text-green-800">Fast Processing</span>
                            </div>
                        </div>
                        
                        {/* Example/Preview */}
                        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-medium text-purple-800">How it works</span>
                            </div>
                            <p className="text-xs text-purple-700 leading-relaxed">
                                Upload a long video → AI finds key moments → Get perfectly timed clips → Ready for your timeline
                            </p>
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
                    
                        {/* Target Duration */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Target Duration: {formatDuration(targetDuration)}
                            </label>
                            
                            <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                                <div className="flex items-center gap-3 text-sm">
                                    <span>{getFormatInfo(targetDuration).icon}</span>
                                    <span className="font-medium">{getFormatInfo(targetDuration).format} Format</span>
                                    <span className="text-gray-600">({getFormatInfo(targetDuration).aspectRatio})</span>
                                </div>
                            </div>

                            <input
                                type="range"
                                min="20"
                                max="600"
                                value={targetDuration}
                                onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>20s</span>
                                <span>10m</span>
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
                    </div>
                )}
            </div>
        </div>
    )
}

export default SmartCutToolPanel