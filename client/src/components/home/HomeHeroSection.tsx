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
                                <div className="text-2xl font-bold text-gray-400">10K+</div>
                                <div className="text-sm text-gray-500">Videos Created</div>
                                <div className="text-2xl font-bold text-gray-400">50K+</div>
                                <div className="text-sm text-gray-500">Hours Saved</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Upload Interface */}
                    <div className="relative">
                        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200">
                            {/* Upload Header */}
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                    Try it now
                                </h3>
                                <p className="text-gray-600">
                                    Upload your video and see the magic happen
                                </p>
                            </div>

                            {/* Upload Area */}
                            <div className="mb-6">
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
                                        border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                                        transition-all duration-200
                                        ${selectedFile ? 
                                            'border-blue-400 bg-blue-50' : 
                                            'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                                        }
                                    `}
                                >
                                    {selectedFile ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <Video className="w-6 h-6 text-blue-600" />
                                            <div>
                                                <p className="font-medium text-blue-800">
                                                    {selectedFile.name}
                                                </p>
                                                <p className="text-sm text-blue-600">
                                                    Click to change file
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                                            <p className="font-medium text-gray-600 mb-1">
                                                Upload your video
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                MP4, MOV, AVI up to 2GB
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Content Type Selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-3">Content Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {contentTypes.map((type) => {
                                        const Icon = type.icon
                                        return (
                                            <button
                                                key={type.id}
                                                onClick={() => setContentType(type.id)}
                                                className={`
                                                    flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-sm
                                                    ${contentType === type.id ? 
                                                        'border-blue-500 bg-blue-50 text-blue-700' : 
                                                        'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                                    }
                                                `}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span className="font-medium">{type.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Target Duration */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <Clock className="w-4 h-4 text-gray-600" />
                                    <label className="text-sm font-medium text-gray-700">
                                        Target: {targetDuration} minutes
                                    </label>
                                </div>
                                
                                <input
                                    type="range"
                                    min="5"
                                    max="30"
                                    value={targetDuration}
                                    onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>5 min</span>
                                    <span>30 min</span>
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
                                    text-white font-semibold
                                    px-6 py-3 rounded-xl 
                                    transition-all duration-300 shadow-lg hover:shadow-xl 
                                    disabled:cursor-not-allowed 
                                "
                            >
                                {isUploading ? 'Processing...' : 'Start AI Editing'}
                            </button>

                            {/* Note */}
                            <p className="text-xs text-gray-500 text-center mt-3">
                                {user ? 'Your video will be processed immediately' : 'Sign in required to process video'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HomeHeroSection 