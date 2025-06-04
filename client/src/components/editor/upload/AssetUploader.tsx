import React, { useRef, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Upload } from 'lucide-react'
import { Asset } from '@/contexts/AssetsContext'

interface UploadProgress {
    fileName: string;
    progress: number;
    error?: string;
}

interface AssetUploaderProps {
    onUploadSuccess?: (assets: Asset[]) => void
}

export default function AssetUploader({ onUploadSuccess }: AssetUploaderProps) {
    const { session } = useAuth()
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
    const [isDragging, setIsDragging] = useState<boolean>(false)
    const [showProgress, setShowProgress] = useState(false)

    // Auto-hide progress UI when all uploads are successful
    useEffect(() => {
        if (uploadProgress.length > 0) {
            const allSuccessful = uploadProgress.every(p => p.progress === 100 && !p.error)
            if (allSuccessful) {
                const timer = setTimeout(() => {
                    setShowProgress(false)
                    setUploadProgress([])
                }, 1000) // Wait 1 second before hiding
                return () => clearTimeout(timer)
            }
        }
    }, [uploadProgress])

    const uploadFile = async (file: File): Promise<any> => {
        if (!session?.access_token) {
            throw new Error('Not signed in')
        }

        // Add file to progress tracking
        setUploadProgress(prev => [...prev, { fileName: file.name, progress: 0 }])
        setShowProgress(true)

        try {
            // 1) measure duration in ms
            const url = URL.createObjectURL(file)
            const media = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video')
            media.preload = 'metadata'
            media.src = url

            await new Promise<void>((resolve, reject) => {
                media.onloadedmetadata = () => resolve()
                media.onerror = () => reject(new Error('Could not load media metadata'))
            })

            // Convert duration to seconds for storage
            const durationSeconds = media.duration || 0
            console.log('[Uploader] duration (seconds) →', durationSeconds)
            URL.revokeObjectURL(url)

            // 2) build form data including duration
            const form = new FormData()
            form.append('file', file)
            form.append('duration', String(durationSeconds))

            // 3) upload to server
            const response = await fetch(apiPath('assets/upload'), {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: form,
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Upload failed ${response.status}: ${text}`)
            }

            const uploadedAsset = await response.json()

            // Update progress to 100%
            setUploadProgress(prev =>
                prev.map(p => p.fileName === file.name ? { ...p, progress: 100 } : p)
            )

            return uploadedAsset
        } catch (err: any) {
            console.error('Asset upload error:', err)
            setUploadProgress(prev =>
                prev.map(p => p.fileName === file.name ? { ...p, error: err.message } : p)
            )
            throw err
        }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setUploading(true)
        setUploadProgress([])
        setShowProgress(true)

        try {
            const uploadedAssets = await Promise.all(files.map(file => uploadFile(file)))
            if (onUploadSuccess) {
                onUploadSuccess(uploadedAssets)
            }
        } catch (err) {
            console.error('Batch upload error:', err)
        } finally {
            setUploading(false)
            if (inputRef.current) {
                inputRef.current.value = ''
            }
        }
    }

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        if (files.length === 0) return

        setUploading(true)
        setUploadProgress([])
        setShowProgress(true)

        try {
            const uploadedAssets = await Promise.all(files.map(file => uploadFile(file)))
            if (onUploadSuccess) {
                onUploadSuccess(uploadedAssets)
            }
        } catch (err) {
            console.error('Batch upload error:', err)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex flex-col w-full gap-2">
            <label 
                className={`
                    relative flex flex-col w-full items-center justify-center
                    p-8 rounded-xl gap-3 cursor-pointer
                    border-2 transition-all duration-300 ease-in-out
                    ${isDragging ?
                        'border-blue-400 bg-blue-50 shadow-lg scale-[1.02]' :
                        'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'
                    }
                    ${uploading ? 'opacity-75 cursor-not-allowed' : ''}
                `}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="flex items-center gap-3">
                    <Upload className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-gray-500'} transition-colors`} />
                    <span className={`text-lg font-medium ${isDragging ? 'text-blue-600' : 'text-gray-700'} transition-colors`}>
                        {uploading ? 'Uploading…' : 'Upload files'}
                    </span>
                </div>
                <p className={`text-sm ${isDragging ? 'text-blue-500' : 'text-gray-500'} transition-colors`}>
                    Click to browse or drag files here
                </p>
                <input
                    type="file"
                    accept="image/*, video/*, audio/*"
                    ref={inputRef}
                    onChange={handleUpload}
                    disabled={uploading}
                    multiple
                    className="hidden"
                />
            </label>

            {/* Upload Progress */}
            {showProgress && uploadProgress.length > 0 && (
                <div className="w-full space-y-4 bg-white/60 backdrop-blur-md rounded-xl p-4 shadow-sm border border-gray-100 transition-all duration-500 ease-in-out">
                    {uploadProgress.map((progress, index) => (
                        <div key={index} className="w-full group">
                            <div className="flex justify-between items-center mb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className={`
                                        w-2 h-2 rounded-full
                                        ${progress.error
                                            ? 'bg-red-400 animate-pulse'
                                            : progress.progress === 100
                                                ? 'bg-green-400'
                                                : 'bg-blue-400 animate-pulse'
                                        }
                                    `} />
                                    <span className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                                        {progress.fileName}
                                    </span>
                                </div>
                                <span className="text-sm font-medium text-gray-500 tabular-nums min-w-[3rem] text-right">
                                    {progress.progress}%
                                </span>
                            </div>
                            <div className="w-full h-1 bg-gray-100/80 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${progress.error
                                        ? 'bg-gradient-to-r from-red-400 to-red-500'
                                        : progress.progress === 100
                                            ? 'bg-gradient-to-r from-green-400 to-green-500'
                                            : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                        }`}
                                    style={{
                                        width: `${progress.progress}%`,
                                        transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}
                                />
                            </div>
                            {progress.error && (
                                <p className="text-red-500 text-xs mt-2 font-medium flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {progress.error}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
