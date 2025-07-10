import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Play, Sparkles, Zap, Clock, Upload, Video } from 'lucide-react'

const HomeHeroSection = () => {
    const router = useRouter()
    const { user, session, signIn } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60) // Default 60 seconds (1 minute)
    const [userPrompt, setUserPrompt] = useState('') // Optional user prompt for Smart Cut
    const [isUploading, setIsUploading] = useState(false)
    const [isDragOver, setIsDragOver] = useState(false)
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
    
    // Specific time intervals in seconds (20s to 30m)
    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]
    


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
            router.push('/projects')
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
                    name: selectedFile.name,
                    processing_status: 'queued',
                    processing_type: 'quickclips',
                    processing_progress: 0,
                    processing_message: 'Preparing for processing...',
                    processing_data: {
                        contentType: 'talking_video',
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
                contentType: 'talking_video',
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
                            contentType: 'talking_video',
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
                        contentType: 'talking_video',
                        targetDuration: parseInt(String(targetDuration))
                    }
                })
                throw new Error(errorMessage)
            }

            // 4. Navigate to projects page showing the processing project
            router.push(`/projects?highlight=${project.id}`)

        } catch (error) {
            console.error('Error starting quickclips:', error)
            alert(error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.')
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-teal-50 to-emerald-50 min-h-screen flex items-center pt-24 pb-20">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-500/30 via-teal-500/20 to-emerald-400/30 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-emerald-400/30 via-teal-500/20 to-blue-500/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gradient-to-br from-teal-500/30 to-emerald-400/30 rounded-full blur-2xl animate-pulse delay-500"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Column - Content */}
                    <div className="text-center lg:text-left">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 via-teal-50 to-emerald-50 border border-blue-200/50 rounded-full px-4 py-2 mb-6 backdrop-blur-sm">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-bold bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 bg-clip-text text-transparent">AI-Native Video Creation</span>
                        </div>

                        {/* Main Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                            Transform 
                            <span className="font-bold bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 bg-clip-text text-transparent animate-gradient-x"> Hours </span>
                            into 
                            <span className="font-bold bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500 bg-clip-text text-transparent animate-gradient-x"> Highlights</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                            Turn your long-form content into engaging videos with AI. Perfect for professionals, educators, and content creators who want to save time and reach more audiences.
                        </p>

                        {/* Key Benefits */}
                        <div className="flex flex-wrap justify-center lg:justify-start gap-4 mb-8">
                            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 border border-blue-200/30 shadow-lg">
                                <Zap className="w-5 h-5 text-blue-500" />
                                <span className="text-gray-700 font-bold">10x Faster Editing</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 border border-teal-200/30 shadow-lg">
                                <Clock className="w-5 h-5 text-teal-500" />
                                <span className="text-gray-700 font-bold">Hours to Minutes</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 border border-emerald-200/30 shadow-lg">
                                <Sparkles className="w-5 h-5 text-emerald-500" />
                                <span className="text-gray-700 font-bold">Rich AI Features</span>
                            </div>
                        </div>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <button
                                onClick={handleGetStarted}
                                className="font-bold bg-gradient-to-br from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                            >
                                {user ? 'View My Projects' : 'Start Creating'}
                            </button>
                            <button
                                onClick={handleWatchDemo}
                                className="flex items-center justify-center gap-2 bg-white/70 backdrop-blur-sm hover:bg-white text-gray-700 font-bold text-lg px-8 py-4 rounded-xl border-2 border-blue-200/50 hover:border-blue-300 transition-all duration-300 shadow-lg hover:shadow-xl"
                            >
                                <Play className="w-5 h-5" />
                                Watch Demo
                            </button>
                        </div>
                    </div>

                    {/* Right Column - Smart Cut Interface */}
                    <div className="relative">
                        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/50 relative overflow-hidden">
                            {/* Background Pattern */}
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-400 rounded-full blur-xl"></div>
                                <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-500 rounded-full blur-xl"></div>
                            </div>

                            {/* Upload Header */}
                            <div className="text-center mb-6 relative z-10">
                                <h3 className="text-xl font-bold bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 bg-clip-text text-transparent mb-2">
                                    Try Smart Cut Now
                                </h3>
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

                            {/* Options - Only show after file upload */}
                            {selectedFile && (
                                <div className="mb-6 relative z-10 space-y-4">
                                    {/* Video Type Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Select Video Type
                                        </label>
                                        <div className="grid grid-cols-1 gap-3">
                                            <button
                                                onClick={() => setTargetDuration(60)}
                                                className={`p-4 rounded-lg border-2 transition-all text-left ${
                                                    targetDuration <= 90 
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
                                                onClick={() => setTargetDuration(300)}
                                                className={`p-4 rounded-lg border-2 transition-all text-left ${
                                                    targetDuration > 90 
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
                                </div>
                            )}

                            {/* Start Button */}
                            <button
                                onClick={handleStartEditing}
                                disabled={isUploading}
                                className={`
                                    w-full font-bold text-lg px-6 py-4 rounded-2xl 
                                    transition-all duration-300 shadow-xl hover:shadow-2xl 
                                    transform hover:scale-105 active:scale-95
                                    relative overflow-hidden group relative z-10
                                    ${selectedFile 
                                        ? 'bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 hover:from-blue-600 hover:via-teal-600 hover:to-emerald-500 text-white'
                                        : 'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 hover:from-purple-600 hover:via-violet-600 hover:to-indigo-600 text-white cursor-pointer'
                                    }
                                    ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}
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

                            {/* Note */}
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
                </div>
            </div>
        </section>
    )
}

export default HomeHeroSection 