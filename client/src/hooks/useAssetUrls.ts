import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'

// Global cache to prevent repeated requests for the same assets
const assetUrlCache = new Map<string, { url: string | null; timestamp: number; error?: boolean }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const ERROR_RETRY_DELAY = 30 * 1000 // 30 seconds before retrying failed requests

export function useAssetUrls(assetIds: string[]) {
    const [urls, setUrls] = useState<Map<string, string | null>>(new Map())
    const [loading, setLoading] = useState(true)
    const { session } = useAuth()
    const previousAssetIds = useRef<string[]>([])
    
    // Memoize asset IDs to prevent unnecessary re-renders
    const stableAssetIds = useCallback(() => {
        const uniqueIds = [...new Set(assetIds)].sort()
        
        // Only update if the asset IDs actually changed
        if (JSON.stringify(uniqueIds) !== JSON.stringify(previousAssetIds.current)) {
            previousAssetIds.current = uniqueIds
        }
        
        return previousAssetIds.current
    }, [assetIds])()

    useEffect(() => {
        const fetchUrls = async () => {
            const newUrls = new Map<string, string | null>()
            const idsToFetch: string[] = []
            const now = Date.now()

            // Separate external assets from regular assets
            const { externalAssetIds, regularAssetIds } = stableAssetIds.reduce(
                (acc, id) => {
                    if (id.startsWith('external_')) {
                        acc.externalAssetIds.push(id)
                    } else {
                        acc.regularAssetIds.push(id)
                    }
                    return acc
                },
                { externalAssetIds: [] as string[], regularAssetIds: [] as string[] }
            )

            // Handle external assets - mark them as handled but don't fetch URLs
            // Their URLs are stored in clip properties, not in the assets table
            externalAssetIds.forEach(id => {
                newUrls.set(id, null) // Will be handled by the component using clip properties
                console.log(`[useAssetUrls] Skipping external asset: ${id} (URL stored in clip properties)`)
            })

            // Check cache for regular assets and determine which IDs need fetching
            for (const id of regularAssetIds) {
                const cached = assetUrlCache.get(id)
                
                if (cached) {
                    const isExpired = (now - cached.timestamp) > CACHE_DURATION
                    const isErrorExpired = cached.error && (now - cached.timestamp) > ERROR_RETRY_DELAY
                    
                    if (!isExpired && !isErrorExpired) {
                        // Use cached value
                        newUrls.set(id, cached.url)
                        continue
                    }
                }
                
                // Need to fetch this ID
                idsToFetch.push(id)
            }

            // Set initial state with cached values and external asset placeholders
            setUrls(newUrls)

            // Fetch only the regular asset IDs that aren't cached or are expired
            if (idsToFetch.length > 0) {
                console.log(`[useAssetUrls] Fetching ${idsToFetch.length} regular asset URLs:`, idsToFetch)
                
                try {
                    await Promise.all(
                        idsToFetch.map(async (id) => {
                            try {
                                const response = await fetch(apiPath(`assets/${id}/url`), {
                                    headers: {
                                        'Authorization': `Bearer ${session?.access_token}`
                                    }
                                })
                                
                                if (!response.ok) {
                                    // Log error only once per asset
                                    if (!assetUrlCache.has(id) || !assetUrlCache.get(id)?.error) {
                                        console.error(`[useAssetUrls] Asset ${id} not found (${response.status})`)
                                    }
                                    
                                    // Cache the error to prevent repeated requests
                                    assetUrlCache.set(id, { 
                                        url: null, 
                                        timestamp: now, 
                                        error: true 
                                    })
                                    newUrls.set(id, null)
                                    return
                                }
                                
                                const data = await response.json()
                                const url = data.url || null
                                
                                // Cache successful result
                                assetUrlCache.set(id, { 
                                    url, 
                                    timestamp: now, 
                                    error: false 
                                })
                                newUrls.set(id, url)
                                
                                console.log(`[useAssetUrls] Successfully fetched URL for asset: ${id}`)
                                
                            } catch (error) {
                                // Log error only once per asset
                                if (!assetUrlCache.has(id) || !assetUrlCache.get(id)?.error) {
                                    console.error(`[useAssetUrls] Network error for asset ${id}:`, error)
                                }
                                
                                // Cache the error
                                assetUrlCache.set(id, { 
                                    url: null, 
                                    timestamp: now, 
                                    error: true 
                                })
                                newUrls.set(id, null)
                            }
                        })
                    )
                    
                    setUrls(newUrls)
                } catch (error) {
                    console.error('[useAssetUrls] Batch fetch error:', error)
                }
            }
            
            setLoading(false)
        }

        if (stableAssetIds.length > 0) {
            setLoading(true)
            fetchUrls()
        } else {
            setUrls(new Map())
            setLoading(false)
        }
    }, [stableAssetIds, session?.access_token])

    return { urls, loading }
} 