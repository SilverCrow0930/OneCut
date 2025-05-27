'use client'

import { ReactNode } from 'react'
import { EditorProvider } from '@/contexts/EditorContext'
import { AssetsProvider } from '@/contexts/AssetsContext'
import { PlaybackProvider } from '@/contexts/PlaybackContext'
import { ZoomProvider } from '@/contexts/ZoomContext'
import { AutoCutProvider } from '@/contexts/AutocutContext'

interface LayoutProps {
    children: ReactNode
}

export default function ProjectLayout({ children }: LayoutProps) {
    return (
        <AutoCutProvider>
            <EditorProvider>
                <AssetsProvider>
                    <PlaybackProvider>
                        <ZoomProvider>
                            {children}
                        </ZoomProvider>
                    </PlaybackProvider>
                </AssetsProvider>
            </EditorProvider>
        </AutoCutProvider>
    )
}
