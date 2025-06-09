import React, { useState, useRef } from 'react'
import { Zap, Upload, Clock, Users, BookOpen, Mic, Video, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { useRouter } from 'next/navigation'

interface UnifiedQuickClipsProps {
    mode: 'hero' | 'modal' | 'panel'
    onSuccess?: (projectId: string) => void
    showAsButton?: boolean
}

export interface QuickClip {
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

interface ProcessingState {
    state: 'idle' | 'uploading' | 'processing' | 'analyzing' | 'generating' | 'finalizing' | 'completed' | 'error'
    progress: number
    message: string
}

const UnifiedQuickClips = ({ mode, onSuccess, showAsButton = true }: UnifiedQuickClipsProps) => {
    const { user, session, signIn } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60)
    const [contentType, setContentType] = useState('talking_video')
    const [customContentType, setCustomContentType] = useState('')
    const [isDragOver, setIsDragOver] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [processingState, setProcessingState] = useState<ProcessingState>({
        state: 'idle',
        progress: 0,
        message: ''
    })
    
    const contentTypes = [
        { id: 'talking_video', label: 'Talking Video', icon: Video },
        { id: 'professional_meeting', label: 'Meeting', icon: Users },
        { id: 'educational_video', label: 'Tutorial', icon: BookOpen },
        { id: 'custom', label: 'Custom', icon: Mic }
    ]

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

    const getFormatInfo = (durationSeconds: number) => {
        if (durationSeconds < 120) {
            return { format: 'Short Vertical', aspectRatio: '9:16', icon: '📱' }
        } else {
            return { format: 'Long Horizontal', aspectRatio: '16:9', icon: '🖥️' }
        }
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
            setError('Please select a video file first')
            return
        }

        // Validate custom content type if selected
        if (contentType === 'custom' && !customContentType.trim()) {
            setError('Please enter a custom content type')
            return
        }

        setProcessingState({
            state: 'uploading',
            progress: 10,
            message: 'Preparing for processing...'
        })
        setError(null)

        const finalContentType = contentType === 'custom' ? customContentType.trim() : contentType

        try {
            // 1. Create new project with processing status
            const projectResponse = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `QuickClips - ${selectedFile.name}`,
                    processing_status: 'queued',
                    processing_type: 'quickclips',
                    processing_progress: 0,
                    processing_message: 'Preparing for processing...',
                    processing_data: {
                        contentType: finalContentType,
                        videoFormat: targetDuration < 120 ? 'short' : 'long',
                        targetDuration,
                        filename: selectedFile.name,
                        durationRange: targetDuration < 120 ? '< 2 minutes' : '2-30 minutes'
                    }
                })
            })

            if (!projectResponse.ok) {
                const errorData = await projectResponse.json().catch(() => null)
                const errorMessage = errorData?.error || await projectResponse.text() || 'Failed to create project'
                throw new Error(errorMessage)
            }

            const project = await projectResponse.json()

            setProcessingState({
                state: 'uploading',
                progress: 30,
                message: 'Uploading video...'
            })

            // 2. Upload file to assets
            const formData = new FormData()
            formData.append('file', selectedFile)
            formData.append('projectId', project.id)

            const uploadResponse = await fetch(apiPath('assets/upload'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: formData
            })

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json().catch(() => null)
                const errorMessage = errorData?.error || await uploadResponse.text() || 'Failed to upload file'
                throw new Error(errorMessage)
            }

            const uploadResult = await uploadResponse.json()
            const fileUri = uploadResult.gcsUri || uploadResult.uri

            setProcessingState({
                state: 'processing',
                progress: 50,
                message: 'Starting AI analysis...'
            })

            // 3. Start background processing job
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
                    contentType: finalContentType,
                    targetDuration
                })
            })

            if (!jobResponse.ok) {
                const errorData = await jobResponse.json().catch(() => null)
                const errorMessage = errorData?.error || await jobResponse.text() || 'Failed to start processing job'
                throw new Error(errorMessage)
            }

            // 4. Handle success based on mode
            if (mode === 'hero') {
                // Redirect to creation page to show processing
                router.push(`/creation?highlight=${project.id}&tab=quickclips`)
            } else {
                // Show success and call onSuccess callback
                setProcessingState({
                    state: 'completed',
                    progress: 100,
                    message: 'Processing started successfully!'
                })
                onSuccess?.(project.id)
            }

        } catch (error) {
            console.error('Error starting quickclips:', error)
            setError(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.')
            setProcessingState({
                state: 'error',
                progress: 0,
                message: 'Processing failed'
            })
        }
    }

    const renderUploadArea = () => (
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
                    border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                    transition-all duration-300 group relative overflow-hidden
                    ${selectedFile ? 
                        'border-blue-400 bg-gradient-to-br from-blue-50 to-purple-50 shadow-inner' : 
                        isDragOver ?
                            'border-blue-500 bg-gradient-to-br from-blue-100 to-purple-100 shadow-lg scale-105' :
                        'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:shadow-lg'
                    }
                `}
            >
                <div className={`absolute inset-0 bg-gradient-to-br from-blue-400/10 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isDragOver ? 'opacity-100' : ''}`}></div>
                
                {selectedFile ? (
                    <div className="flex flex-col items-center gap-3 relative z-10">
                        <div className="relative">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <Video className="w-8 h-8 text-white" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-blue-800 mb-1">
                                {selectedFile.name}
                            </p>
                            <p className="text-sm text-blue-600">
                                Click to change file
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="w-8 h-8 text-gray-500 group-hover:text-blue-600 transition-colors duration-300" />
                        </div>
                        <p className="font-semibold text-gray-700 mb-2 group-hover:text-blue-700 transition-colors duration-300">
                            Drop your video here
                        </p>
                        <p className="text-sm text-gray-500 mb-3">
                            or click to browse
                        </p>
                        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                            <span>MP4</span>
                            <span>•</span>
                            <span>MOV</span>
                            <span>•</span>
                            <span>AVI</span>
                            <span>•</span>
                            <span>Up to 2GB</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )

    const renderConfiguration = () => (
        <div className="space-y-6">
            {/* Content Type Selection */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Content Type</label>
                <div className="grid grid-cols-2 gap-2">
                    {contentTypes.map((type) => {
                        const Icon = type.icon
                        return (
                            <button
                                key={type.id}
                                onClick={() => setContentType(type.id)}
                                className={`
                                    flex items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 text-sm group
                                    ${contentType === type.id ? 
                                        'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 text-blue-700 shadow-md' : 
                                        'border-gray-200 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:shadow-sm'
                                    }
                                `}
                            >
                                <div className={`p-1 rounded-lg ${contentType === type.id ? 'bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-400'} transition-colors duration-200`}>
                                    <Icon className={`w-3 h-3 ${contentType === type.id ? 'text-white' : 'text-white'}`} />
                                </div>
                                <span className="font-medium">{type.label}</span>
                            </button>
                        )
                    })}
                </div>
                
                {/* Custom Content Type Input */}
                {contentType === 'custom' && (
                    <div className="mt-3">
                        <input
                            type="text"
                            value={customContentType}
                            onChange={(e) => setCustomContentType(e.target.value)}
                            placeholder="e.g., cooking show, interview, product review..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Describe your content type to help AI understand your video
                        </p>
                    </div>
                )}
            </div>

            {/* Target Duration */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                        <Clock className="w-4 h-4 text-white" />
                    </div>
                    <label className="text-sm font-semibold text-gray-700">
                        Target: {formatDuration(targetDuration)}
                    </label>
                </div>
                
                {/* Format indicator */}
                <div className="mb-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 text-center">
                            <div className="text-sm font-medium text-gray-900 mb-1">
                                {getFormatInfo(targetDuration).format}
                            </div>
                            <div className="text-xs text-gray-600 mb-2">
                                {targetDuration < 120 ? '< 2 minutes' : '2-30 minutes'}
                            </div>
                            <div className="text-lg font-bold text-blue-600">
                                {getFormatInfo(targetDuration).aspectRatio}
                            </div>
                        </div>
                        <div className="flex-1 flex justify-center">
                            <div className="text-4xl">
                                {getFormatInfo(targetDuration).icon}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="relative">
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
                    
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <div className="text-center">
                            <div className="font-medium">20s</div>
                        </div>
                        <div className="text-center">
                            <div className="font-medium">30m</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderProcessingView = () => (
        <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {processingState.state === 'uploading' ? 'Uploading Video...' : 'Processing Your Video'}
            </h3>
            <p className="text-gray-600 mb-6">
                {processingState.message}
            </p>
            
            <div className="max-w-xs mx-auto">
                <div className="bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${processingState.progress}%` }}
                    />
                </div>
                <p className="text-sm text-gray-500">
                    {processingState.progress}% complete
                </p>
            </div>
        </div>
    )

    const renderContent = () => {
        if (processingState.state !== 'idle') {
            return renderProcessingView()
        }

        return (
            <div className="space-y-6">
                {renderUploadArea()}
                
                {selectedFile && (
                    <>
                        {renderConfiguration()}
                        
                        {/* Start Button */}
                        <button
                            onClick={handleStartProcessing}
                            disabled={!selectedFile || processingState.state !== 'idle'}
                            className="
                                w-full bg-gradient-to-r from-blue-600 to-purple-600 
                                hover:from-blue-700 hover:to-purple-700
                                disabled:from-gray-400 disabled:to-gray-500
                                text-white font-bold text-lg
                                px-6 py-4 rounded-2xl 
                                transition-all duration-300 shadow-xl hover:shadow-2xl 
                                disabled:cursor-not-allowed 
                                transform hover:scale-105 active:scale-95
                                relative overflow-hidden group
                            "
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl"></div>
                            
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                <Zap className="w-5 h-5" />
                                Create Quick Clips
                            </span>
                        </button>
                    </>
                )}
            </div>
        )
    }

    // For hero mode, render directly
    if (mode === 'hero') {
        return (
            <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-xl"></div>
                    <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full blur-xl"></div>
                </div>

                <div className="relative z-10">
                    <div className="text-center mb-6">
                        <p className="text-gray-600">
                            Upload your video and see the magic happen
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    {renderContent()}

                    <p className="text-xs text-gray-500 text-center mt-4">
                        {user ? (
                            <span className="flex items-center justify-center gap-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                Processing starts immediately in background
                            </span>
                        ) : (
                            'Sign in required to process video'
                        )}
                    </p>
                </div>
            </div>
        )
    }

    // For panel mode (used in editor)
    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {renderContent()}
        </div>
    )
}

export default UnifiedQuickClips
