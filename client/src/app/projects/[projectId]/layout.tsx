'use client'

import { ReactNode } from 'react'
import { EditorProvider } from '@/contexts/EditorContext'
import { AssetsProvider } from '@/contexts/AssetsContext'
import { PlaybackProvider } from '@/contexts/PlaybackContext'
import { ZoomProvider } from '@/contexts/ZoomContext'

interface LayoutProps {
    children: ReactNode
}

export default function ProjectLayout({ children }: LayoutProps) {
    return (
        <PlaybackProvider>
            <EditorProvider>
                <AssetsProvider>
                    <ZoomProvider>
                        {children}
                    </ZoomProvider>
                </AssetsProvider>
            </EditorProvider>
        </PlaybackProvider>
    )
}
