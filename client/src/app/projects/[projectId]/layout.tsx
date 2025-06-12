'use client'

import { ReactNode } from 'react'
import { EditorProvider } from '@/contexts/EditorContext'
import { AssetsProvider } from '@/contexts/AssetsContext'
import { PlaybackProvider } from '@/contexts/PlaybackContext'
import { ZoomProvider } from '@/contexts/ZoomContext'
import { CaptionsProvider } from '@/contexts/CaptionsContext'

import { AudioProvider } from '@/contexts/AudioContext'

interface LayoutProps {
    children: ReactNode
}

export default function ProjectLayout({ children }: LayoutProps) {
    return (
            <EditorProvider>
                <AssetsProvider>
                    <CaptionsProvider>
                        <AudioProvider>
                            <PlaybackProvider>
                                <ZoomProvider>
                                    {children}
                                </ZoomProvider>
                            </PlaybackProvider>
                        </AudioProvider>
                    </CaptionsProvider>
                </AssetsProvider>
            </EditorProvider>
    )
}
