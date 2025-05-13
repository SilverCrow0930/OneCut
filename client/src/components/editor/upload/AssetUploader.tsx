import React, { useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Upload } from 'lucide-react'

export default function AssetUploader({ onUpload }: { onUpload: () => void }) {
    const { session } = useAuth()
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState<boolean>(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]

        if (!file) {
            return setError('No file selected')
        }

        if (!session?.access_token) {
            return setError('Not signed in')
        }

        setUploading(true)
        setError(null)

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

            // success!
            onUpload()
        }
        catch (err: any) {
            console.error('Asset upload error:', err)
            setError(err.message)
        }
        finally {
            setUploading(false)
            if (inputRef.current) {
                inputRef.current.value = ''
            }
        }
    }

    return (
        <div className="flex flex-col w-full gap-2">
            <div
                className={`
                    relative flex flex-col w-full min-h-64 items-center justify-center
                    p-2 rounded-xl gap-2
                    border-0 transition-colors duration-500 
                    ${isDragging ?
                        'border-blue-500 bg-gray-100' :
                        'border-gray-400 bg-gray-200'
                    }
                `}
            >
                <label className="
                    flex flex-row gap-2 items-center text-white 
                    px-5 py-2 rounded-2xl
                    bg-blue-200 hover:bg-blue-500 duration-500
                    cursor-pointer
                ">
                    <Upload className='w-4 h-4 mb-[2px]' />
                    {uploading ? 'Uploading…' : 'Upload'}
                    <input
                        type="file"
                        accept="image/*, video/*, audio/*"
                        ref={inputRef}
                        onChange={handleUpload}
                        disabled={uploading}
                        className="hidden"
                    />
                </label>
                <p className="text-gray-900 text-sm">
                    or drag here
                </p>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
    )
}
