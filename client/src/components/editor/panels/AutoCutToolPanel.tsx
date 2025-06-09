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
import UnifiedQuickClips from '@/components/shared/UnifiedQuickClips'

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
}

interface ContentType {
    id: string
    name: string
    icon: string
    description: string
}

const CONTENT_TYPES: ContentType[] = [
    { id: 'talking_video', name: 'Talking Video', icon: '💬', description: 'Speech-focused video' },
    { id: 'professional_meeting', name: 'Meeting', icon: '💼', description: 'Business content' },
    { id: 'educational_video', name: 'Tutorial', icon: '🎓', description: 'Learning content' },
    { id: 'custom', name: 'Custom', icon: '🎙️', description: 'Custom content type' }
]

const AutoCutToolPanel = () => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [contentType, setContentType] = useState<string>('talking_video')
    const [customContentType, setCustomContentType] = useState<string>('')
    const [targetDuration, setTargetDuration] = useState<number>(120) // 2 minutes default
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [currentJob, setCurrentJob] = useState<QuickClipsJob | null>(null)
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

        // Validate custom content type if selected
        if (contentType === 'custom' && !customContentType.trim()) {
            setError('Please enter a custom content type')
            return
        }

        setIsUploading(true)
        setError(null)

        const finalContentType = contentType === 'custom' ? customContentType.trim() : contentType

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

                xhr.open('POST', apiPath('assets/upload'))
                xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
                xhr.send(formData)
            })

            const uploadResult = await uploadPromise
            const fileUri = uploadResult.gcsUri || uploadResult.uri

            setUploadedAsset({
                id: uploadResult.id,
                mime_type: uploadResult.mimeType || selectedFile.type,
                duration: uploadResult.duration || null
            })

            // 2. Start QuickClips processing
            const jobResponse = await fetch(apiPath('quickclips/start'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: projectId || '',
                    fileUri,
                    mimeType: selectedFile.type,
                    contentType: finalContentType,
                    targetDuration
                })
            })

            if (!jobResponse.ok) {
                throw new Error('Failed to start processing')
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
                name: `QuickClips - ${selectedFile?.name || 'Video'}`,
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
                    title="QuickClips"
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
                <UnifiedQuickClips 
                    mode="panel" 
                    onSuccess={(projectId) => {
                        // Handle successful project creation
                        console.log('QuickClips project created:', projectId)
                        // Optionally refresh assets or show success message
                    }}
                />
            </div>
        </div>
    )
}

export default AutoCutToolPanel