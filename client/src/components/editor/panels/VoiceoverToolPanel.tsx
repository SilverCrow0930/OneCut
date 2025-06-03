import React, { useState, useEffect, useMemo } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { useAuth } from '@/contexts/AuthContext'
import { useParams } from 'next/navigation'
import { v4 as uuid } from 'uuid'
import { TrackType } from '@/types/editor'
import { 
    Mic, RefreshCw, Play, Plus, Volume2, Settings, Heart, Clock, 
    FileText, Save, Wand2, Globe,
    ChevronDown, ChevronUp, Sparkles, Copy
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

interface VoiceProfile {
    id: string
    name: string
    voiceId: string
    settings: VoiceSettings
    createdAt: string
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
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)
    const [activeTab, setActiveTab] = useState<'discover' | 'favorites' | 'recent'>('discover')
    
    // Voice management
    const [favoriteVoices, setFavoriteVoices] = useState<string[]>([])
    const [recentVoices, setRecentVoices] = useState<string[]>([])
    const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([])
    
    // Voice settings with advanced controls
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
            case 'favorites':
                return voices.filter(voice => favoriteVoices.includes(voice.id))
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
                setFavoriteVoices(prefs.favorites || [])
                setRecentVoices(prefs.recent || [])
                setVoiceProfiles(prefs.profiles || [])
            } catch (e) {
                console.error('Failed to load preferences:', e)
            }
        }
    }

    const saveUserPreferences = () => {
        const prefs = {
            favorites: favoriteVoices,
            recent: recentVoices,
            profiles: voiceProfiles
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

    const toggleFavorite = (voiceId: string) => {
        const newFavorites = favoriteVoices.includes(voiceId)
            ? favoriteVoices.filter(id => id !== voiceId)
            : [...favoriteVoices, voiceId]
        setFavoriteVoices(newFavorites)
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

    const saveVoiceProfile = () => {
        if (!selectedVoice) return
        
        const profileName = prompt('Enter a name for this voice profile:')
        if (!profileName) return
        
        const newProfile: VoiceProfile = {
            id: uuid(),
            name: profileName,
            voiceId: selectedVoice.id,
            settings: voiceSettings,
            createdAt: new Date().toISOString()
        }
        
        setVoiceProfiles(prev => [...prev, newProfile])
        saveUserPreferences()
        setSuccessMessage(`✅ Voice profile "${profileName}" saved!`)
        setTimeout(() => setSuccessMessage(null), 3000)
    }

    const loadVoiceProfile = (profile: VoiceProfile) => {
        const voice = voices.find(v => v.id === profile.voiceId)
        if (voice) {
            setSelectedVoice(voice)
            setVoiceSettings(profile.settings)
            setSuccessMessage(`🎯 Loaded profile "${profile.name}"`)
            setTimeout(() => setSuccessMessage(null), 2000)
        }
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

    const getWordCount = () => script.trim().split(/\s+/).filter(word => word.length > 0).length
    const getEstimatedDuration = () => Math.max(1, Math.ceil(getWordCount() * 0.6 / voiceSettings.speed))

    return (
        <div className="flex flex-col gap-6 p-4 bg-white rounded-lg min-h-full">
            <PanelHeader icon={Mic} title="AI Voiceover Studio" />
            
            <div className="space-y-6 flex-1">
                {/* Script Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="block text-base font-medium text-gray-700">Script</label>
                        <button
                            onClick={() => setShowTemplates(!showTemplates)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                            <FileText size={16} />
                            Templates
                        </button>
                    </div>

                    {showTemplates && (
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                            <h6 className="text-sm font-semibold text-gray-700">Script Templates</h6>
                            <div className="grid gap-2">
                                {SCRIPT_TEMPLATES.map((template, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => applyTemplate(template)}
                                        className="p-3 text-left bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                    >
                                        <div className="font-medium text-gray-900">{template.name}</div>
                                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{template.content}</div>
                                        <div className="flex gap-1 mt-2">
                                            {template.tags.map(tag => (
                                                <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <textarea
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            placeholder="Enter your script here... Use templates above or write your own content."
                            maxLength={5000}
                            className="w-full h-32 p-4 border border-gray-200 rounded-lg 
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent 
                                     transition-all duration-200 placeholder:text-gray-400 resize-none"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                            <button
                                onClick={enhanceScript}
                                disabled={!script.trim()}
                                className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                                title="Enhance with AI"
                            >
                                <Wand2 size={16} />
                            </button>
                            <button
                                onClick={() => navigator.clipboard.writeText(script)}
                                disabled={!script.trim()}
                                className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                                title="Copy script"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>{script.length}/5000 characters • {getWordCount()} words</span>
                        <span>~{getEstimatedDuration()}s estimated</span>
                    </div>
                </div>

                {/* Voice Selection */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="block text-base font-medium text-gray-700">Voice Selection</label>
                        <div className="flex gap-2">
                            {selectedVoice && (
                                <button
                                    onClick={saveVoiceProfile}
                                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600"
                                    title="Save voice profile"
                                >
                                    <Save size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Voice Tabs */}
                    <div className="flex border-b border-gray-200">
                        {[
                            { key: 'discover', label: 'All Voices', icon: Globe },
                            { key: 'favorites', label: 'Favorites', icon: Heart },
                            { key: 'recent', label: 'Recent', icon: Clock }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                                {tab.key === 'favorites' && favoriteVoices.length > 0 && (
                                    <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                                        {favoriteVoices.length}
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
                        <div className="grid gap-3 max-h-80 overflow-y-auto">
                            {getTabVoices().map(voice => (
                                <div
                                    key={voice.id}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                        selectedVoice?.id === voice.id
                                            ? 'border-blue-500 bg-blue-50 shadow-md'
                                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                    }`}
                                    onClick={() => handleVoiceSelect(voice)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="font-semibold text-gray-900">{voice.name}</div>
                                                {favoriteVoices.includes(voice.id) && (
                                                    <Heart size={14} className="text-red-500 fill-current" />
                                                )}
                                            </div>
                                            {voice.description && (
                                                <div className="text-sm text-gray-600 mt-1">{voice.description}</div>
                                            )}
                                            <div className="flex gap-1 mt-2">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                                    {voice.category}
                                                </span>
                                                {Object.entries(voice.labels).slice(0, 2).map(([key, value]) => (
                                                    <span key={key} className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded-full">
                                                        {value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleFavorite(voice.id)
                                                }}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    favoriteVoices.includes(voice.id)
                                                        ? 'text-red-500 bg-red-50 hover:bg-red-100'
                                                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                                }`}
                                                title="Toggle favorite"
                                            >
                                                <Heart size={16} className={favoriteVoices.includes(voice.id) ? 'fill-current' : ''} />
                                            </button>
                                            {voice.previewUrl && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        playVoicePreview(voice)
                                                    }}
                                                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Play preview"
                                                >
                                                    <Play size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {getTabVoices().length === 0 && (
                                <div className="text-center p-8 text-gray-500">
                                    <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p>
                                        {activeTab === 'favorites' && 'No favorite voices yet'} 
                                        {activeTab === 'recent' && 'No recent voices yet'}
                                        {activeTab === 'discover' && 'No voices available'}
                                    </p>
                                    {activeTab === 'discover' && (
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

                {/* Voice Profiles */}
                {voiceProfiles.length > 0 && (
                    <div className="space-y-3">
                        <h6 className="text-sm font-semibold text-gray-700">Saved Voice Profiles</h6>
                        <div className="grid gap-2">
                            {voiceProfiles.slice(0, 3).map(profile => (
                                <button
                                    key={profile.id}
                                    onClick={() => loadVoiceProfile(profile)}
                                    className="p-3 text-left bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                >
                                    <div className="font-medium text-gray-900">{profile.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {voices.find(v => v.id === profile.voiceId)?.name || 'Voice not found'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Advanced Settings */}
                {selectedVoice && (
                    <div className="space-y-3">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            <Settings size={16} />
                            Advanced Settings
                            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        
                        {showAdvanced && (
                            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Stability: {voiceSettings.stability.toFixed(2)}
                                        </label>
                                        <input
                                            type="range" min="0" max="1" step="0.01"
                                            value={voiceSettings.stability}
                                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Clarity: {voiceSettings.similarity_boost.toFixed(2)}
                                        </label>
                                        <input
                                            type="range" min="0" max="1" step="0.01"
                                            value={voiceSettings.similarity_boost}
                                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, similarity_boost: parseFloat(e.target.value) }))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Style: {voiceSettings.style.toFixed(2)}
                                        </label>
                                        <input
                                            type="range" min="0" max="1" step="0.01"
                                            value={voiceSettings.style}
                                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, style: parseFloat(e.target.value) }))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Speed: {voiceSettings.speed.toFixed(1)}x
                                        </label>
                                        <input
                                            type="range" min="0.5" max="2.0" step="0.1"
                                            value={voiceSettings.speed}
                                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox" id="speaker-boost"
                                        checked={voiceSettings.use_speaker_boost}
                                        onChange={(e) => setVoiceSettings(prev => ({ ...prev, use_speaker_boost: e.target.checked }))}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="speaker-boost" className="text-sm font-medium text-gray-700">
                                        Enhanced Voice Clarity
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                )}

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
            <div className="pt-4 border-t border-gray-200 bg-white space-y-3">
                {selectedVoice && (
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Using: <strong>{selectedVoice.name}</strong></span>
                        <span>{getWordCount()} words → ~{getEstimatedDuration()}s</span>
                    </div>
                )}
                
                <button
                    onClick={generateVoiceover}
                    disabled={!script.trim() || !selectedVoice || isGenerating}
                    className="
                        flex items-center justify-center w-full gap-2 px-4 py-3 
                        text-base font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg 
                        hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500
                        transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5
                    "
                >
                    {isGenerating ? (
                        <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            Generating with AI...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Generate Voiceover
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

export default VoiceoverToolPanel