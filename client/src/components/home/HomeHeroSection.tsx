import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Play, Sparkles, Zap, Clock, Upload, Video, Users, BookOpen, Mic, Smartphone, Monitor } from 'lucide-react'

const HomeHeroSection = () => {
    const router = useRouter()
    const { user, session, signIn } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60) // Default 60 seconds (1 minute)
    const [contentType, setContentType] = useState('talking_video')
    const [customContentType, setCustomContentType] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [isDragOver, setIsDragOver] = useState(false)
    
    // Specific time intervals in seconds (20s to 30m)
    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]
    
    const contentTypes = [
        { id: 'talking_video', label: 'Talking Video', icon: Video },
        { id: 'professional_meeting', label: 'Meeting', icon: Users },
        { id: 'educational_video', label: 'Tutorial', icon: BookOpen },
        { id: 'custom', label: 'Custom', icon: Mic }
    ]

    // Automatically determine video format based on duration
    const getVideoFormat = (durationSeconds: number) => {
        return durationSeconds < 120 ? 'short_vertical' : 'long_horizontal'
    }

    const getFormatInfo = (durationSeconds: number) => {
        if (durationSeconds < 120) {
            return {
                format: 'Short Vertical',
                aspectRatio: '9:16'
            }
        } else {
            return {
                format: 'Long Horizontal', 
                aspectRatio: '16:9'
            }
        }
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
            alert('Please select a video file first')
            return
        }

        // Validate custom content type if selected
        if (contentType === 'custom' && !customContentType.trim()) {
            alert('Please enter a custom content type')
            return
        }

        setIsUploading(true)

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

            // 3. Start background processing job
            console.log('Starting QuickClips with data:', {
                projectId: project.id,
                fileUri,
                mimeType: selectedFile.type,
                contentType: finalContentType,
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
                            contentType: finalContentType,
                            targetDuration: parseInt(String(targetDuration))
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
                let errorMessage = 'Failed to start processing job'
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
                    // If JSON parsing fails, use the status text or generic message
                    errorMessage = jobResponse.statusText || errorMessage
                }
                console.error('Full error context:', {
                    status: jobResponse.status,
                    statusText: jobResponse.statusText,
                    requestData: {
                        projectId: project.id,
                        fileUri,
                        mimeType: selectedFile.type,
                        contentType: finalContentType,
                        targetDuration: parseInt(String(targetDuration))
                    }
                })
                throw new Error(errorMessage)
            }

            // 4. Navigate to creation page showing the processing project
            router.push(`/creation?highlight=${project.id}`)

        } catch (error) {
            console.error('Error starting quickclips:', error)
            alert(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 pt-24 pb-20">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-emerald-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Column - Content */}
                    <div className="text-center lg:text-left">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-200 rounded-full px-4 py-2 mb-6">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-700">AI-Powered Video Creation</span>
                        </div>

                        {/* Main Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                            Transform 
                            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent"> Hours </span>
                            into 
                            <span className="bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent"> Highlights</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                            Turn your long-form content into engaging videos with AI. Perfect for podcasters, educators, and content creators who want to save time and reach more audiences.
                        </p>

                        {/* Key Benefits */}
                        <div className="flex flex-wrap justify-center lg:justify-start gap-6 mb-8">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-emerald-500" />
                                <span className="text-gray-700 font-medium">10x Faster Editing</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-blue-500" />
                                <span className="text-gray-700 font-medium">Hours to Minutes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-500" />
                                <span className="text-gray-700 font-medium">AI-Powered</span>
                            </div>
                        </div>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <button
                                onClick={handleGetStarted}
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                {user ? 'View All Projects' : 'Start Creating'}
                            </button>
                            <button
                                onClick={handleWatchDemo}
                                className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-lg px-8 py-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-300"
                            >
                                <Play className="w-5 h-5" />
                                Watch Demo
                            </button>
                        </div>

                        {/* Trust Indicators */}
                        <div className="mt-8 pt-8 border-t border-gray-200">
                            <p className="text-sm text-gray-500 mb-4">Trusted by content creators worldwide</p>
                            <div className="flex items-center justify-center lg:justify-start gap-8 opacity-60">
                                <div className="text-2xl font-bold text-gray-400">5K+</div>
                                <div className="text-sm text-gray-500">Creators</div>
                                <div className="text-2xl font-bold text-gray-400">10K+</div>
                                <div className="text-sm text-gray-500">Videos Created</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Upload Interface */}
                    <div className="relative">
                        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200 relative overflow-hidden">
                            {/* Background Pattern */}
                            <div className="absolute inset-0 opacity-5">
                                <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-xl"></div>
                                <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full blur-xl"></div>
                            </div>

                            {/* Upload Header */}
                            <div className="text-center mb-6 relative z-10">
                                <p className="text-gray-600">
                                    Upload your video and see the magic happen
                                </p>
                            </div>

                            {/* Upload Area */}
                            <div className="mb-6 relative z-10">
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
                                    {/* Animated background for hover */}
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

                            {/* Content Type Selection */}
                            <div className="mb-6 relative z-10">
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
                            <div className="mb-6 relative z-10">
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
                                                {targetDuration < 120 ? 'Short Vertical' : 'Long Horizontal'}
                                            </div>
                                            <div className="text-xs text-gray-600 mb-2">
                                                {targetDuration < 120 ? '< 2 minutes' : '2-30 minutes'}
                                            </div>
                                            <div className="text-lg font-bold text-blue-600">
                                                {targetDuration < 120 ? '9:16' : '16:9'}
                                            </div>
                                        </div>
                                        <div className="flex-1 flex justify-center">
                                            {targetDuration < 120 ? (
                                                <div className="w-16 h-28 bg-gradient-to-b from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                                                    <Smartphone className="w-6 h-6 text-white" />
                                                </div>
                                            ) : (
                                                <div className="w-28 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                                                    <Monitor className="w-6 h-6 text-white" />
                                                </div>
                                            )}
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
                                    
                                    {/* Time interval markers */}
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

                            {/* Start Button */}
                            <button
                                onClick={handleStartEditing}
                                disabled={isUploading || !selectedFile}
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
                                    relative z-10
                                "
                            >
                                {/* Button glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-2xl"></div>
                                
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {isUploading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-5 h-5" />
                                            Create Quick Clips
                                        </>
                                    )}
                                </span>
                            </button>

                            {/* Note */}
                            <p className="text-xs text-gray-500 text-center mt-4 relative z-10">
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
                </div>
            </div>
        </section>
    )
}

export default HomeHeroSection 