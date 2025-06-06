'use client'

import React from 'react'
import { useParams, usePathname, useSearchParams } from 'next/navigation'

export default function ProjectDebug() {
    const params = useParams()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    return (
        <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50 max-w-sm">
            <div className="text-yellow-400 font-bold mb-2">🐛 Debug Info</div>
            
            <div className="space-y-1">
                <div>
                    <span className="text-blue-400">pathname:</span> {pathname}
                </div>
                
                <div>
                    <span className="text-green-400">params:</span> {JSON.stringify(params, null, 2)}
                </div>
                
                <div>
                    <span className="text-purple-400">params.id:</span> {params?.id || 'undefined'}
                </div>
                
                <div>
                    <span className="text-orange-400">searchParams:</span> {searchParams?.toString() || 'none'}
                </div>
                
                <div>
                    <span className="text-cyan-400">window.location:</span> {typeof window !== 'undefined' ? window.location.href : 'SSR'}
                </div>
            </div>
        </div>
    )
} 