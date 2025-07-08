"use client"

import React from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { QuickClipsProvider } from '@/contexts/QuickClipsContext'
import { CreditsProvider } from '@/contexts/CreditsContext'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <CreditsProvider>
                <QuickClipsProvider>
                    {children}
                </QuickClipsProvider>
            </CreditsProvider>
        </AuthProvider>
    )
}