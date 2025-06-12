'use client'

import { ReactNode } from 'react'
import { EditorProvider } from '@/contexts/EditorContext'
import { AssetsProvider } from '@/contexts/AssetsContext'
import { PlaybackProvider } from '@/contexts/PlaybackContext'
import { ZoomProvider } from '@/contexts/ZoomContext'
import { TimelineSettingsProvider } from '@/contexts/TimelineSettingsContext'

import { AudioProvider } from '@/contexts/AudioContext'

interface LayoutProps {
    children: ReactNode
}

export default function ProjectLayout({ children }: LayoutProps) {
    return (
            <EditorProvider>
                <AssetsProvider>
                    <AudioProvider>
                        <PlaybackProvider>
                            <ZoomProvider>
                                <TimelineSettingsProvider>
                                    {children}
                                </TimelineSettingsProvider>
                            </ZoomProvider>
                        </PlaybackProvider>
                    </AudioProvider>
                </AssetsProvider>
            </EditorProvider>
    )
}
