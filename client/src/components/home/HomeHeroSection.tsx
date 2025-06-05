import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Play, Sparkles, Zap, Clock, Upload, Video, Users, BookOpen, Mic } from 'lucide-react'

const HomeHeroSection = () => {
    const router = useRouter()
    const { user, session, signIn } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(10) // Default 10 minutes
    const [contentType, setContentType] = useState('meeting')
    const [isUploading, setIsUploading] = useState(false)
    
    const contentTypes = [
        { id: 'meeting', label: 'Meeting', icon: Users },
        { id: 'interview', label: 'Interview', icon: Users },
        { id: 'tutorial', label: 'Tutorial', icon: BookOpen },
        { id: 'podcast', label: 'Podcast', icon: Mic }
    ]

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith('video/')) {
            setSelectedFile(file)
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

        setIsUploading(true)

        try {
            // 1. Create new project
            const projectResponse = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `Autocut - ${selectedFile.name}`,
                    description: `AI editing for ${contentTypes.find(t => t.id === contentType)?.label}`
                })
            })

            if (!projectResponse.ok) {
                throw new Error('Failed to create project')
            }

            const project = await projectResponse.json()

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
                throw new Error('Failed to upload file')
            }

            // 3. Prepare Autocut settings
            const autocutSettings = {
                targetDuration,
                contentType,
                filename: selectedFile.name,
                hasFile: true // Mark that file has been uploaded
            }

            // 4. Navigate to editor and auto-select Autocut tool
            const settingsParam = encodeURIComponent(JSON.stringify(autocutSettings))
            router.push(`/projects/${project.id}?tool=Autocut&settings=${settingsParam}`)

        } catch (error) {
            console.error('Error starting autocut:', error)
            alert('Upload failed, please try again')
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
                        <div className="bg-gradient-to-br from-white via-blue-50/50 to-purple-50/50 rounded-3xl p-8 shadow-2xl border border-blue-200/50 relative overflow-hidden backdrop-blur-sm">
                            {/* Enhanced Background Pattern */}
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-xl animate-pulse"></div>
                                <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full blur-xl animate-pulse"></div>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-br from-purple-300 to-pink-300 rounded-full blur-2xl opacity-30"></div>
                            </div>

                            {/* Upload Header */}
                            <div className="text-center mb-6 relative z-10">
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full px-4 py-2 mb-3 shadow-lg">
                                    <Zap className="w-4 h-4" />
                                    <span className="text-sm font-bold">Autocut</span>
                                </div>
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent mb-2">
                                    Autocut
                                </h3>
                                <p className="text-gray-700 font-medium">
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
                                    className={`
                                        border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                                        transition-all duration-300 group relative overflow-hidden
                                        ${selectedFile ? 
                                            'border-blue-500 bg-gradient-to-br from-blue-100 via-purple-50 to-emerald-50 shadow-inner' : 
                                            'border-blue-300 hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-100 hover:via-purple-50 hover:to-emerald-50 hover:shadow-xl'
                                        }
                                    `}
                                >
                                    {/* Enhanced animated background for hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-purple-400/10 to-emerald-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                    
                                    {selectedFile ? (
                                        <div className="flex flex-col items-center gap-3 relative z-10">
                                            <div className="relative">
                                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-600 to-emerald-500 rounded-2xl flex items-center justify-center shadow-xl">
                                                    <Video className="w-8 h-8 text-white" />
                                                </div>
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold text-blue-900 mb-1">
                                                    {selectedFile.name}
                                                </p>
                                                <p className="text-sm text-blue-700 font-medium">
                                                    Click to change file
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative z-10">
                                            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-purple-600 to-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500 shadow-xl">
                                                <Upload className="w-10 h-10 text-white group-hover:animate-bounce" />
                                            </div>
                                            <p className="font-bold text-gray-800 mb-2 group-hover:text-blue-800 transition-colors duration-300 text-lg">
                                                Drop your video here
                                            </p>
                                            <p className="text-gray-600 mb-4 font-medium">
                                                or click to browse
                                            </p>
                                            <div className="flex items-center justify-center gap-3 text-sm font-medium">
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">MP4</span>
                                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">MOV</span>
                                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">AVI</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 font-medium">Up to 2GB</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content Type Selection */}
                            <div className="mb-6 relative z-10">
                                <label className="block text-sm font-bold text-gray-800 mb-3">Content Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {contentTypes.map((type) => {
                                        const Icon = type.icon
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => setContentType(type.id)}
                                                className={`
                                                    flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 text-sm group
                                                    ${contentType === type.id ? 
                                                        'border-blue-500 bg-gradient-to-br from-blue-100 via-purple-50 to-emerald-50 text-blue-800 shadow-lg transform scale-105' : 
                                                        'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:via-purple-25 hover:to-emerald-25 hover:shadow-md hover:scale-102'
                                                    }
                                                `}
                                            >
                                                <div className={`p-2 rounded-xl ${contentType === type.id ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-gray-400 to-gray-500 group-hover:from-blue-400 group-hover:to-purple-500'} transition-all duration-300 shadow-md`}>
                                                    <Icon className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="font-bold">{type.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Target Duration */}
                            <div className="mb-8 relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-gradient-to-br from-blue-500 via-purple-600 to-emerald-500 rounded-xl shadow-md">
                                        <Clock className="w-5 h-5 text-white" />
                                    </div>
                                    <label className="text-sm font-bold text-gray-800">
                                        Target: <span className="text-blue-600">{targetDuration} minutes</span>
                                    </label>
                                </div>
                                
                                <div className="relative">
                                    <input
                                        type="range"
                                        min="5"
                                        max="30"
                                        value={targetDuration}
                                        onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                                        className="
                                            w-full h-4 bg-gradient-to-r from-blue-200 via-purple-200 to-emerald-200 rounded-full appearance-none cursor-pointer shadow-inner
                                            [&::-webkit-slider-thumb]:appearance-none 
                                            [&::-webkit-slider-thumb]:w-7 
                                            [&::-webkit-slider-thumb]:h-7 
                                            [&::-webkit-slider-thumb]:rounded-full 
                                            [&::-webkit-slider-thumb]:bg-gradient-to-r
                                            [&::-webkit-slider-thumb]:from-blue-500
                                            [&::-webkit-slider-thumb]:via-purple-600
                                            [&::-webkit-slider-thumb]:to-emerald-500
                                            [&::-webkit-slider-thumb]:border-4
                                            [&::-webkit-slider-thumb]:border-white
                                            [&::-webkit-slider-thumb]:shadow-xl
                                            [&::-webkit-slider-thumb]:cursor-pointer
                                            [&::-webkit-slider-thumb]:hover:scale-125
                                            [&::-webkit-slider-thumb]:transition-transform
                                            [&::-webkit-slider-thumb]:duration-200
                                        "
                                    />
                                    <div className="flex justify-between text-sm font-bold text-gray-700 mt-3">
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">5 min</span>
                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">30 min</span>
                                    </div>
                                </div>
                            </div>

                            {/* Start Button */}
                            <button
                                onClick={handleStartEditing}
                                disabled={isUploading || !selectedFile}
                                className="
                                    w-full bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 
                                    hover:from-blue-700 hover:via-purple-700 hover:to-emerald-700
                                    disabled:from-gray-400 disabled:to-gray-500
                                    text-white font-bold text-xl
                                    px-6 py-5 rounded-2xl 
                                    transition-all duration-300 shadow-2xl hover:shadow-3xl 
                                    disabled:cursor-not-allowed 
                                    transform hover:scale-105 active:scale-95
                                    relative overflow-hidden group
                                    relative z-10
                                "
                            >
                                {/* Enhanced button glow effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300 rounded-2xl"></div>
                                
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    {isUploading ? (
                                        <>
                                            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-6 h-6" />
                                            <span>Start AI Editing</span>
                                        </>
                                    )}
                                </span>
                            </button>

                            {/* Note */}
                            <p className="text-sm text-gray-600 text-center mt-4 relative z-10 font-medium">
                                {user ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full animate-pulse"></div>
                                        Your video will be processed immediately
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