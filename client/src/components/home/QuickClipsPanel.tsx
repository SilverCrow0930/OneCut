import React, { useRef, useState } from 'react'
import { ArrowLeft, Upload, Video, ChevronRight } from 'lucide-react'

interface QuickClipsPanelProps {
    onClose: () => void
    selectedFile: File | null
    setSelectedFile: (file: File | null) => void
    targetDuration: number
    setTargetDuration: (duration: number) => void
    handleStartEditing: () => Promise<void>
    isUploading: boolean
    user: any
}

const QuickClipsPanel = ({ 
    onClose, 
    selectedFile, 
    setSelectedFile, 
    targetDuration, 
    setTargetDuration, 
    handleStartEditing, 
    isUploading, 
    user 
}: QuickClipsPanelProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    
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

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file && file.type.startsWith('video/')) {
            setSelectedFile(file)
        }
    }

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
        }
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-semibold">Create Quick Clips</h2>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Step indicator */}
                <div className="flex items-center gap-4 mb-8">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedFile ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        1
                    </div>
                    <div className="flex-1 h-1 bg-gray-200">
                        <div className={`h-full bg-blue-600 transition-all ${selectedFile ? 'w-full' : 'w-0'}`} />
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedFile ? 'bg-gray-200 text-gray-600' : 'bg-gray-200 text-gray-400'}`}>
                        2
                    </div>
                </div>

                {/* Upload Area */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Upload Video</h3>
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
                            transition-all duration-300 group relative
                            ${selectedFile ? 
                                'border-blue-400 bg-blue-50' : 
                                isDragOver ?
                                    'border-blue-500 bg-blue-50' :
                                'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                            }
                        `}
                    >
                        {selectedFile ? (
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Video className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                                    <p className="text-sm text-gray-500">Click to change file</p>
                                </div>
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <Upload className="w-6 h-6 text-gray-600" />
                                </div>
                                <p className="font-medium text-gray-900 mb-1">Drop your video here</p>
                                <p className="text-sm text-gray-500">or click to browse</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Duration Settings */}
                {selectedFile && (
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold mb-4">Output Settings</h3>
                        
                        <div className="bg-gray-50 rounded-xl p-6 mb-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 mb-1">
                                        {targetDuration < 120 ? 'Short Vertical Video' : 'Long Horizontal Video'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {targetDuration < 120 ? 'Perfect for social media stories and reels' : 'Ideal for YouTube and longer content'}
                                    </p>
                                </div>
                                <span className="text-4xl">
                                    {targetDuration < 120 ? '📱' : '💻'}
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700">Target Duration</label>
                                        <span className="text-sm font-medium text-blue-600">{formatDuration(targetDuration)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="20"
                                        max="1800"
                                        value={targetDuration}
                                        onChange={(e) => setTargetDuration(parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t p-6">
                <button
                    onClick={handleStartEditing}
                    disabled={isUploading || !selectedFile}
                    className={`
                        w-full flex items-center justify-center gap-2 
                        bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                        text-white font-medium px-6 py-3 rounded-xl
                        transition-all duration-200
                    `}
                >
                    {isUploading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            Start Processing
                            <ChevronRight className="w-5 h-5" />
                        </>
                    )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                    {user ? (
                        <span className="flex items-center justify-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            Processing starts immediately in background
                        </span>
                    ) : (
                        'Sign in required to process video'
                    )}
                </p>
            </div>
        </div>
    )
}

export default QuickClipsPanel 