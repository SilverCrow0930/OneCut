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
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16') // Default to vertical
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
                aspectRatio,
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
        <section className="py-20 bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Title & Subtitle */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-200 rounded-full px-4 py-2 mb-6">
                        <span className="text-sm font-medium text-blue-700">Try Autocut Now</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Ready to create your first highlight?
                    </h2>
                    <p className="text-xl text-gray-600">
                        Upload your long-form content and watch our AI work its magic
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
                            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                            transition-all duration-200
                            ${selectedFile ? 
                                'border-blue-400 bg-blue-50' : 
                                'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                            }
                        `}
                    >
                        {selectedFile ? (
                            <div className="flex items-center justify-center gap-3">
                                <Video className="w-8 h-8 text-blue-600" />
                                <div>
                                    <p className="text-lg font-medium text-blue-800">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-sm text-blue-600">
                                        Click to change file
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-lg text-gray-600 mb-2">
                                    Upload your 1-2 hour content
                                </p>
                                <p className="text-sm text-gray-500">
                                    Supports MP4, MOV, AVI formats
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Target Duration Slider */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <Clock className="w-5 h-5 text-gray-600" />
                        <span className="text-lg font-medium text-gray-700">
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
                                w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none 
                                [&::-webkit-slider-thumb]:w-5 
                                [&::-webkit-slider-thumb]:h-5 
                                [&::-webkit-slider-thumb]:rounded-full 
                                [&::-webkit-slider-thumb]:bg-gradient-to-r
                                [&::-webkit-slider-thumb]:from-blue-500
                                [&::-webkit-slider-thumb]:to-purple-500
                                [&::-webkit-slider-thumb]:border-2
                                [&::-webkit-slider-thumb]:border-white
                                [&::-webkit-slider-thumb]:shadow-lg
                                [&::-webkit-slider-thumb]:cursor-pointer
                                [&::-moz-range-thumb]:w-5 
                                [&::-moz-range-thumb]:h-5 
                                [&::-moz-range-thumb]:rounded-full 
                                [&::-moz-range-thumb]:bg-gradient-to-r
                                [&::-moz-range-thumb]:from-blue-500
                                [&::-moz-range-thumb]:to-purple-500
                                [&::-moz-range-thumb]:border-2
                                [&::-moz-range-thumb]:border-white
                                [&::-moz-range-thumb]:shadow-lg
                                [&::-moz-range-thumb]:cursor-pointer
                                [&::-moz-range-thumb]:border-none
                            "
                        />
                        <div className="flex justify-between text-sm text-gray-500 mt-2">
                            <span>5 min</span>
                            <span>30 min</span>
                        </div>
                    </div>
                </div>

                {/* Aspect Ratio Selection */}
                <div className="mb-8">
                    <h3 className="text-lg font-medium text-gray-700 mb-4">Video Format</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setAspectRatio('9:16')}
                            className={`p-4 rounded-xl border-2 transition-all text-center ${
                                aspectRatio === '9:16' 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                        >
                            <div className="text-3xl mb-2">📱</div>
                            <div className="text-sm font-medium text-gray-900">Vertical</div>
                            <div className="text-xs text-gray-600 mt-1">9:16</div>
                            <div className="text-xs text-gray-500 mt-1">Mobile/Social</div>
                        </button>
                        <button
                            onClick={() => setAspectRatio('16:9')}
                            className={`p-4 rounded-xl border-2 transition-all text-center ${
                                aspectRatio === '16:9' 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                        >
                            <div className="text-3xl mb-2">💻</div>
                            <div className="text-sm font-medium text-gray-900">Horizontal</div>
                            <div className="text-xs text-gray-600 mt-1">16:9</div>
                            <div className="text-xs text-gray-500 mt-1">Desktop/TV</div>
                        </button>
                    </div>
                </div>

                {/* Content Type Selection */}
                <div className="mb-10">
                    <h3 className="text-lg font-medium text-gray-700 mb-4">Content Type</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {contentTypes.map((type) => {
                            const Icon = type.icon
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setContentType(type.id)}
                                    className={`
                                        flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200
                                        ${contentType === type.id ? 
                                            'border-blue-500 bg-blue-50 text-blue-700' : 
                                            'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                        }
                                    `}
                                >
                                    <Icon className="w-6 h-6 mb-2" />
                                    <span className="text-sm font-medium">{type.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStartEditing}
                    disabled={isUploading}
                    className="
                        w-full bg-gradient-to-r from-blue-600 to-purple-600 
                        hover:from-blue-700 hover:to-purple-700
                        disabled:from-gray-400 disabled:to-gray-500
                        text-white font-semibold text-lg
                        px-8 py-4 rounded-xl 
                        transition-all duration-300 shadow-lg hover:shadow-xl 
                        active:transform active:scale-95 
                        disabled:cursor-not-allowed disabled:transform-none
                    "
                >
                    {isUploading ? 'Creating Project...' : 'Start Editing'}
                </button>

            </div>
        </section>
    )
}

export default AutocutSection 