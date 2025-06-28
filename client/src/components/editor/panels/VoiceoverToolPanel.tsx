import React, { useState, useEffect, useMemo } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'
import { 
    Mic, RefreshCw, Play, Volume2, Clock, 
    FileText, Wand2, Globe,
    Sparkles, Copy
} from 'lucide-react'
import PanelHeader from './PanelHeader'
import { apiPath } from '@/lib/config'

interface Voice {
    id: string
    name: string
    category: string
    description: string
    previewUrl: string
    labels: Record<string, string>
    settings: {
        stability: number
        similarity_boost: number
        style: number
        use_speaker_boost: boolean
    }
}

interface VoiceSettings {
    stability: number
    similarity_boost: number
    style: number
    use_speaker_boost: boolean
    speed: number
    pitch: number
}

const SCRIPT_TEMPLATES = [
    {
        name: "Product Demo",
        content: "Introducing our latest innovation that will transform the way you work. Experience the power of cutting-edge technology designed with you in mind.",
        tags: ["professional", "exciting"]
    },
    {
        name: "Educational Content",
        content: "In today's lesson, we'll explore an important concept that will help you understand the fundamentals and apply them in real-world scenarios.",
        tags: ["clear", "informative"]
    },
    {
        name: "Social Media Ad",
        content: "Ready to level up your game? Don't miss out on this amazing opportunity. Join thousands of satisfied customers today!",
        tags: ["energetic", "persuasive"]
    },
    {
        name: "Podcast Intro",
        content: "Welcome back to another episode where we dive deep into topics that matter most to you. I'm your host, and today we have something special.",
        tags: ["warm", "conversational"]
    },
    {
        name: "News Report",
        content: "Breaking news this hour as developments continue to unfold. We'll bring you the latest updates and expert analysis on this important story.",
        tags: ["authoritative", "clear"]
    }
]

