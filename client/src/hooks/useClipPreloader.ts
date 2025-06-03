import { useEffect, useRef, useMemo } from 'react'
import { usePlayback } from '@/contexts/PlaybackContext'
import type { Clip } from '@/types/editor'

interface PreloadedMedia {
    clipId: string
    element: HTMLVideoElement | HTMLImageElement | HTMLAudioElement
    url: string
    isReady: boolean
    lastUsed: number
}

interface UseClipPreloaderOptions {
    preloadWindowMs?: number  // How far ahead to preload (default: 5 seconds)
    maxPreloadedItems?: number  // Maximum items to keep in memory (default: 10)
    cleanupIntervalMs?: number  // How often to cleanup old items (default: 10 seconds)
}

const preloadedMediaMap = new Map<string, PreloadedMedia>()
let cleanupInterval: NodeJS.Timeout | null = null

// Helper function to get asset URL with better error handling
async function getAssetUrl(assetId: string): Promise<string | null> {
    try {
        // Validate asset ID format
        if (!assetId || assetId.length < 10) {
            console.warn('Invalid asset ID format:', assetId)
            return null
        }

        console.log('🔍 Fetching asset URL for:', assetId)
        const response = await fetch(`/api/v1/assets/${assetId}/url`)
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`📭 Asset not found (404): ${assetId}`)
                return null
            }
            console.warn(`⚠️ Asset URL fetch failed (${response.status}): ${assetId}`)
            return null
        }
        
        const data = await response.json()
        console.log('✅ Asset URL fetched successfully:', assetId, '→', data.url ? 'URL received' : 'No URL in response')
        return data.url || null
    } catch (error) {
        console.warn('❌ Failed to fetch asset URL:', assetId, error)
        return null
    }
}

