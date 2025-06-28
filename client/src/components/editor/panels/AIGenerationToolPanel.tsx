import React, { useState } from 'react'
import { Sparkles, Image, Video, Music, Camera, Film, AudioLines, Upload, Wand2, Play, Plus } from 'lucide-react'
import PanelHeader from './PanelHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useAssets } from '@/contexts/AssetsContext'
import { useEditor } from '@/contexts/EditorContext'
import { useParams } from 'next/navigation'
import { apiPath } from '@/lib/config'
import { addAssetToTrack } from '@/lib/editor/utils'

interface GenerationType {
    id: 'image' | 'video' | 'music'
    name: string
    icon: React.ComponentType<any>
    color: string
    bgColor: string
    description: string
}

interface GeneratedResult {
    type: 'image' | 'video' | 'music'
    url: string
    filename: string
    prompt: string
    asset: {
        id: string
        name: string
        mime_type: string
        duration: number | null
    }
}

const GENERATION_TYPES: GenerationType[] = [
    {
        id: 'image',
        name: 'Image',
        icon: Camera,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        description: 'Generate stunning images from text descriptions'
    },
    {
        id: 'video',
        name: 'Video',
        icon: Film,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        description: 'Create short videos from text prompts'
    },
    {
        id: 'music',
        name: 'Music',
        icon: AudioLines,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        description: 'Generate background music and audio tracks'
    }
]

