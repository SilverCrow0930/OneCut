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
                    p-8 rounded-2xl gap-4 cursor-pointer group
                    border-2 transition-all duration-300 ease-in-out
                    ${isDragging ?
                        'border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100 shadow-xl scale-[1.02] shadow-blue-200/50' :
                        'border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-white hover:shadow-lg hover:shadow-blue-100/30'
                    }
                    ${uploading ? 'opacity-75 cursor-not-allowed' : 'hover:scale-[1.01]'}
                `}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Background decoration */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative flex items-center gap-4">
                    <div className={`
                        p-3 rounded-xl transition-all duration-300
                        ${isDragging ? 
                            'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 
                            'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
                        }
                    `}>
                        <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <div className={`text-xl font-semibold transition-colors duration-300 ${
                            isDragging ? 'text-blue-700' : 'text-gray-800 group-hover:text-blue-700'
                        }`}>
                            {uploading ? 'Uploading…' : 'Upload files'}
                        </div>
                        <p className={`text-sm transition-colors duration-300 mt-1 ${
                            isDragging ? 'text-blue-600' : 'text-gray-500 group-hover:text-blue-600'
                        }`}>
                            Click to browse or drag files here
                        </p>
                    </div>
                </div>
                
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 rounded-2xl opacity-5 bg-[radial-gradient(circle_at_50%_50%,_rgba(59,130,246,0.3)_0%,_transparent_50%)] pointer-events-none" />
                
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
