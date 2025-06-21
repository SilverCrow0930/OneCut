"use client"

import React from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { SmartCutProvider } from '@/contexts/SmartCutContext'

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SmartCutProvider>
                {children}
            </SmartCutProvider>
        </AuthProvider>
    )
}