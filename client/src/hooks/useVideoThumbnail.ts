import { useState, useEffect, useRef } from 'react'
import { generateVideoThumbnail } from '@/lib/thumbnailGenerator'

interface ThumbnailCache {
  [key: string]: string // assetId -> thumbnail data URL
}

const thumbnailCache: ThumbnailCache = {}

export function useVideoThumbnail(assetId: string | undefined, videoUrl: string | undefined, isVideo: boolean) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const generateRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!isVideo || !assetId || !videoUrl) {
      setThumbnailUrl(null)
      return
    }

    // Check cache first
    if (thumbnailCache[assetId]) {
      setThumbnailUrl(thumbnailCache[assetId])
      return
    }

    // Cancel any ongoing generation
    if (generateRef.current) {
      generateRef.current.abort()
    }

    const controller = new AbortController()
    generateRef.current = controller

    const generateThumbnail = async () => {
      if (controller.signal.aborted) return

      setIsGenerating(true)
      
      try {
        const thumbnailBlob = await generateVideoThumbnail(videoUrl, {
          width: 160,
          height: 90,
          captureTime: 0.5,
          quality: 0.7
        })

        if (controller.signal.aborted) return

        // Convert blob to data URL for immediate use
        const reader = new FileReader()
        reader.onload = () => {
          if (controller.signal.aborted) return
          
          const dataUrl = reader.result as string
          thumbnailCache[assetId] = dataUrl
          setThumbnailUrl(dataUrl)
          setIsGenerating(false)
        }
        reader.readAsDataURL(thumbnailBlob)

      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Failed to generate thumbnail for', assetId, error)
          setIsGenerating(false)
        }
      }
    }

    generateThumbnail()

    return () => {
      controller.abort()
    }
  }, [assetId, videoUrl, isVideo])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (generateRef.current) {
        generateRef.current.abort()
      }
    }
  }, [])

  return { thumbnailUrl, isGenerating }
} 