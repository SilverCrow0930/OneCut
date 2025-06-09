import React, { useState, useRef } from 'react'
import { Zap, Upload, Video, Clock, Users, BookOpen, Mic, Sparkles, Loader2 } from 'lucide-react'

interface QuickClipsWidgetProps {
    onFileSelected?: (file: File) => void
    onStartProcessing?: (data: {
        file: File
        contentType: string
        customContentType?: string
        targetDuration: number
    }) => void
    isUploading?: boolean
    isProcessing?: boolean
    uploadProgress?: number
    processingProgress?: number
    processingMessage?: string
    size?: 'compact' | 'default' | 'large'
    theme?: 'default' | 'purple' | 'blue'
}

const contentTypes = [
    { id: 'talking_video', label: 'Talking Video', icon: Video, description: 'Speech-focused content' },
    { id: 'professional_meeting', label: 'Meeting', icon: Users, description: 'Business discussions' },
    { id: 'educational_video', label: 'Tutorial', icon: BookOpen, description: 'Learning content' },
    { id: 'custom', label: 'Custom', icon: Mic, description: 'Custom content type' }
]

const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]

export const QuickClipsWidget: React.FC<QuickClipsWidgetProps> = ({
    onFileSelected,
    onStartProcessing,
    isUploading = false,
    isProcessing = false,
    uploadProgress = 0,
    processingProgress = 0,
    processingMessage = '',
    size = 'default',
    theme = 'default'
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [contentType, setContentType] = useState('talking_video')
    const [customContentType, setCustomContentType] = useState('')
    const [targetDuration, setTargetDuration] = useState(60)
    const [isDragOver, setIsDragOver] = useState(false)
    const [showConfig, setShowConfig] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

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
            return { format: 'Short Vertical', ratio: '9:16', icon: '📱' }
        } else {
            return { format: 'Long Horizontal', ratio: '16:9', icon: '🖥️' }
        }
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith('video/')) {
            setSelectedFile(file)
            setShowConfig(true)
            onFileSelected?.(file)
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
            setShowConfig(true)
            onFileSelected?.(videoFile)
        }
    }

    const handleStartProcessing = () => {
        if (!selectedFile) return

        const finalContentType = contentType === 'custom' ? customContentType.trim() : contentType
        
        onStartProcessing?.({
            file: selectedFile,
            contentType: finalContentType,
            customContentType: contentType === 'custom' ? customContentType.trim() : undefined,
            targetDuration
        })
    }

    const resetState = () => {
        setSelectedFile(null)
        setShowConfig(false)
        setContentType('talking_video')
        setCustomContentType('')
        setTargetDuration(60)
    }

    const formatInfo = getFormatInfo(targetDuration)

    if (isProcessing || isUploading) {
        return (
            <div className={`bg-white rounded-xl border border-gray-200 ${size === 'compact' ? 'p-4' : size === 'large' ? 'p-8' : 'p-6'}`}>
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {isUploading ? 'Uploading Video...' : 'Processing Your Video'}
                    </h3>
                    <p className="text-gray-600">
                        {isUploading ? 'Uploading to cloud storage...' : processingMessage || 'AI is analyzing and creating clips...'}
                    </p>
                    
                    <div className="max-w-xs mx-auto">
                        <div className="bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${isUploading ? uploadProgress : processingProgress}%` }}
                            />
                        </div>
                        <p className="text-sm text-gray-500">
                            {Math.round(isUploading ? uploadProgress : processingProgress)}% complete
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (!selectedFile && !showConfig) {
        return (
            <div className={`bg-white rounded-xl border border-gray-200 ${size === 'compact' ? 'p-4' : size === 'large' ? 'p-8' : 'p-6'}`}>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="video/*"
                    className="hidden"
                />
                
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Quick AI Clips</h3>
                    </div>
                    
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`
                            border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                            transition-all duration-300 group
                            ${isDragOver ? 
                                'border-blue-500 bg-blue-50 scale-105' :
                                'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                            }
                        `}
                    >
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="w-6 h-6 text-gray-500 group-hover:text-blue-600 transition-colors duration-300" />
                        </div>
                        <p className="font-semibold text-gray-700 mb-2 group-hover:text-blue-700 transition-colors duration-300">
                            Drop your video here
                        </p>
                        <p className="text-sm text-gray-500 mb-3">
                            or click to browse
                        </p>
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                            <span>MP4</span>
                            <span>•</span>
                            <span>MOV</span>
                            <span>•</span>
                            <span>AVI</span>
                        </div>
                    </div>
                    
                    <p className="text-sm text-gray-500 leading-relaxed">
                        Upload your video and get instant clips optimized for social media
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={`bg-white rounded-xl border border-gray-200 ${size === 'compact' ? 'p-4 space-y-3' : size === 'large' ? 'p-8 space-y-6' : 'p-6 space-y-4'}`}>
            {/* Selected File Info */}
            {selectedFile && (
                <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                            <Video className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        <button
                            onClick={resetState}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white transition-colors"
                        >
                            Change
                        </button>
                    </div>
                </div>
            )}

            {/* Content Type Selection */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Content Type</label>
                <div className="grid grid-cols-1 gap-2">
                    {contentTypes.map((type) => {
                        const Icon = type.icon
                        return (
                            <button
                                key={type.id}
                                onClick={() => setContentType(type.id)}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    contentType === type.id
                                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <div>
                                        <div className="font-medium text-sm">{type.label}</div>
                                        <div className="text-xs text-gray-500">{type.description}</div>
                                    </div>
                                </div>
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Describe your content type to help AI understand your video
                        </p>
                    </div>
                )}
            </div>

            {/* Duration Selection */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                    Target Duration: {formatDuration(targetDuration)}
                </label>
                
                <div className="p-3 bg-blue-50 rounded-lg border flex items-center gap-3 text-sm">
                    <span>{formatInfo.icon}</span>
                    <span className="font-medium">{formatInfo.format}</span>
                    <span className="text-gray-600">({formatInfo.ratio})</span>
                </div>

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
            </div>

            {/* Action Button */}
            <button
                onClick={handleStartProcessing}
                disabled={!selectedFile || (contentType === 'custom' && !customContentType.trim())}
                className="
                    w-full bg-gradient-to-r from-blue-600 to-purple-600 
                    hover:from-blue-700 hover:to-purple-700
                    disabled:from-gray-400 disabled:to-gray-500
                    text-white font-bold text-sm
                    px-4 py-3 rounded-xl 
                    transition-all duration-300 shadow-lg hover:shadow-xl 
                    disabled:cursor-not-allowed 
                    transform hover:scale-105 active:scale-95
                    flex items-center justify-center gap-2
                "
            >
                <Sparkles className="w-4 h-4" />
                Generate AI Clips
            </button>
        </div>
    )
}

export default QuickClipsWidget 