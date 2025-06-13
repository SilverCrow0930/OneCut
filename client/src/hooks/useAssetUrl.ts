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

    // Skip IndexedDB if not supported or if it's causing issues
    if (typeof window === 'undefined' || !window.indexedDB) {
        return null
    }

    try {
        const db = await initDB()
        return new Promise((resolve) => {
            try {
                const transaction = db.transaction(['assets'], 'readonly')
                const store = transaction.objectStore('assets')
                const request = store.get(assetId)

                request.onsuccess = () => {
                    try {
                        const entry = request.result as CacheEntry
                        if (entry && entry.expiresAt > Date.now()) {
                            // Update memory cache
                            memoryCache.set(assetId, entry)
                            resolve(entry.url)
                        } else {
                            resolve(null)
                        }
                    } catch (error) {
                        console.warn('Cache read error:', error)
                        resolve(null)
                    }
                }
                request.onerror = () => {
                    console.warn('IndexedDB read error for asset:', assetId)
                    resolve(null)
                }
            } catch (error) {
                console.warn('Transaction error:', error)
                resolve(null)
            }
        })
    } catch (error) {
        console.warn('IndexedDB cache error:', error)
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

    // Always update memory cache
    memoryCache.set(assetId, entry)

    // Skip IndexedDB if not supported or if it's causing issues
    if (typeof window === 'undefined' || !window.indexedDB) {
        return
    }

    try {
        const db = await initDB()
        const transaction = db.transaction(['assets'], 'readwrite')
        const store = transaction.objectStore('assets')
        
        return new Promise<void>((resolve) => {
            try {
                const request = store.put({ id: assetId, ...entry })
                request.onsuccess = () => resolve()
                request.onerror = () => {
                    console.warn('IndexedDB save error for asset:', assetId)
                    resolve()
                }
            } catch (error) {
                console.warn('IndexedDB transaction error:', error)
                resolve()
            }
        })
    } catch (error) {
        console.warn('IndexedDB cache save error:', error)
    }
}

export function useAssetUrl(assetId?: string, bypassCache = false) {
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const { session } = useAuth()

    useEffect(() => {
        if (!assetId) {
            setUrl(null)
            setLoading(false)
            return
        }

        const fetchUrl = async (retryCount = 0) => {
            try {
                // Check cache first (unless bypassed)
                if (!bypassCache) {
                    const cachedUrl = await getFromCache(assetId)
                    if (cachedUrl) {
                        setUrl(cachedUrl)
                        setLoading(false)
                        return
                    }
                }

                const response = await fetch(apiPath(`assets/${assetId}/url`), {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`,
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    cache: 'no-store'
                })
                
                if (!response.ok) {
                    // Retry once for 5xx errors
                    if (response.status >= 500 && retryCount < 1) {
                        console.warn(`[useAssetUrl] Server error ${response.status}, retrying...`)
                        setTimeout(() => fetchUrl(retryCount + 1), 1000)
                        return
                    }
                    
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
                
                if (assetUrl && !bypassCache) {
                    // Validate URL before caching
                    try {
                        new URL(assetUrl)
                        await saveToCache(assetId, assetUrl)
                    } catch (urlError) {
                        console.warn('Invalid URL received:', assetUrl)
                    }
                }
                
                setUrl(assetUrl)
            } catch (error) {
                // Retry once for network errors
                if (retryCount < 1 && (error instanceof TypeError || error instanceof Error && error.message.includes('fetch'))) {
                    console.warn(`[useAssetUrl] Network error, retrying...`)
                    setTimeout(() => fetchUrl(retryCount + 1), 1000)
                    return
                }
                
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
