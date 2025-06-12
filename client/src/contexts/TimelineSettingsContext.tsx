import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { TimelineSettings, defaultTimelineSettings } from '@/lib/editor/timelineUtils'

interface TimelineSettingsContextType {
    settings: TimelineSettings
    updateSettings: (newSettings: Partial<TimelineSettings>) => void
    resetSettings: () => void
    toggleSetting: (key: keyof TimelineSettings) => void
}

const TimelineSettingsContext = createContext<TimelineSettingsContextType | undefined>(undefined)

interface TimelineSettingsProviderProps {
    children: ReactNode
}

export function TimelineSettingsProvider({ children }: TimelineSettingsProviderProps) {
    const [settings, setSettings] = useState<TimelineSettings>(defaultTimelineSettings)

    // Load settings from localStorage on mount
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('timeline-settings')
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings)
                setSettings({ ...defaultTimelineSettings, ...parsed })
            }
        } catch (error) {
            console.warn('Failed to load timeline settings from localStorage:', error)
        }
    }, [])

    // Save settings to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem('timeline-settings', JSON.stringify(settings))
        } catch (error) {
            console.warn('Failed to save timeline settings to localStorage:', error)
        }
    }, [settings])

    const updateSettings = (newSettings: Partial<TimelineSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }))
    }

    const resetSettings = () => {
        setSettings(defaultTimelineSettings)
    }

    const toggleSetting = (key: keyof TimelineSettings) => {
        setSettings(prev => ({
            ...prev,
            [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key]
        }))
    }

    return (
        <TimelineSettingsContext.Provider value={{
            settings,
            updateSettings,
            resetSettings,
            toggleSetting
        }}>
            {children}
        </TimelineSettingsContext.Provider>
    )
}

export function useTimelineSettings() {
    const context = useContext(TimelineSettingsContext)
    if (context === undefined) {
        throw new Error('useTimelineSettings must be used within a TimelineSettingsProvider')
    }
    return context
} 