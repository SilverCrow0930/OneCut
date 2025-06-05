'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Upload, Clock, Users, BookOpen, Mic, Video } from 'lucide-react'

const AutocutSection = () => {
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
            // 1. 创建新项目
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

            // 2. 上传文件到assets
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

            // 3. 准备Autocut设置
            const autocutSettings = {
                targetDuration,
                contentType,
                filename: selectedFile.name,
                hasFile: true // 标记已上传文件
            }

            // 4. 跳转到编辑器并自动选择Autocut工具
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
        <div 
            id="autocut-section"
            className="
                flex flex-col w-full min-h-screen items-center justify-center
                py-20 px-4 bg-gray-900
            "
        >
            <div className="max-w-2xl w-full">
                
                {/* Title & Subtitle */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        Transform Hours into Highlights
                    </h2>
                    <p className="text-lg text-gray-300">
                        Upload your long-form content and let AI create polished highlights
                    </p>
                </div>

                {/* Upload Area */}
                <div className="mb-8">
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
                            border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
                            transition-all duration-300 hover:scale-[1.02]
                            ${selectedFile ? 
                                'border-blue-400 bg-blue-900/20 shadow-lg' : 
                                'border-gray-600 hover:border-blue-400 hover:bg-blue-900/10 hover:shadow-md'
                            }
                        `}
                    >
                        {selectedFile ? (
                            <div className="flex items-center justify-center gap-4">
                                <div className="w-16 h-16 bg-blue-900/50 rounded-full flex items-center justify-center">
                                    <Video className="w-8 h-8 text-blue-400" />
                                </div>
                                <div className="text-left">
                                    <p className="text-xl font-semibold text-blue-300 mb-1">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-sm text-blue-400">
                                        Click to change file
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Upload className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-2xl font-semibold text-white mb-3">
                                    Upload your 1-2 hour content
                                </h3>
                                <p className="text-gray-300 mb-4">
                                    Supports MP4, MOV, AVI formats
                                </p>
                                <p className="text-sm text-gray-500">
                                    Drag and drop or click to browse
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Target Duration Slider */}
                <div className="mb-8 bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-700">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-900/50 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-xl font-semibold text-white">
                            Target Duration: {targetDuration} minutes
                        </span>
                    </div>
                    
                    <div className="relative">
                        <input
                            type="range"
                            min="5"
                            max="30"
                            value={targetDuration}
                            onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                            className="
                                w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer
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
                                [&::-moz-range-thumb]:w-6 
                                [&::-moz-range-thumb]:h-6 
                                [&::-moz-range-thumb]:rounded-full 
                                [&::-moz-range-thumb]:bg-gradient-to-r
                                [&::-moz-range-thumb]:from-blue-500
                                [&::-moz-range-thumb]:to-purple-500
                                [&::-moz-range-thumb]:border-3
                                [&::-moz-range-thumb]:border-white
                                [&::-moz-range-thumb]:shadow-lg
                                [&::-moz-range-thumb]:cursor-pointer
                                [&::-moz-range-thumb]:border-none
                            "
                        />
                        <div className="flex justify-between text-sm text-gray-400 mt-3">
                            <span className="font-medium">5 min</span>
                            <span className="font-medium">30 min</span>
                        </div>
                    </div>
                </div>

                {/* Content Type Selection */}
                <div className="mb-10 bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-700">
                    <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-900/50 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v2a1 1 0 01-1 1h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8H3a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
                            </svg>
                        </div>
                        Content Type
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {contentTypes.map((type) => {
                            const Icon = type.icon
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setContentType(type.id)}
                                    className={`
                                        flex flex-col items-center p-6 rounded-xl border-2 transition-all duration-200
                                        hover:scale-105 active:scale-95
                                        ${contentType === type.id ? 
                                            'border-blue-500 bg-blue-900/30 text-blue-300 shadow-md' : 
                                            'border-gray-600 hover:border-blue-400 hover:bg-blue-900/10 hover:shadow-sm text-gray-300'
                                        }
                                    `}
                                >
                                    <Icon className="w-8 h-8 mb-3" />
                                    <span className="text-sm font-semibold">{type.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStartEditing}
                    disabled={isUploading || !selectedFile}
                    className="
                        w-full bg-gradient-to-r from-blue-600 to-purple-600 
                        hover:from-blue-700 hover:to-purple-700
                        disabled:from-gray-600 disabled:to-gray-700
                        text-white font-bold text-xl
                        px-8 py-5 rounded-2xl 
                        transition-all duration-300 shadow-lg hover:shadow-xl 
                        active:transform active:scale-95 
                        disabled:cursor-not-allowed disabled:transform-none
                        disabled:opacity-60
                    "
                >
                    {isUploading ? (
                        <div className="flex items-center justify-center gap-3">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Creating Project...
                        </div>
                    ) : !selectedFile ? (
                        'Select a video file to continue'
                    ) : (
                        'Start Editing'
                    )}
                </button>

            </div>
        </div>
    )
}

export default AutocutSection 