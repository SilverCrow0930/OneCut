import React, { useState, useRef, useEffect } from 'react'
import { Zap, Upload, Clock, Video, Download, Play, X, Edit, Sparkles, ChevronDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCredits } from '@/contexts/CreditsContext'
import { apiPath } from '@/lib/config'
import { useRouter } from 'next/navigation'
import { calculateSmartCutCredits } from '@/lib/utils'

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
    const { consumeCredits } = useCredits()
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
    
    // New state for scroll indicator
    const [showScrollIndicator, setShowScrollIndicator] = useState(false)
    const modalContentRef = useRef<HTMLDivElement>(null)


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
            
            // If credits were successfully consumed, continue with processing
        } catch (error) {
            console.error('Error calculating video duration:', error)
            setError('Failed to calculate video duration. Please try again.')
            return
        }

        // 1. Create new project first to get the real ID
        try {
            const projectResponse = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: selectedFile.name,
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

            // 2. Add optimistic project with the REAL project ID
            const projectData = {
                id: project.id, // Use the real project ID
                name: selectedFile.name,
                processing_status: 'queued',
                processing_type: 'quickclips',
                processing_progress: 5,
                processing_message: 'Creating project...',
                processing_data: {
                    contentType: getContentType(),
                    videoFormat: getVideoFormat(),
                    targetDuration,
                    filename: selectedFile.name
                },
                created_at: new Date().toISOString(),
                is_optimistic: true
            };

            // Store in localStorage
            try {
                const existingProjects = localStorage.getItem('optimistic_projects');
                const projects = existingProjects ? JSON.parse(existingProjects) : [];
                projects.push(projectData);
                localStorage.setItem('optimistic_projects', JSON.stringify(projects));
                console.log('Added optimistic project to localStorage:', projectData.id);
            } catch (err) {
                console.warn('Failed to store optimistic project in localStorage:', err);
            }

            // Close modal and redirect
            setIsModalOpen(false)
            router.push(`/projects?highlight=${project.id}`)

            // 3. Upload file and start processing
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

            // Start QuickClips processing
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

        } catch (error) {
            console.error('Error during project creation or file upload:', error)
            // We don't need to show an alert here since the user has already been redirected
            // and the background request failed.
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

    // Check if content is scrollable
    const checkScrollable = () => {
        if (modalContentRef.current) {
            const { scrollHeight, clientHeight, scrollTop } = modalContentRef.current
            const isScrollable = scrollHeight > clientHeight
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
            setShowScrollIndicator(isScrollable && !isAtBottom)
        }
    }

    // Check scrollability when modal opens or content changes
    useEffect(() => {
        if (isModalOpen) {
            setTimeout(checkScrollable, 100)
        }
    }, [isModalOpen, selectedFile, videoType])

    // Add scroll event listener
    useEffect(() => {
        const modalContent = modalContentRef.current
        if (modalContent) {
            modalContent.addEventListener('scroll', checkScrollable)
            return () => modalContent.removeEventListener('scroll', checkScrollable)
        }
    }, [isModalOpen])

    // Scroll indicator component
    const ScrollIndicator = () => {
        if (!showScrollIndicator) return null
        
        return (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
                <div className="bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-white/20">
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                </div>
            </div>
        )
    }

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="
                    inline-flex items-center justify-center gap-2 
                    px-6 py-3 rounded-xl font-bold text-white
                    bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500
                    hover:from-purple-600 hover:via-violet-600 hover:to-indigo-600
                    focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
                    shadow-xl hover:shadow-2xl
                    transform transition-all duration-300
                    hover:scale-105 active:scale-95
                    relative overflow-hidden group
                "
            >
                {/* Button glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-xl"></div>
                
                <span className="relative z-10 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <span>Smart Cut</span>
                </span>
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto elegant-scrollbar shadow-2xl border border-white/50 relative overflow-hidden" ref={modalContentRef}>
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-400 rounded-full blur-xl"></div>
                            <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-500 rounded-full blur-xl"></div>
                        </div>

                        {/* Header */}
                        <div className="flex items-start justify-between px-8 py-6 border-b border-gray-200/50 relative z-10">
                            <div className="text-left">
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent mb-2">
                                    Smart Cut
                                </h2>
                                <p className="text-gray-600">Transform Hours into Highlights</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-8 py-6 relative z-10">
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
                            ) : (
                                /* Upload View - Updated with HomeHeroSection styling */
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
                                                border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                                                transition-all duration-300 group relative overflow-hidden
                                                ${selectedFile ? 
                                                    'border-blue-400 bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 shadow-inner' : 
                                                    isDragOver ?
                                                        'border-purple-500 bg-gradient-to-br from-purple-100 via-violet-100 to-indigo-100 shadow-lg scale-105' :
                                                        'border-gray-300 hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-50 hover:via-violet-50 hover:to-indigo-50 hover:shadow-lg'
                                                }
                                            `}
                                        >
                                            {/* Animated background for hover */}
                                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isDragOver ? 'opacity-100' : ''} ${
                                                selectedFile 
                                                    ? 'bg-gradient-to-br from-blue-500/10 via-teal-500/10 to-emerald-400/10'
                                                    : 'bg-gradient-to-br from-purple-500/10 via-violet-500/10 to-indigo-500/10'
                                            }`}></div>
                                            
                                            {selectedFile ? (
                                                <div className="flex flex-col items-center gap-3 relative z-10">
                                                    <div className="relative">
                                                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-400 rounded-2xl flex items-center justify-center shadow-lg">
                                                            <Video className="w-10 h-10 text-white" />
                                                        </div>
                                                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="font-bold text-gray-800 mb-1">
                                                            {selectedFile.name}
                                                        </p>
                                                        <p className="text-sm font-medium bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 bg-clip-text text-transparent">
                                                            Ready for Smart Cut!
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="relative z-10">
                                                    <div className="w-20 h-20 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg border border-purple-100">
                                                        <Upload className="w-10 h-10 text-purple-500 group-hover:text-purple-600 transition-colors duration-300" />
                                                    </div>
                                                    <p className="font-bold text-gray-700 mb-2 group-hover:text-purple-700 transition-colors duration-300 text-lg">
                                                        Drop your video here
                                                    </p>
                                                    <p className="text-sm text-gray-500 mb-4">
                                                        or click to browse
                                                    </p>
                                                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500 bg-purple-50/50 rounded-full px-4 py-2 border border-purple-200/30">
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

                                    {/* Video Type Selection - Updated with HomeHeroSection styling */}
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
                                                            ? 'border-blue-500 bg-blue-50' 
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
                                                            ? 'border-blue-500 bg-blue-50' 
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
                                                    w-full h-4 bg-gray-300 rounded-full appearance-none cursor-pointer shadow-inner border border-gray-200
                                                    [&::-webkit-slider-thumb]:appearance-none 
                                                    [&::-webkit-slider-thumb]:w-7 
                                                    [&::-webkit-slider-thumb]:h-7 
                                                    [&::-webkit-slider-thumb]:rounded-full 
                                                    [&::-webkit-slider-thumb]:bg-gradient-to-r
                                                    [&::-webkit-slider-thumb]:from-purple-600
                                                    [&::-webkit-slider-thumb]:via-blue-600
                                                    [&::-webkit-slider-thumb]:to-teal-600
                                                    [&::-webkit-slider-thumb]:border-4
                                                    [&::-webkit-slider-thumb]:border-white
                                                    [&::-webkit-slider-thumb]:shadow-xl
                                                    [&::-webkit-slider-thumb]:cursor-pointer
                                                    [&::-webkit-slider-thumb]:hover:scale-110
                                                    [&::-webkit-slider-thumb]:hover:shadow-2xl
                                                    [&::-webkit-slider-thumb]:transition-all
                                                    [&::-webkit-slider-thumb]:duration-200
                                                    [&::-moz-range-thumb]:w-7
                                                    [&::-moz-range-thumb]:h-7
                                                    [&::-moz-range-thumb]:rounded-full
                                                    [&::-moz-range-thumb]:bg-gradient-to-r
                                                    [&::-moz-range-thumb]:from-purple-600
                                                    [&::-moz-range-thumb]:to-teal-600
                                                    [&::-moz-range-thumb]:border-4
                                                    [&::-moz-range-thumb]:border-white
                                                    [&::-moz-range-thumb]:shadow-xl
                                                    [&::-moz-range-thumb]:cursor-pointer
                                                    [&::-moz-range-thumb]:hover:scale-110
                                                    [&::-moz-range-thumb]:transition-all
                                                    [&::-moz-range-thumb]:duration-200
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
                                    )}

                                    {/* Generate Button */}
                                    <div className="pt-2">
                                        {/* Start Button */}
                                        <button
                                            onClick={handleStartProcessing}
                                            disabled={!selectedFile || isProcessing || isUploading}
                                            className={`
                                                w-full font-bold text-lg px-6 py-4 rounded-2xl 
                                                transition-all duration-300 shadow-xl hover:shadow-2xl 
                                                transform hover:scale-105 active:scale-95
                                                relative overflow-hidden group relative z-10
                                                ${selectedFile 
                                                    ? 'bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 hover:from-blue-600 hover:via-teal-600 hover:to-emerald-500 text-white'
                                                    : 'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 hover:from-purple-600 hover:via-violet-600 hover:to-indigo-600 text-white cursor-pointer'
                                                }
                                                ${(!selectedFile || isProcessing || isUploading) ? 'opacity-70 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            {/* Button glow effect */}
                                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-2xl ${
                                                selectedFile 
                                                    ? 'bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-300'
                                                    : 'bg-gradient-to-r from-purple-400 via-violet-400 to-indigo-400'
                                            }`}></div>
                                            
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                {isUploading ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        Processing...
                                                    </>
                                                ) : selectedFile ? (
                                                    <>
                                                        <Sparkles className="w-5 h-5" />
                                                        Create Smart Cut
                                                    </>
                                                ) : (
                                                    <>
                                                        Smart Cut My Video
                                                    </>
                                                )}
                                            </span>
                                        </button>

                                        {/* Error Display */}
                                        {error && (
                                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                                <p className="text-red-700 text-sm">{error}</p>
                                            </div>
                                        )}

                                        {selectedFile && (
                                            <p className="text-xs font-medium bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 bg-clip-text text-transparent text-center mt-4 relative z-10">
                                                {user ? (
                                                    <span className="flex items-center justify-center gap-1">
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                        Processing starts immediately in background
                                                    </span>
                                                ) : (
                                                    'Sign in required to process video'
                                                )}
                                            </p>
                                        )}

                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Scroll Indicator */}
            <ScrollIndicator />
        </>
    )
}

export default QuickClipsButton 