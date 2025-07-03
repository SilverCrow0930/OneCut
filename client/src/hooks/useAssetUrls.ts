import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'

// Global cache to prevent repeated requests for the same assets
const assetUrlCache = new Map<string, { url: string | null; timestamp: number; error?: boolean }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const ERROR_RETRY_DELAY = 30 * 1000 // 30 seconds before retrying failed requests

interface AccumulatorType {
    externalAssetIds: string[]
    regularAssetIds: string[]
    missingAssetIds: string[]
}

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
            const { externalAssetIds, regularAssetIds, missingAssetIds } = stableAssetIds.reduce(
                (acc: AccumulatorType, id: string) => {
                    if (id.startsWith('external_')) {
                        acc.externalAssetIds.push(id)
                    } else if (id.startsWith('missing_')) {
                        acc.missingAssetIds.push(id)
                        console.log(`[useAssetUrls] Skipping missing asset: ${id}`)
                    } else {
                        acc.regularAssetIds.push(id)
                    }
                    return acc
                },
                { externalAssetIds: [], regularAssetIds: [], missingAssetIds: [] }
            )

            // Handle external assets and missing assets
            externalAssetIds.forEach((id: string) => {
                newUrls.set(id, null) // Will be handled by the component using clip properties
                console.log(`[useAssetUrls] Skipping external asset: ${id} (URL stored in clip properties)`)
            })

            missingAssetIds.forEach((id: string) => {
                newUrls.set(id, null) // Missing assets have no URL
                console.log(`[useAssetUrls] Skipping missing asset: ${id} (asset is missing)`)
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

            // Set initial state with cached values
            setUrls(newUrls)

            // Fetch only the IDs that aren't cached or are expired
            if (idsToFetch.length > 0) {
                console.log(`[useAssetUrls] Fetching ${idsToFetch.length} URLs:`, idsToFetch)

                try {
                    await Promise.all(
                        idsToFetch.map(async (id: string) => {
                            try {
                                const response = await fetch(apiPath(`assets/${id}/url`), {
                                    headers: {
                                        'Authorization': `Bearer ${session?.access_token}`
                                    }
                                })
                                    
                                if (!response.ok) {
                                    // Don't spam console with the same error
                                    if (!assetUrlCache.has(id) || !assetUrlCache.get(id)?.error) {
                                        const errorData = await response.json().catch(() => ({}))
                                        if (response.status === 503 && errorData?.details?.includes('billing')) {
                                            console.error(`[useAssetUrls] Storage service billing issue detected`)
                                            // Show a user-friendly error message once
                                            if (!window.localStorage.getItem('storage_billing_error_shown')) {
                                                window.localStorage.setItem('storage_billing_error_shown', 'true')
                                                window.alert('Storage service is temporarily unavailable. Our team has been notified and is working to resolve this. Please try again later.')
                                            }
                                        } else {
                                            console.error(`[useAssetUrls] Asset ${id} not found (${response.status})`, errorData)
                                        }
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

                                if (url) {
                                    assetUrlCache.set(id, {
                                        url,
                                        timestamp: now
                                    })
                                    newUrls.set(id, url)
                                }
                            } catch (error) {
                                console.error(`[useAssetUrls] Error fetching URL for ${id}:`, error)
                                newUrls.set(id, null)
                            }
                        })
                    )
                } catch (error) {
                    console.error('[useAssetUrls] Batch fetch error:', error)
                }
            }
            
            setLoading(false)
        }

        fetchUrls()
    }, [stableAssetIds, session?.access_token])

    return { urls, loading }
} 