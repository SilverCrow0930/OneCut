/**
 * Video thumbnail generation utilities
 * Uses HTML5 Canvas to capture frames from video elements
 */

import { apiPath } from '@/lib/config'

export interface ThumbnailOptions {
    width?: number
    height?: number
    quality?: number
    captureTime?: number // seconds into the video
    format?: 'jpeg' | 'png'
}

const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
    width: 320,
    height: 180,
    quality: 0.8,
    captureTime: 1.0,
    format: 'jpeg'
}

/**
 * Get asset URL for thumbnail generation
 */
export async function getAssetUrl(assetId: string, accessToken: string): Promise<string | null> {
    try {
        const response = await fetch(apiPath(`assets/${assetId}/url`), {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        })
        
        if (!response.ok) {
            return null
        }
        
        const data = await response.json()
        return data.url
    } catch (error) {
        console.error('Failed to get asset URL:', error)
        return null
    }
}

/**
 * Generate a thumbnail from a video URL
 */
export async function generateVideoThumbnail(
    videoUrl: string, 
    options: ThumbnailOptions = {}
): Promise<Blob> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    
    return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
            reject(new Error('Canvas 2D context not available'))
            return
        }

        // Set up canvas dimensions
        canvas.width = opts.width
        canvas.height = opts.height

        // Configure video element
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.playsInline = true
        
        const cleanup = () => {
            video.removeEventListener('loadeddata', onLoadedData)
            video.removeEventListener('error', onError)
            video.removeEventListener('seeked', onSeeked)
            if (video.src && video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src)
            }
        }

        const onError = () => {
            cleanup()
            reject(new Error('Failed to load video for thumbnail generation'))
        }

        const onLoadedData = () => {
            // Seek to the desired time
            video.currentTime = Math.min(opts.captureTime, video.duration - 0.1)
        }

        const onSeeked = () => {
            try {
                // Draw video frame to canvas
                ctx.drawImage(video, 0, 0, opts.width, opts.height)
                
                // Convert canvas to blob
                canvas.toBlob(
                    (blob) => {
                        cleanup()
                        if (blob) {
                            resolve(blob)
                        } else {
                            reject(new Error('Failed to generate thumbnail blob'))
                        }
                    },
                    `image/${opts.format}`,
                    opts.quality
                )
            } catch (error) {
                cleanup()
                reject(error)
            }
        }

        // Set up event listeners
        video.addEventListener('loadeddata', onLoadedData)
        video.addEventListener('error', onError)
        video.addEventListener('seeked', onSeeked)
        
        // Start loading the video
        video.src = videoUrl
        video.load()
    })
}

/**
 * Generate thumbnail from the first video clip in a clips array
 */
export async function generateThumbnailFromClips(
    clips: Array<{ assetId?: string; type: string }>,
    accessToken: string
): Promise<Blob | null> {
    // Find first video clip
    const videoClip = clips.find(clip => 
        clip.type === 'video' && clip.assetId
    )
    
    if (!videoClip?.assetId) {
        return null
    }
    
    try {
        const videoUrl = await getAssetUrl(videoClip.assetId, accessToken)
        if (!videoUrl) {
            return null
        }
        
        return await generateVideoThumbnail(videoUrl, {
            width: 320,
            height: 180,
            captureTime: 2.0 // Capture at 2 seconds
        })
    } catch (error) {
        console.error('Failed to generate thumbnail from clips:', error)
        return null
    }
}

/**
 * Upload thumbnail blob to server and return the thumbnail URL
 */
export async function uploadThumbnail(
    thumbnailBlob: Blob,
    accessToken: string
): Promise<string> {
    const formData = new FormData()
    formData.append('file', thumbnailBlob, 'thumbnail.jpg')
    formData.append('duration', '0') // Thumbnails have no duration
    
    const response = await fetch(apiPath('assets/upload'), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`
        },
        body: formData
    })
    
    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Thumbnail upload failed: ${response.status} ${text}`)
    }
    
    const asset = await response.json()
    
    // Get the URL for the uploaded thumbnail
    const urlResponse = await fetch(apiPath(`assets/${asset.id}/url`), {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    })
    
    if (!urlResponse.ok) {
        throw new Error('Failed to get thumbnail URL')
    }
    
    const { url } = await urlResponse.json()
    return url
}

/**
 * Generate and upload project thumbnail, then update project
 */
export async function generateAndUpdateProjectThumbnail(
    projectId: string,
    clips: Array<{ assetId?: string; type: string }>,
    accessToken: string,
    updateProjectThumbnail: (thumbnailUrl: string) => Promise<void>
): Promise<string | null> {
    try {
        console.log('🖼️ Generating project thumbnail...')
        
        const thumbnailBlob = await generateThumbnailFromClips(clips, accessToken)
        if (!thumbnailBlob) {
            console.log('No video clips found for thumbnail generation')
            return null
        }
        
        console.log('📤 Uploading thumbnail...')
        const thumbnailUrl = await uploadThumbnail(thumbnailBlob, accessToken)
        
        console.log('💾 Updating project with thumbnail URL...')
        await updateProjectThumbnail(thumbnailUrl)
        
        console.log('✅ Project thumbnail updated successfully')
        return thumbnailUrl
    } catch (error) {
        console.error('❌ Failed to generate and update project thumbnail:', error)
        throw error
    }
} 