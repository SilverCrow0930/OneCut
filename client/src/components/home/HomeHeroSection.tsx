import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Play, Sparkles, Zap, Clock, Upload, Video } from 'lucide-react'

// Video type selection constants (same as AutoCutToolPanel)
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

const HomeHeroSection = () => {
    const router = useRouter()
    const { user, session, signIn } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60) // Default 60 seconds (1 minute)
    const [videoType, setVideoType] = useState<'talk_audio' | 'action_visual'>('talk_audio') // Default to cheaper option
    const [isUploading, setIsUploading] = useState(false)
    const [isDragOver, setIsDragOver] = useState(false)
    
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

    // Find the closest interval value
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
        }
    }

    const handleGetStarted = () => {
        if (user) {
            router.push('/creation')
        } else {
            signIn()
        }
    }

    const handleWatchDemo = () => {
        // Scroll to demos section
        const demosSection = document.getElementById('demos-section')
        demosSection?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleStartEditing = async () => {
        if (!user) {
            signIn()
            return
        }

        if (!selectedFile) {
            // Open file picker instead of showing alert
            fileInputRef.current?.click()
            return
        }

        setIsUploading(true)

        try {
            // 1. Create new project with processing status
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

            // 4. Navigate to project
            router.push(`/projects/${project.id}`)

        } catch (error) {
            console.error('Error starting autocut:', error)
            alert(error instanceof Error ? error.message : 'Processing failed, please try again')
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 overflow-hidden">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left side - Content */}
                    <div className="text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-200 rounded-full px-4 py-2 mb-6">
                            <Zap className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700">AI-Native Video Creation</span>
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                            Transform <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Hours</span>
                            <br />
                            into <span className="bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent">Highlights</span>
                        </h1>
                        
                        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                            Turn your long-form content into engaging videos with AI.
                            Perfect for professionals, educators, and content creators
                            who want to save time and reach more audiences.
                        </p>

                        {/* Features */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Zap className="w-5 h-5 text-blue-500" />
                                <span className="text-sm font-medium">10x Faster Editing</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="w-5 h-5 text-green-500" />
                                <span className="text-sm font-medium">Hours to Minutes</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Sparkles className="w-5 h-5 text-purple-500" />
                                <span className="text-sm font-medium">Rich AI Features</span>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <button
                                onClick={handleGetStarted}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                View My Projects
                            </button>
                            <button
                                onClick={handleWatchDemo}
                                className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-medium px-8 py-4 rounded-2xl border border-gray-200 transition-all duration-300 shadow-sm hover:shadow-md"
                            >
                                <Play className="w-5 h-5" />
                                Watch Demo
                            </button>
                        </div>
                    </div>

                    {/* Right side - Upload Interface */}
                    <div className="relative">
                        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                    Ready to create your first highlight?
                                </h3>
                                <p className="text-gray-600">
                                    Upload your video and see the magic happen
                                </p>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="video/*"
                                className="hidden"
                            />

                            {/* Upload Area */}
                            <div className="mb-6">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    className={`
                                        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                                        transition-all duration-300 group
                                        ${selectedFile ? 
                                            'border-blue-400 bg-blue-50' : 
                                            isDragOver ?
                                                'border-blue-500 bg-blue-100 scale-105' :
                                            'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                        }
                                    `}
                                >
                                    {selectedFile ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="relative">
                                                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center">
                                                    <Video className="w-8 h-8 text-white" />
                                                </div>
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-medium text-gray-900 mb-1">
                                                    {selectedFile.name}
                                                </p>
                                                <p className="text-sm text-blue-600 font-medium">
                                                    Ready for Smart Cut!
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                                                <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                                            </div>
                                            <p className="font-medium text-gray-700 mb-2 group-hover:text-blue-700 transition-colors duration-300">
                                                Drop your video here
                                            </p>
                                            <p className="text-sm text-gray-500 mb-4">
                                                or click to browse
                                            </p>
                                            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
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

                            {/* Configuration Options - Only show after file upload */}
                            {selectedFile && (
                                <div className="space-y-6 mb-6">
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
                                                <span>20s</span>
                                                <span>30m</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Start Button */}
                            <button
                                onClick={handleStartEditing}
                                disabled={isUploading}
                                className={`
                                    w-full font-bold text-lg px-6 py-4 rounded-2xl 
                                    transition-all duration-300 shadow-lg hover:shadow-xl 
                                    transform hover:scale-105 active:scale-95
                                    relative overflow-hidden group
                                    ${selectedFile 
                                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                                        : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white cursor-pointer'
                                    }
                                    ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}
                                `}
                            >
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

                            {/* Note */}
                            {selectedFile && (
                                <p className="text-xs text-blue-600 text-center mt-4">
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
                </div>
            </div>
        </section>
    )
}

export default HomeHeroSection 