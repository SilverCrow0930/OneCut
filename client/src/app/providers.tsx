"use client"

import React from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { QuickClipsProvider } from '@/contexts/QuickClipsContext'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <QuickClipsProvider>
                {children}
            </QuickClipsProvider>
        </AuthProvider>
    )
}