const VoiceoverToolPanel = () => {
    const [script, setScript] = useState('')
    const [voices, setVoices] = useState<Voice[]>([])
    const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null)
    const [isLoadingVoices, setIsLoadingVoices] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    
    // UI State
    const [showTemplates, setShowTemplates] = useState(false)
    const [activeTab, setActiveTab] = useState<'all' | 'recent'>('all')
    
    // Voice management
    const [recentVoices, setRecentVoices] = useState<string[]>([])
    
    // Voice settings
    const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true,
        speed: 1.0,
        pitch: 1.0
    })

    const { tracks, executeCommand } = useEditor()
    const { session } = useAuth()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

    // Load voices and user preferences on mount
    useEffect(() => {
        loadVoices()
        loadUserPreferences()
    }, [])

    // Get voices for different tabs
    const getTabVoices = () => {
        switch (activeTab) {
            case 'recent':
                return recentVoices.map(id => voices.find(v => v.id === id)).filter(Boolean) as Voice[]
            default:
                return voices
        }
    }

    const loadVoices = async () => {
        if (!session?.access_token) return

        setIsLoadingVoices(true)
        setError(null)

        try {
            console.log('🔍 Loading voices from API...')
            console.log('API URL:', apiPath('voiceover/voices'))
            
            const response = await fetch(apiPath('voiceover/voices'), {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })

            console.log('📡 Response status:', response.status)
            console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))

            if (!response.ok) {
                const errorText = await response.text()
                console.error('❌ API Error Response:', errorText)
                throw new Error(`API Error (${response.status}): ${errorText}`)
            }

            const responseText = await response.text()
            console.log('📄 Raw response:', responseText.substring(0, 200) + '...')

            const data = JSON.parse(responseText)
            console.log('✅ Parsed data:', data)
            
            setVoices(data.voices || [])
            
            // Select first high-quality voice by default
            if (data.voices && data.voices.length > 0) {
                const defaultVoice = data.voices.find((v: Voice) => v.category === 'premade') || data.voices[0]
                setSelectedVoice(defaultVoice)
                setVoiceSettings(prev => ({ ...prev, ...defaultVoice.settings }))
                console.log('🎯 Selected default voice:', defaultVoice.name)
            }
        } catch (error: any) {
            console.error('❌ Failed to load voices:', error)
            if (error.message.includes('<!DOCTYPE')) {
                setError('API endpoint not found. Please check if the server is running and voiceover routes are registered.')
            } else {
                setError(error.message || 'Failed to load voices')
            }
        } finally {
            setIsLoadingVoices(false)
        }
    }

    const loadUserPreferences = () => {
        // Load from localStorage
        const saved = localStorage.getItem('voiceover-preferences')
        if (saved) {
            try {
                const prefs = JSON.parse(saved)
                setRecentVoices(prefs.recent || [])
            } catch (e) {
                console.error('Failed to load preferences:', e)
            }
        }
    }

    const saveUserPreferences = () => {
        const prefs = {
            recent: recentVoices
        }
        localStorage.setItem('voiceover-preferences', JSON.stringify(prefs))
    }

    const handleVoiceSelect = (voice: Voice) => {
        setSelectedVoice(voice)
        setVoiceSettings(prev => ({ ...prev, ...voice.settings }))
        
        // Add to recent voices
        const newRecent = [voice.id, ...recentVoices.filter(id => id !== voice.id)].slice(0, 8)
        setRecentVoices(newRecent)
        saveUserPreferences()
    }

    const playVoicePreview = async (voice: Voice) => {
        if (voice.previewUrl) {
            const audio = new Audio(voice.previewUrl)
            audio.play().catch(error => {
                console.error('Failed to play preview:', error)
            })
        }
    }

    const applyTemplate = (template: typeof SCRIPT_TEMPLATES[0]) => {
        setScript(template.content)
        setShowTemplates(false)
    }

    const enhanceScript = async () => {
        if (!script.trim()) return
        
        // TODO: Implement AI script enhancement
        setSuccessMessage('🧠 AI script enhancement coming soon!')
        setTimeout(() => setSuccessMessage(null), 3000)
    }

    const generateVoiceover = async () => {
        if (!script.trim() || !selectedVoice || !session?.access_token) {
            setError('Please enter script text and select a voice')
            return
        }

        setIsGenerating(true)
        setError(null)
        setSuccessMessage(null)

        try {
            console.log('=== VOICEOVER GENERATION STARTED ===')
            console.log('Script:', script)
            console.log('Voice:', selectedVoice.name)
            console.log('Settings:', voiceSettings)

            const response = await fetch(apiPath('voiceover/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    text: script.trim(),
                    voiceId: selectedVoice.id,
                    settings: voiceSettings
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to generate voiceover')
            }

            const result = await response.json()
            console.log('✅ Voiceover generated:', result)

            // Add generated audio to timeline
            await addAudioToTimeline(result.assetId, result.name)

            setSuccessMessage(`🎉 Voiceover generated with ${selectedVoice.name}!`)
            setTimeout(() => setSuccessMessage(null), 5000)

        } catch (error: any) {
            console.error('❌ Voiceover generation failed:', error)
            setError(error.message || 'Failed to generate voiceover')
        } finally {
            setIsGenerating(false)
        }
    }

    const addAudioToTimeline = async (assetId: string, name: string) => {
        const newTrack = {
            id: uuid(),
            projectId: projectId!,
            index: 0,
            type: 'audio' as TrackType,
            createdAt: new Date().toISOString(),
        }

        const estimatedDuration = Math.max(3, script.trim().split(' ').length * 0.6 / voiceSettings.speed)
        const durationMs = estimatedDuration * 1000

        const audioClip = {
            id: uuid(),
            trackId: newTrack.id,
            type: 'audio' as const,
            assetId: assetId,
            sourceStartMs: 0,
            sourceEndMs: durationMs,
            timelineStartMs: 0,
            timelineEndMs: durationMs,
            assetDurationMs: durationMs,
            volume: 1,
            speed: voiceSettings.speed,
            properties: { name },
            createdAt: new Date().toISOString(),
        }

        const commands = [
            ...tracks.map(track => ({
                type: 'UPDATE_TRACK' as const,
                payload: {
                    before: track,
                    after: { ...track, index: track.index + 1 }
                }
            })),
            { type: 'ADD_TRACK' as const, payload: { track: newTrack } },
            { type: 'ADD_CLIP' as const, payload: { clip: audioClip } }
        ]

        executeCommand({ type: 'BATCH', payload: { commands } })
    }

    return (
        <div className="flex flex-col gap-6 p-4 bg-white rounded-lg min-h-full">
            <PanelHeader icon={Mic} title="AI Voiceover" description="Generate realistic voice narration" />
            
            <div className="space-y-6 flex-1">
                {/* Script Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">Script</label>
                        <div className="flex items-center justify-between mb-2">
                            <div></div>
                            <button
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                            >
                                <FileText className="w-4 h-4" />
                                {showTemplates ? 'Hide' : 'Show'} Templates
                            </button>
                        </div>
                    </div>
                    
                    {showTemplates && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <h6 className="text-sm font-semibold text-gray-700">Script Templates</h6>
                            <div className="mt-2 space-y-2">
                                {SCRIPT_TEMPLATES.map((template, index) => (
                                    <div key={index} className="p-2 bg-white rounded border hover:bg-blue-50 cursor-pointer"
                                         onClick={() => applyTemplate(template)}>
                                        <div className="font-medium text-sm text-gray-800">{template.name}</div>
                                        <div className="text-xs text-gray-600 mt-1">{template.content.substring(0, 80)}...</div>
                                        <div className="flex gap-1 mt-1">
                                            {template.tags.map(tag => (
                                                <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        placeholder="Enter your script here"
                        className="
                            w-full p-3 border border-gray-300 rounded-lg text-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            transition-all duration-200 placeholder:text-gray-400 resize-none"
                        rows={4}
                    />
                </div>

                {/* Voice Selection */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="block text-base font-medium text-gray-700">Voice Selection</label>
                    </div>

                    {/* Voice Tabs */}
                    <div className="flex border-b border-gray-200">
                        {[
                            { id: 'all', label: 'All Voices', count: voices.length },
                            { id: 'recent', label: 'Recent', count: recentVoices.length }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'all' | 'recent')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Voice Grid */}
                    {isLoadingVoices ? (
                        <div className="flex items-center justify-center p-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="ml-2 text-gray-600">Loading voices...</span>
                        </div>
                    ) : (
                        <div className="grid gap-3 max-h-80 overflow-y-auto elegant-scrollbar">
                            {getTabVoices().map(voice => (
                                <div
                                    key={voice.id}
                                    className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                        selectedVoice?.id === voice.id
                                            ? 'border-blue-500 bg-blue-50 shadow-md'
                                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                    }`}
                                    onClick={() => handleVoiceSelect(voice)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-gray-900">{voice.name}</div>
                                        {voice.previewUrl && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    playVoicePreview(voice)
                                                }}
                                                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                                                title="Play preview"
                                            >
                                                <Play size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            {getTabVoices().length === 0 && (
                                <div className="text-center p-8 text-gray-500">
                                    <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>
                                        {activeTab === 'recent' && 'No recent voices yet'} 
                                        {activeTab === 'all' && 'No voices available'}
                                    </p>
                                    {activeTab === 'all' && (
                                        <button
                                            onClick={loadVoices}
                                            className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                                        >
                                            Try again
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Messages */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                        <div className="mt-2 text-xs text-gray-500">
                            <strong>Debug info:</strong> Check browser console for detailed logs
                        </div>
                    </div>
                )}

                {successMessage && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-600">{successMessage}</p>
                    </div>
                )}
            </div>

            {/* Generate Button */}
            <div className="pt-4 border-t border-gray-200 bg-white">
                <button
                    onClick={generateVoiceover}
                    disabled={!script.trim() || !selectedVoice || isGenerating}
                    className={`
                        w-full px-4 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2
                        ${!script.trim() || !selectedVoice || isGenerating
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 active:scale-95'
                        }
                    `}
                >
                    {isGenerating ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <Mic className="w-4 h-4" />
                            Generate Voiceover
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

export default VoiceoverToolPanel