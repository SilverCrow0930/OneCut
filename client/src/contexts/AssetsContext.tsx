'use client'

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'

export interface Asset {
    id: string
    name: string
    mime_type: string
    duration: number | null
    created_at: string
    last_used: string | null
}

const AssetsContext = createContext<{
    assets: Asset[]
    loading: boolean
    error: string | null
    refresh: () => void
    deleteAsset: (id: string) => Promise<void>
    addAsset: (asset: Asset) => void
    updateAsset: (id: string, updates: Partial<Asset>) => void
} | undefined>(undefined)

export function useAssets() {
    const context = useContext(AssetsContext)
    if (!context) {
        throw new Error('useAssets must be within AssetsProvider')
    }
    return context
}

export function AssetsProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth()
    const [assets, setAssets] = useState<Asset[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        if (!session?.access_token) return
        setLoading(true)
        setError(null)
        try {
            const response = await fetch(apiPath('assets'), {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            })
            if (!response.ok) {
                throw new Error(await response.text())
            }
            setAssets(await response.json())
        }
        catch (err: any) {
            setError(err.message)
        }
        finally {
            setLoading(false)
        }
    }, [session?.access_token])

    // Optimistic asset addition
    const addAsset = useCallback((asset: Asset) => {
        setAssets(prev => [asset, ...prev])
    }, [])

    // Optimistic asset update
    const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
        setAssets(prev => prev.map(asset => 
            asset.id === id ? { ...asset, ...updates } : asset
        ))
    }, [])

    // Optimistic asset deletion
    const deleteAsset = useCallback(async (id: string) => {
        if (!session?.access_token) return
        
        // Optimistically remove from UI immediately
        const originalAssets = assets
        setAssets(prev => prev.filter(asset => asset.id !== id))
        
        try {
            const response = await fetch(apiPath(`assets/${id}`), {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            })
            if (!response.ok) {
                throw new Error(await response.text())
            }
            // Success - deletion already reflected in UI
        }
        catch (err: any) {
            // Rollback on error
            setAssets(originalAssets)
            setError(err.message)
        }
    }, [session, assets])

    useEffect(() => {
        refresh()
    }, [refresh])

    return (
        <AssetsContext.Provider value={{ 
            assets, 
            loading, 
            error, 
            refresh, 
            deleteAsset, 
            addAsset, 
            updateAsset 
        }}>
            {children}
        </AssetsContext.Provider>
    )
}
