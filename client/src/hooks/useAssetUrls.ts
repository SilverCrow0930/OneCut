import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'

export function useAssetUrls(assetIds: string[]) {
    const [urls, setUrls] = useState<Map<string, string | null>>(new Map())
    const [loading, setLoading] = useState(true)
    const { session } = useAuth()

    useEffect(() => {
        const fetchUrls = async () => {
            const newUrls = new Map<string, string | null>()
            const uniqueIds = [...new Set(assetIds)]

            try {
                await Promise.all(
                    uniqueIds.map(async (id) => {
                        try {
                            const response = await fetch(apiPath(`assets/${id}/url`), {
                                headers: {
                                    'Authorization': `Bearer ${session?.access_token}`
                                }
                            })
                            if (!response.ok) throw new Error('Failed to fetch asset URL')
                            const data = await response.json()
                            newUrls.set(id, data.url)
                        } catch (error) {
                            console.error('Error fetching asset URL:', error)
                            newUrls.set(id, null)
                        }
                    })
                )
                setUrls(newUrls)
            } catch (error) {
                console.error('Error fetching asset URLs:', error)
            } finally {
                setLoading(false)
            }
        }

        if (assetIds.length > 0) {
            fetchUrls()
        } else {
            setLoading(false)
        }
    }, [assetIds, session?.access_token])

    return { urls, loading }
} 