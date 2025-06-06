import React, { useState, useRef, useEffect } from 'react'
import { Zap, Upload, Clock, Users, BookOpen, Mic, Video, Download, Play, X, Gamepad2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuickClips, QuickClip } from '@/contexts/QuickClipsContext'
import { apiPath } from '@/lib/config'
import { useRouter } from 'next/navigation'

const QuickClipsButton = () => {
    const { user, session, signIn } = useAuth()
    const { sendQuickClipsRequest, onQuickClipsResponse, onQuickClipsState } = useQuickClips()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [targetDuration, setTargetDuration] = useState(60)
    const [contentType, setContentType] = useState('talking')
    const [customContentType, setCustomContentType] = useState('')
    const [outputMode, setOutputMode] = useState<'individual' | 'stitched'>('individual')
    const [isProcessing, setIsProcessing] = useState(false)
    const [processingProgress, setProcessingProgress] = useState(0)
    const [processingMessage, setProcessingMessage] = useState('')
    const [generatedClips, setGeneratedClips] = useState<QuickClip[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)
    
    const contentTypes = [
        { id: 'talking', label: 'Talking Video', icon: Video },
        { id: 'professional', label: 'Professional', icon: Users },
        { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
        { id: 'custom', label: 'Custom', icon: BookOpen }
    ]

    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]

    const getVideoFormat = (mode: 'individual' | 'stitched') => {
        return mode === 'individual' ? 'short_vertical' : 'long_horizontal'
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

    // WebSocket event listeners
    useEffect(() => {
        onQuickClipsState((state) => {
            console.log('QuickClips state update:', state)
            setProcessingProgress(state.progress)
            setProcessingMessage(state.message)
            
            if (state.state === 'error') {
                setError(state.message)
                setIsProcessing(false)
            } else if (state.state === 'completed') {
                setIsProcessing(false)
            }
        })

        onQuickClipsResponse((response) => {
            console.log('QuickClips response:', response)
            
            if (response.success && response.clips) {
                setGeneratedClips(response.clips)
                setIsProcessing(false)
            } else {
                setError(response.error || 'Processing failed')
                setIsProcessing(false)
            }
        })
    }, [onQuickClipsState, onQuickClipsResponse])

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

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100
                    setUploadProgress(progress)
                }
            })

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText)
                        resolve(response.gsUri)
                    } catch (error) {
                        reject(new Error('Failed to parse upload response'))
                    }
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`))
                }
            })

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'))
            })

            xhr.open('POST', apiPath('assets/upload-to-gcs'))
            xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token}`)
            xhr.send(formData)
        })
    }

    const createProject = async (filename: string, contentType: string): Promise<string> => {
        const contentTypeLabels: Record<string, string> = {
            'talking': 'Talking Video',
            'professional': 'Professional',
            'gaming': 'Gaming',
            'custom': customContentType || 'Custom'
        }

        const response = await fetch(apiPath('projects'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `AI Clips - ${filename}`,
                type: 'quickclips',
                processing_status: 'processing',
                processing_message: 'Starting AI analysis...',
                quickclips_data: {
                    clips: [],
                    contentType,
                    targetDuration,
                    videoFormat: getVideoFormat(outputMode),
                    outputMode,
                    originalFilename: filename
                }
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('Project creation failed:', {
                status: response.status,
                statusText: response.statusText,
                errorData
            })
            throw new Error(errorData.error || `Failed to create project (${response.status})`)
        }

        const project = await response.json()
        return project.id
    }

    const updateProjectStatus = async (projectId: string, status: string, message: string, clips?: QuickClip[]) => {
        const updateData: any = {
            processing_status: status,
            processing_message: message
        }

        if (clips) {
            updateData.quickclips_data = {
                clips,
                contentType,
                targetDuration,
                videoFormat: getVideoFormat(outputMode),
                outputMode,
                originalFilename: selectedFile?.name || 'Unknown'
            }
        }

        await fetch(apiPath(`projects/${projectId}`), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
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

        if (contentType === 'custom' && !customContentType.trim()) {
            alert('Please describe your custom content type')
            return
        }

        setIsUploading(true)
        setIsProcessing(true)
        setProcessingProgress(0)
        setError(null)

        let projectId: string | null = null

        try {
            // 1. Create project immediately with uploading status
            projectId = await createProject(selectedFile.name, contentType)
            
            // 2. Close modal and redirect to projects page
            setIsModalOpen(false)
            router.push('/creation')

            // 3. Update project to show uploading status
            await updateProjectStatus(projectId, 'processing', 'Uploading video file...')

            // 4. Upload file to GCS (this may take time for large files)
            const fileUri = await uploadFileToGCS(selectedFile)
            setIsUploading(false)

            // 5. Update project status after upload
            await updateProjectStatus(projectId, 'processing', 'Upload complete, starting AI analysis...')

            // 6. Send to QuickClips processing with project ID
            sendQuickClipsRequest({
                fileUri,
                mimeType: selectedFile.type,
                contentType: contentType === 'custom' ? customContentType : contentType,
                targetDuration,
                videoFormat: getVideoFormat(outputMode),
                outputMode,
                projectId  // Include project ID for updates
            })

        } catch (error) {
            console.error('Error processing video:', error)
            setError(error instanceof Error ? error.message : 'Upload failed')
            
            // Update project status to error if we have a project ID
            if (projectId) {
                try {
                    await updateProjectStatus(projectId, 'error', error instanceof Error ? error.message : 'Upload failed')
                } catch (updateError) {
                    console.error('Failed to update project error status:', updateError)
                }
            }
            
            setIsUploading(false)
            setIsProcessing(false)
        }
    }

    const handleDownload = (clip: QuickClip) => {
        // TODO: Implement actual download when backend provides real URLs
        console.log('Downloading clip:', clip)
        // For now, just open a new tab with the preview
        window.open(clip.previewUrl, '_blank')
    }

    const handleReset = () => {
        setSelectedFile(null)
        setGeneratedClips([])
        setProcessingProgress(0)
        setProcessingMessage('')
        setIsProcessing(false)
        setIsUploading(false)
        setUploadProgress(0)
        setError(null)
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
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Quick AI Clips</h2>
                                <p className="text-gray-600">Upload video and we'll process it in the background</p>
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

                            {/* Upload View */}
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
                                        
                                        {/* Custom Content Type Input */}
                                        {contentType === 'custom' && (
                                            <div className="mt-3">
                                                <input
                                                    type="text"
                                                    placeholder="Describe your content type..."
                                                    value={customContentType}
                                                    onChange={(e) => setCustomContentType(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Output Mode */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-3">Output Mode</label>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-1 gap-3">
                                                <button
                                                    onClick={() => setOutputMode('individual')}
                                                    className={`
                                                        p-4 rounded-lg border text-left
                                                        ${outputMode === 'individual' ? 
                                                            'border-emerald-500 bg-emerald-50' : 
                                                            'border-gray-200 hover:border-emerald-300'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-shrink-0 w-8 h-12 bg-emerald-100 rounded border-2 border-emerald-300"></div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">Short Videos</div>
                                                            <div className="text-sm text-gray-600">Multiple 20-90s clips (9:16)</div>
                                                            <div className="text-xs text-gray-500">Individual downloads for social media</div>
                                                        </div>
                                                    </div>
                                                </button>
                                                
                                                <button
                                                    onClick={() => setOutputMode('stitched')}
                                                    className={`
                                                        p-4 rounded-lg border text-left
                                                        ${outputMode === 'stitched' ? 
                                                            'border-emerald-500 bg-emerald-50' : 
                                                            'border-gray-200 hover:border-emerald-300'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-shrink-0 w-12 h-8 bg-emerald-100 rounded border-2 border-emerald-300"></div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">Long Video</div>
                                                            <div className="text-sm text-gray-600">One highlight reel (16:9)</div>
                                                            <div className="text-xs text-gray-500">Multiple clips stitched together</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            </div>
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
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>20s</span>
                                                <span>30m</span>
                                            </div>
                                            <div className="text-center">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                                                    <Clock className="w-4 h-4" />
                                                    {getVideoFormat(outputMode) === 'short_vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Generate Button */}
                                <button
                                    onClick={handleStartProcessing}
                                    disabled={!selectedFile || isProcessing || isUploading}
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
                                        <Zap className="w-5 h-5" />
                                        Start Background Processing
                                    </span>
                                </button>

                                <p className="text-xs text-gray-500 text-center">
                                    Processing will continue in the background. You can navigate away and check progress later!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default QuickClipsButton 