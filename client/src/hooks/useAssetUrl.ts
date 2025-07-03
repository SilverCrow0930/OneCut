'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'

// Cache interface
interface CacheEntry {
    url: string
    timestamp: number
    expiresAt: number
}

// Cache duration (1 hour in milliseconds)
const CACHE_DURATION = 60 * 60 * 1000

// In-memory cache
const memoryCache = new Map<string, CacheEntry>()

// Initialize IndexedDB
const initDB = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('assetCache', 1)

        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains('assets')) {
                db.createObjectStore('assets', { keyPath: 'id' })
            }
        }
    })
}

// Get from cache (memory or IndexedDB)
const getFromCache = async (assetId: string): Promise<string | null> => {
    // Check memory cache first
    const memoryEntry = memoryCache.get(assetId)
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
        return memoryEntry.url
    }

    try {
        const db = await initDB()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['assets'], 'readonly')
            const store = transaction.objectStore('assets')
            const request = store.get(assetId)

            request.onsuccess = () => {
                const entry = request.result as CacheEntry
                if (entry && entry.expiresAt > Date.now()) {
                    // Update memory cache
                    memoryCache.set(assetId, entry)
                    resolve(entry.url)
                } else {
                    resolve(null)
                }
            }
            request.onerror = () => reject(request.error)
        })
    } catch (error) {
        console.error('Cache error:', error)
        return null
    }
}

// Save to cache (memory and IndexedDB)
const saveToCache = async (assetId: string, url: string) => {
    const entry: CacheEntry = {
        url,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_DURATION
    }

    // Update memory cache
    memoryCache.set(assetId, entry)

    try {
        const db = await initDB()
        const transaction = db.transaction(['assets'], 'readwrite')
        const store = transaction.objectStore('assets')
        await store.put({ id: assetId, ...entry })
    } catch (error) {
        console.error('Cache save error:', error)
    }
}

export function useAssetUrl(assetId?: string) {
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const { session } = useAuth()

    useEffect(() => {
        if (!assetId) {
            setUrl(null)
            setLoading(false)
            return
        }

        // Skip fetching for missing assets
        if (assetId.startsWith('missing_')) {
            console.log(`[useAssetUrl] Skipping missing asset: ${assetId}`)
            setUrl(null)
            setLoading(false)
            return
        }

        const fetchUrl = async () => {
            try {
                // Check cache first
                const cachedUrl = await getFromCache(assetId)
                if (cachedUrl) {
                    setUrl(cachedUrl)
                    setLoading(false)
                    return
                }

                const response = await fetch(apiPath(`assets/${assetId}/url`), {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                })
                
                if (!response.ok) {
                    // Don't spam console with the same error
                    const cached = memoryCache.get(assetId)
                    if (!cached || (Date.now() - cached.timestamp) > 30000) { // Log once per 30 seconds
                        console.error(`[useAssetUrl] Asset ${assetId} not found (${response.status})`)
                    }
                    setUrl(null)
                    setLoading(false)
                    return
                }
                
                const data = await response.json()
                const assetUrl = data.url
                
                if (assetUrl) {
                    await saveToCache(assetId, assetUrl)
                }
                
                setUrl(assetUrl)
            } catch (error) {
                // Don't spam console with the same error
                const cached = memoryCache.get(assetId)
                if (!cached || (Date.now() - cached.timestamp) > 30000) { // Log once per 30 seconds
                    console.error(`[useAssetUrl] Error fetching asset URL for ${assetId}:`, error)
                }
                setUrl(null)
            } finally {
                setLoading(false)
            }
        }

        setLoading(true)
        fetchUrl()
    }, [assetId, session?.access_token])

    return { url, loading }
}
