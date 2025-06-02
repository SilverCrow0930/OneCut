import React, { useState, useRef } from 'react'
import { useEditor } from '@/contexts/EditorContext'

export default function PlayerControls() {
    const { playerSettings, updatePlayerSettings } = useEditor()
    const [showBackgroundOptions, setShowBackgroundOptions] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleAspectRatioToggle = () => {
        const newRatio = playerSettings.aspectRatio === '16:9' ? '9:16' : '16:9'
        updatePlayerSettings({ aspectRatio: newRatio })
    }

    const handleBackgroundChange = (type: 'black' | 'white' | 'image') => {
        if (type === 'image') {
            fileInputRef.current?.click()
        } else {
            updatePlayerSettings({ 
                background: { type, imageUrl: null } 
            })
        }
        setShowBackgroundOptions(false)
    }

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
                const imageUrl = e.target?.result as string
                updatePlayerSettings({ 
                    background: { type: 'image', imageUrl } 
                })
            }
            reader.readAsDataURL(file)
        }
        setShowBackgroundOptions(false)
    }

    return (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            {/* Aspect Ratio Toggle */}
            <button
                onClick={handleAspectRatioToggle}
                className="bg-black/70 hover:bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm border border-white/10"
                title="Toggle aspect ratio"
            >
                {playerSettings.aspectRatio}
            </button>

            {/* Background Options */}
            <div className="relative">
                <button
                    onClick={() => setShowBackgroundOptions(!showBackgroundOptions)}
                    className="bg-black/70 hover:bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm border border-white/10"
                    title="Change background"
                >
                    🎨
                </button>

                {showBackgroundOptions && (
                    <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[120px]">
                        <button
                            onClick={() => handleBackgroundChange('black')}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                        >
                            <div className="w-4 h-4 bg-black rounded border"></div>
                            Black
                        </button>
                        <button
                            onClick={() => handleBackgroundChange('white')}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                        >
                            <div className="w-4 h-4 bg-white rounded border border-gray-300"></div>
                            White
                        </button>
                        <button
                            onClick={() => handleBackgroundChange('image')}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                        >
                            <div className="w-4 h-4 bg-gradient-to-br from-blue-400 to-purple-500 rounded"></div>
                            Image
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden file input for image upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
            />

            {/* Click outside handler */}
            {showBackgroundOptions && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowBackgroundOptions(false)}
                />
            )}
        </div>
    )
} 