const AIGenerationToolPanel = () => {
    const [activeTab, setActiveTab] = useState<'image' | 'video' | 'music'>('image')
    const [prompt, setPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<GeneratedResult | null>(null)
    const [progress, setProgress] = useState(0)
    
    // Generation settings
    const [imageStyle, setImageStyle] = useState('realistic')
    const [aspectRatio, setAspectRatio] = useState('16:9')
    const [videoDuration, setVideoDuration] = useState('5')
    const [videoMotion, setVideoMotion] = useState('moderate')
    const [musicGenre, setMusicGenre] = useState('ambient')
    const [musicDuration, setMusicDuration] = useState('30')
    const [quality, setQuality] = useState('normal')

    const { session } = useAuth()
    const { refresh } = useAssets()
    const { tracks, clips, executeCommand } = useEditor()
    const params = useParams()

    const activeType = GENERATION_TYPES.find(type => type.id === activeTab)!

    const handleGenerate = async () => {
        if (!prompt.trim() || !session?.access_token) {
            setError('Please enter a prompt and make sure you\'re signed in')
            return
        }
        
        setIsGenerating(true)
        setError(null)
        setResult(null)
        setProgress(0)

        try {
            let requestBody: any = {
                type: activeTab,
                prompt: prompt.trim(),
                quality
            }

            // Add type-specific parameters
            if (activeTab === 'image') {
                requestBody = {
                    ...requestBody,
                    style: imageStyle,
                    aspect_ratio: aspectRatio
                }
            } else if (activeTab === 'video') {
                requestBody = {
                    ...requestBody,
                    duration: parseInt(videoDuration),
                    motion: videoMotion,
                    aspect_ratio: aspectRatio
                }
            } else if (activeTab === 'music') {
                requestBody = {
                    ...requestBody,
                    genre: musicGenre,
                    duration: parseInt(musicDuration)
                }
            }

            console.log(`🎨 Generating ${activeTab} with Fal.ai:`, requestBody)

            // Call your backend API that will handle Fal.ai integration
            const response = await fetch(apiPath('ai/generate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `Generation failed: ${response.status}`)
            }

            const resultData = await response.json()
            console.log('✅ Generation completed:', resultData)

            setResult({
                type: activeTab,
                url: resultData.url,
                filename: resultData.filename || `generated_${activeTab}_${Date.now()}`,
                prompt: prompt,
                asset: {
                    id: resultData.asset.id,
                    name: resultData.asset.name,
                    mime_type: resultData.asset.mime_type,
                    duration: resultData.asset.duration
                }
            })

            // Refresh assets to show the new generated content
            refresh()

        } catch (error: any) {
            console.error('❌ Generation failed:', error)
            setError(error.message || 'Failed to generate content')
        } finally {
            setIsGenerating(false)
            setProgress(0)
        }
    }

    const addToTimeline = () => {
        if (!result?.asset || !params.projectId) {
            console.error('No asset or project ID available')
            return
        }

        // Get project ID
        const projectId = Array.isArray(params.projectId) 
            ? params.projectId[0] 
            : params.projectId

        // Create asset object for timeline
        const asset = {
            id: result.asset.id,
            name: result.asset.name,
            mime_type: result.asset.mime_type,
            duration: result.asset.duration
        }

        // Add to timeline using the utility function
        addAssetToTrack(asset, tracks, clips, executeCommand, projectId)

        console.log('✅ Added generated asset to timeline:', asset.name)
    }

    const renderImageGeneration = () => (
        <div className="space-y-4">
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Describe your image</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A majestic mountain landscape at sunset with golden light, photorealistic, highly detailed..."
                    className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
                    <select
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="realistic">Realistic</option>
                        <option value="artistic">Artistic</option>
                        <option value="cartoon">Cartoon</option>
                        <option value="abstract">Abstract</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio</label>
                    <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                        <option value="1:1">1:1 (Square)</option>
                    </select>
                </div>
            </div>
        </div>
    )

    const renderVideoGeneration = () => (
        <div className="space-y-4">
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Describe your video</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A serene lake with gentle ripples moving across the surface, soft morning light..."
                    className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <select
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="3">3 seconds</option>
                        <option value="5">5 seconds</option>
                        <option value="10">10 seconds</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Motion</label>
                    <select
                        value={videoMotion}
                        onChange={(e) => setVideoMotion(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="low">Low Motion</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High Motion</option>
                    </select>
                </div>
            </div>
        </div>
    )

    const renderMusicGeneration = () => (
        <div className="space-y-4">
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Describe your music</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Upbeat electronic music with a driving beat, synthesizer melodies, perfect for a tech video..."
                    className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                    rows={3}
                />
                
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                    <select
                        value={musicGenre}
                        onChange={(e) => setMusicGenre(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="ambient">Ambient</option>
                        <option value="electronic">Electronic</option>
                        <option value="acoustic">Acoustic</option>
                        <option value="cinematic">Cinematic</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <select
                        value={musicDuration}
                        onChange={(e) => setMusicDuration(e.target.value)}
                        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="15">15 seconds</option>
                        <option value="30">30 seconds</option>
                        <option value="60">60 seconds</option>
                    </select>
                </div>
            </div>
        </div>
    )

    const renderResult = () => {
        if (!result) return null

        return (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                    <h6 className="font-semibold text-gray-800">Generated {result.type}</h6>
                    <button
                        onClick={addToTimeline}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        <Plus size={14} />
                        Add to Timeline
                    </button>
                </div>

                {result.type === 'image' && (
                    <div className="space-y-2">
                        <img 
                            src={result.url} 
                            alt={result.prompt} 
                            className="w-full h-48 object-cover rounded-lg border"
                        />
                        <p className="text-xs text-gray-600 italic">"{result.prompt}"</p>
                    </div>
                )}

                {result.type === 'video' && (
                    <div className="space-y-2">
                        <video 
                            src={result.url} 
                            controls 
                            className="w-full h-48 rounded-lg border"
                        />
                        <p className="text-xs text-gray-600 italic">"{result.prompt}"</p>
                    </div>
                )}

                {result.type === 'music' && (
                    <div className="space-y-2">
                        <audio 
                            src={result.url} 
                            controls 
                            className="w-full"
                        />
                        <p className="text-xs text-gray-600 italic">"{result.prompt}"</p>
                    </div>
                )}
                
                <div className="text-xs text-gray-500">
                    ✅ Saved to your assets - accessible in Upload panel
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 p-4 bg-white rounded-lg min-h-full">
            <PanelHeader 
                icon={Sparkles} 
                title="AI Generation" 
                description="Create images, videos, and music with AI"
            />
            
            <div className="space-y-6 flex-1">
                {/* Tab Navigation */}
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                    {GENERATION_TYPES.map((type) => {
                        return (
                            <button
                                key={type.id}
                                onClick={() => {
                                    setActiveTab(type.id)
                                    setPrompt('')
                                    setError(null)
                                    setResult(null)
                                }}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium
                                    ${activeTab === type.id 
                                        ? `${type.bgColor} ${type.color} border-2 border-current` 
                                        : 'text-gray-600 hover:text-gray-800'
                                    }
                                `}
                            >
                                {type.name}
                            </button>
                        )
                    })}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Generation Interface */}
                <div className="space-y-4">
                    {activeTab === 'image' && renderImageGeneration()}
                    {activeTab === 'video' && renderVideoGeneration()}
                    {activeTab === 'music' && renderMusicGeneration()}
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                >
                    {isGenerating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            <activeType.icon className="w-4 h-4" />
                            Generate {activeType.name}
                        </>
                    )}
                </button>

                {/* Result Display */}
                {renderResult()}
            </div>
        </div>
    )
}

export default AIGenerationToolPanel 