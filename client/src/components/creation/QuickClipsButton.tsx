import React, { useState, useRef } from 'react'
import { Zap, Upload, Clock, Users, BookOpen, Mic, Video, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { apiPath } from '@/lib/config'

const QuickClipsButton = () => {
    const { user, session, signIn } = useAuth()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60)
    const [contentType, setContentType] = useState('talking_video')
    const [isDragOver, setIsDragOver] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    
    const contentTypes = [
        { id: 'podcast', label: 'Podcast', icon: Mic },
        { id: 'professional_meeting', label: 'Meeting', icon: Users },
        { id: 'educational_video', label: 'Tutorial', icon: BookOpen },
        { id: 'talking_video', label: 'Talking Video', icon: Video }
    ]

    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]

    const getVideoFormat = (durationSeconds: number) => {
        return durationSeconds < 120 ? 'short_vertical' : 'long_horizontal'
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

    const uploadFileToGCS = async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(apiPath('assets/upload-to-gcs'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: formData
        })

        if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}`)
        }

        const result = await response.json()
        return result.gsUri
    }

    const createQuickClipsProject = async (fileUri: string, filename: string) => {
        const response = await fetch(apiPath('projects'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `Quick Clips - ${filename}`,
                project_type: 'quickclips',
                processing_status: 'processing',
                processing_progress: 0,
                processing_message: 'Starting AI processing...',
                original_file_uri: fileUri,
                content_type: contentType,
                target_duration: targetDuration,
                video_format: getVideoFormat(targetDuration)
            })
        })

        if (!response.ok) {
            throw new Error('Failed to create project')
        }

        return await response.json()
    }

    const startBackgroundProcessing = async (projectId: string, fileUri: string) => {
        // Call background processing endpoint
        await fetch(apiPath('quickclips/process'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId,
                fileUri,
                mimeType: selectedFile?.type,
                contentType,
                targetDuration,
                videoFormat: getVideoFormat(targetDuration)
            })
        })
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

        setIsProcessing(true)
        setError(null)

        try {
            // 1. Upload file to GCS
            const fileUri = await uploadFileToGCS(selectedFile)

            // 2. Create QuickClips project
            const project = await createQuickClipsProject(fileUri, selectedFile.name)

            // 3. Start background processing (fire and forget)
            await startBackgroundProcessing(project.id, fileUri)

            // 4. Close modal and redirect to projects page
            setIsModalOpen(false)
            router.push('/creation')

            // Show success message (you could use a toast notification here)
            alert(`QuickClips processing started! We'll email you when "${project.name}" is ready.`)

        } catch (error) {
            console.error('Error starting QuickClips:', error)
            setError(error instanceof Error ? error.message : 'Failed to start processing')
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="
                    inline-flex items-center justify-center gap-2 
                    px-6 py-3 rounded-lg font-semibold text-white
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-700 hover:to-teal-700
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                    shadow-lg hover:shadow-xl
                    transform transition-all duration-200
                    hover:scale-105 active:scale-95
                "
            >
                <Zap className="w-5 h-5" />
                <span>Quick AI Clips</span>
            </button>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Quick AI Clips</h2>
                                <p className="text-gray-600">Start processing - we'll notify you when ready!</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Error Message */}
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-800 text-sm">{error}</p>
                                </div>
                            )}

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
                                            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                                            transition-all duration-300
                                            ${selectedFile ? 
                                                'border-emerald-400 bg-emerald-50' : 
                                                isDragOver ?
                                                    'border-emerald-500 bg-emerald-100 scale-105' :
                                                    'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                                            }
                                        `}
                                    >
                                        {selectedFile ? (
                                            <div className="flex items-center justify-center gap-3">
                                                <Video className="w-8 h-8 text-emerald-600" />
                                                <div>
                                                    <p className="font-medium text-emerald-800">{selectedFile.name}</p>
                                                    <p className="text-sm text-emerald-600">Click to change file</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                                <p className="text-lg text-gray-600 mb-2">Drop your video here</p>
                                                <p className="text-sm text-gray-500">or click to browse</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Settings */}
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Content Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">Content Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {contentTypes.map((type) => {
                                                const Icon = type.icon
                                                return (
                                                    <button
                                                        key={type.id}
                                                        onClick={() => setContentType(type.id)}
                                                        className={`
                                                            flex items-center gap-2 p-3 rounded-lg border text-sm
                                                            ${contentType === type.id ? 
                                                                'border-emerald-500 bg-emerald-50 text-emerald-700' : 
                                                                'border-gray-200 hover:border-emerald-300'
                                                            }
                                                        `}
                                                    >
                                                        <Icon className="w-4 h-4" />
                                                        <span>{type.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Target Duration */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">
                                            Target Length: {formatDuration(targetDuration)}
                                        </label>
                                        <div className="space-y-3">
                                            <input
                                                type="range"
                                                min="20"
                                                max="1800"
                                                value={targetDuration}
                                                onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>20s</span>
                                                <span>30m</span>
                                            </div>
                                            <div className="text-center">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                                                    <Clock className="w-4 h-4" />
                                                    {getVideoFormat(targetDuration) === 'short_vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Start Button */}
                                <button
                                    onClick={handleStartProcessing}
                                    disabled={!selectedFile || isProcessing}
                                    className="
                                        w-full bg-gradient-to-r from-emerald-600 to-teal-600 
                                        hover:from-emerald-700 hover:to-teal-700
                                        disabled:from-gray-400 disabled:to-gray-500
                                        text-white font-bold text-lg
                                        px-6 py-4 rounded-xl 
                                        transition-all duration-300 shadow-lg hover:shadow-xl 
                                        disabled:cursor-not-allowed 
                                        transform hover:scale-105 active:scale-95
                                    "
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        {isProcessing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Starting...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-5 h-5" />
                                                Start AI Processing
                                            </>
                                        )}
                                    </span>
                                </button>

                                <div className="text-center space-y-2">
                                    <p className="text-sm text-gray-600">
                                        Processing happens in the background - you can close this and do other things!
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        📧 We'll email you when your clips are ready
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default QuickClipsButton 