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

export function useAssetUrl(assetId: string) {
    const { session } = useAuth()
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!session?.access_token) {
            return
        }

        let cancelled = false

        const fetchUrl = async () => {
            try {
                // Try to get from cache first
                const cachedUrl = await getFromCache(assetId)
                if (cachedUrl && !cancelled) {
                    setUrl(cachedUrl)
                    setLoading(false)
                    return
                }

                // If not in cache, fetch from server
                const response = await fetch(apiPath(`assets/${assetId}/url`), {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                })

                if (!response.ok) {
                    throw new Error(await response.text())
                }

                const { url } = await response.json() as { url: string }

                if (!cancelled) {
                    setUrl(url)
                    // Save to cache
                    await saveToCache(assetId, url)
                }
            }
            catch (error: any) {
                if (!cancelled) {
                    setError(error.message)
                }
            }
            finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        setLoading(true)
        fetchUrl()

        return () => {
            cancelled = true
        }
    }, [assetId, session])

    return { url, loading, error }
}