export function useClipPreloader(
    clips: Clip[], 
    options: UseClipPreloaderOptions = {}
) {
    const { currentTime, isPlaying } = usePlayback()
    const currentTimeMs = currentTime * 1000
    
    const {
        preloadWindowMs = 5000,    // 5 seconds ahead
        maxPreloadedItems = 10,    // Keep max 10 items
        cleanupIntervalMs = 10000  // Cleanup every 10 seconds
    } = options

    const lastCleanupRef = useRef<number>(0)

    // Identify clips that should be preloaded with better validation
    const clipsToPreload = useMemo(() => {
        const candidateClips = clips.filter(clip => {
            // Basic validation
            if (!clip || !clip.id) {
                return false
            }

            // Only preload media clips (including stickers which are image type)
            if (!['video', 'image', 'audio'].includes(clip.type)) {
                return false
            }

            // For external assets (like stickers), we need the external asset URL
            // For regular assets, we need an assetId
            const hasExternalAsset = clip.properties?.externalAsset?.url
            const hasRegularAsset = clip.assetId

            if (!hasExternalAsset && !hasRegularAsset) {
                return false
            }

            // Check timeline positioning
            const timeUntilClip = clip.timelineStartMs - currentTimeMs
            const clipHasPassed = clip.timelineEndMs < currentTimeMs

            // Preload clips that will start within the window and haven't passed yet
            const shouldPreload = timeUntilClip > 0 && 
                                timeUntilClip <= preloadWindowMs && 
                                !clipHasPassed

            if (shouldPreload) {
                const assetType = hasExternalAsset ? 'external' : 'regular'
                console.log(`📋 Clip queued for preload: ${clip.id} (${clip.type}, ${assetType}) - starts in ${Math.round(timeUntilClip / 1000)}s`)
            }

            return shouldPreload
        })

        // Sort by timeline start time (earliest first) and limit total items
        return candidateClips
            .sort((a, b) => a.timelineStartMs - b.timelineStartMs)
            .slice(0, maxPreloadedItems)
    }, [clips, currentTimeMs, preloadWindowMs, maxPreloadedItems])

    // Create preload elements for upcoming clips
    useEffect(() => {
        let isEffectActive = true; // Track if this effect is still active

        const preloadClips = async () => {
            for (const clip of clipsToPreload) {
                if (!isEffectActive || preloadedMediaMap.has(clip.id)) {
                    continue // Skip if effect is no longer active or already preloading
                }

                try {
                    // Check if it's an external asset first
                    const externalAsset = clip.properties?.externalAsset
                    let url: string | null = null

                    if (externalAsset?.url) {
                        url = externalAsset.url
                        console.log(`📍 Using external asset URL for clip ${clip.id} (${externalAsset.isExternal ? 'sticker/external' : 'external'})`)
                    } else if (clip.assetId) {
                        // Get the asset URL from the API with error handling
                        url = await getAssetUrl(clip.assetId)
                        if (!url) {
                            console.warn(`⚠️ Skipping clip ${clip.id} - no valid asset URL available`)
                            continue
                        }
                    } else {
                        console.warn(`⚠️ Skipping clip ${clip.id} - no asset ID or external asset URL`)
                        continue
                    }

                    if (!isEffectActive || !url) continue // Check again after async operation

                    let element: HTMLVideoElement | HTMLImageElement | HTMLAudioElement

                    // Create appropriate media element based on clip type
                    switch (clip.type) {
                        case 'video': {
                            const videoElement = document.createElement('video')
                            videoElement.preload = 'metadata'
                            videoElement.playsInline = true
                            videoElement.muted = true // Preload muted to avoid autoplay issues
                            videoElement.crossOrigin = 'anonymous' // Handle CORS if needed
                            element = videoElement
                            break
                        }
                        case 'audio': {
                            const audioElement = document.createElement('audio')
                            audioElement.preload = 'metadata'
                            audioElement.crossOrigin = 'anonymous'
                            element = audioElement
                            break
                        }
                        case 'image': {
                            const imgElement = document.createElement('img')
                            imgElement.crossOrigin = 'anonymous'
                            element = imgElement
                            break
                        }
                        default:
                            continue
                    }

                    if (!isEffectActive) continue; // Final check before creating preloaded media

                    // Store the preloaded media
                    const preloadedMedia: PreloadedMedia = {
                        clipId: clip.id,
                        element,
                        url,
                        isReady: false,
                        lastUsed: Date.now()
                    }

                    preloadedMediaMap.set(clip.id, preloadedMedia)

                    // Set up load event listeners
                    const onLoad = () => {
                        if (isEffectActive && preloadedMediaMap.has(clip.id)) {
                            preloadedMedia.isReady = true
                            console.log(`🚀 Preloaded ${clip.type} clip:`, clip.id, `(${Math.round((clip.timelineStartMs - currentTimeMs) / 1000)}s ahead)`)
                        }
                    }

                    const onError = (error: any) => {
                        console.warn(`⚠️ Failed to preload clip ${clip.id} (${clip.type}):`, error?.message || error)
                        if (preloadedMediaMap.has(clip.id)) {
                            preloadedMediaMap.delete(clip.id)
                        }
                    }

                    if (element instanceof HTMLImageElement) {
                        element.onload = onLoad
                        element.onerror = onError
                    } else {
                        element.addEventListener('loadedmetadata', onLoad)
                        element.addEventListener('error', onError)
                    }

                    // Start loading
                    element.src = url

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    console.warn(`❌ Failed to preload clip ${clip.id} (${clip.type}):`, {
                        error: errorMessage,
                        assetId: clip.assetId,
                        hasExternalAsset: !!clip.properties?.externalAsset
                    })
                }
            }
        }

        preloadClips()

        return () => {
            isEffectActive = false; // Mark this effect as inactive
        }
    }, [clipsToPreload, currentTimeMs])

    // Cleanup old preloaded items periodically
    useEffect(() => {
        const now = Date.now()
        
        if (now - lastCleanupRef.current > cleanupIntervalMs) {
            lastCleanupRef.current = now
            
            // Remove items that haven't been used recently or are no longer needed
            const itemsToRemove: string[] = []
            
            preloadedMediaMap.forEach((media, clipId) => {
                const timeSinceLastUse = now - media.lastUsed
                const clip = clips.find(c => c.id === clipId)
                
                // Remove if:
                // 1. Item is older than 30 seconds
                // 2. Clip no longer exists
                // 3. Clip has already passed (with 2s buffer)
                const shouldRemove = timeSinceLastUse > 30000 || 
                                   !clip || 
                                   (clip.timelineEndMs < currentTimeMs - 2000)
                
                if (shouldRemove) {
                    itemsToRemove.push(clipId)
                }
            })

            // Clean up memory
            itemsToRemove.forEach(clipId => {
                const media = preloadedMediaMap.get(clipId)
                if (media) {
                    // Clean up element
                    if (media.element instanceof HTMLVideoElement || 
                        media.element instanceof HTMLAudioElement) {
                        media.element.pause()
                        media.element.src = ''
                        media.element.load() // Reset the element
                    }
                    preloadedMediaMap.delete(clipId)
                    console.log(`🧹 Cleaned up preloaded clip:`, clipId)
                }
            })

            // Enforce max items limit
            if (preloadedMediaMap.size > maxPreloadedItems) {
                const sortedItems = Array.from(preloadedMediaMap.entries())
                    .sort(([,a], [,b]) => a.lastUsed - b.lastUsed)
                
                const itemsToRemoveCount = preloadedMediaMap.size - maxPreloadedItems
                for (let i = 0; i < itemsToRemoveCount; i++) {
                    const [clipId, media] = sortedItems[i]
                    if (media.element instanceof HTMLVideoElement || 
                        media.element instanceof HTMLAudioElement) {
                        media.element.pause()
                        media.element.src = ''
                        media.element.load()
                    }
                    preloadedMediaMap.delete(clipId)
                }
            }
        }
    }, [currentTimeMs, cleanupIntervalMs, maxPreloadedItems, clips])

    // Return function to get preloaded media for a clip
    const getPreloadedMedia = (clipId: string): PreloadedMedia | null => {
        const media = preloadedMediaMap.get(clipId)
        if (media) {
            media.lastUsed = Date.now() // Update last used time
            return media
        }
        return null
    }

    // Return stats for debugging
    const getPreloadStats = () => ({
        totalPreloaded: preloadedMediaMap.size,
        readyCount: Array.from(preloadedMediaMap.values()).filter(m => m.isReady).length,
        clipsInQueue: clipsToPreload.length,
        memoryUsage: `${preloadedMediaMap.size}/${maxPreloadedItems}`,
        nextClipIn: clipsToPreload.length > 0 
            ? Math.round((clipsToPreload[0].timelineStartMs - currentTimeMs) / 1000) 
            : null
    })

    return {
        getPreloadedMedia,
        getPreloadStats,
        clipsToPreload: clipsToPreload.map(c => c.id) // For debugging
    }
}

// Global cleanup function
export function cleanupAllPreloadedMedia() {
    preloadedMediaMap.forEach((media, clipId) => {
        if (media.element instanceof HTMLVideoElement || 
            media.element instanceof HTMLAudioElement) {
            media.element.pause()
            media.element.src = ''
            media.element.load()
        }
    })
    preloadedMediaMap.clear()
    
    if (cleanupInterval) {
        clearInterval(cleanupInterval)
        cleanupInterval = null
    }
} 