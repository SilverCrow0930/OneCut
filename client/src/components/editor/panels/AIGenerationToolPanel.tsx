import React, { useState } from 'react'
import { Sparkles, Image, Video, Music, Camera, Film, AudioLines, Upload, Wand2 } from 'lucide-react'
import PanelHeader from './PanelHeader'

interface GenerationType {
    id: 'image' | 'video' | 'music'
    name: string
    icon: React.ComponentType<any>
    color: string
    bgColor: string
    description: string
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

    const activeType = GENERATION_TYPES.find(type => type.id === activeTab)!

    const handleGenerate = async () => {
        if (!prompt.trim()) return
        
        setIsGenerating(true)
        // TODO: Implement generation logic based on activeTab
        console.log(`Generating ${activeTab} with prompt:`, prompt)
        
        // Simulate generation time
        setTimeout(() => {
            setIsGenerating(false)
        }, 3000)
    }

    const renderImageGeneration = () => (
        <div className="space-y-4">
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Describe your image</label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A majestic mountain landscape at sunset with golden light..."
                    className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Style</label>
                    <select className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="realistic">Realistic</option>
                        <option value="artistic">Artistic</option>
                        <option value="cartoon">Cartoon</option>
                        <option value="abstract">Abstract</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Aspect Ratio</label>
                    <select className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="1:1">Square (1:1)</option>
                        <option value="16:9">Landscape (16:9)</option>
                        <option value="9:16">Portrait (9:16)</option>
                        <option value="4:3">Classic (4:3)</option>
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
                    placeholder="A serene lake with ripples moving across the surface..."
                    className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Duration</label>
                    <select className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500">
                        <option value="3">3 seconds</option>
                        <option value="5">5 seconds</option>
                        <option value="10">10 seconds</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Motion</label>
                    <select className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500">
                        <option value="subtle">Subtle</option>
                        <option value="moderate">Moderate</option>
                        <option value="dynamic">Dynamic</option>
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
                    placeholder="Upbeat electronic music with a driving beat, perfect for a tech video..."
                    className="w-full h-24 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Genre</label>
                    <select className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500">
                        <option value="ambient">Ambient</option>
                        <option value="electronic">Electronic</option>
                        <option value="cinematic">Cinematic</option>
                        <option value="acoustic">Acoustic</option>
                        <option value="upbeat">Upbeat</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Duration</label>
                    <select className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500">
                        <option value="15">15 seconds</option>
                        <option value="30">30 seconds</option>
                        <option value="60">1 minute</option>
                        <option value="120">2 minutes</option>
                    </select>
                </div>
            </div>
        </div>
    )

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
                        const Icon = type.icon
                        return (
                            <button
                                key={type.id}
                                onClick={() => {
                                    setActiveTab(type.id)
                                    setPrompt('') // Clear prompt when switching tabs
                                }}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all duration-200 text-sm font-medium
                                    ${activeTab === type.id 
                                        ? `bg-white shadow-sm ${type.color}` 
                                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                    }
                                `}
                            >
                                <Icon size={16} />
                                <span>{type.name}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Active Tab Info */}
                <div className={`p-4 rounded-lg border ${activeType.bgColor} border-${activeType.color.replace('text-', '').replace('-600', '-200')}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-white flex items-center justify-center ${activeType.color}`}>
                            <activeType.icon size={20} />
                        </div>
                        <div>
                            <h5 className="font-semibold text-gray-800">{activeType.name} Generation</h5>
                            <p className="text-sm text-gray-600">{activeType.description}</p>
                        </div>
                    </div>
                </div>

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
                    className={`
                        flex items-center justify-center w-full gap-3 px-6 py-4 rounded-lg 
                        font-semibold text-white transition-all duration-200 
                        transform hover:scale-[1.02] active:scale-[0.98]
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                        ${activeTab === 'image' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                        ${activeTab === 'video' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                        ${activeTab === 'music' ? 'bg-green-600 hover:bg-green-700' : ''}
                    `}
                >
                    {isGenerating ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Generating {activeType.name}...
                        </>
                    ) : (
                        <>
                            <Wand2 size={20} />
                            Generate {activeType.name}
                        </>
                    )}
                </button>

                {/* Coming Soon Notice */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 text-center">
                        🚧 AI Generation features are coming soon! These interfaces will be connected to powerful AI models.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default AIGenerationToolPanel 