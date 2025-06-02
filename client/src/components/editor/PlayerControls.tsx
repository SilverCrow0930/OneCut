import React, { useState, useRef } from 'react'
import { useEditor } from '@/contexts/EditorContext'

export default function PlayerControls() {
    const { playerSettings, updatePlayerSettings } = useEditor()
    const [showBackgroundOptions, setShowBackgroundOptions] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    console.log('PlayerControls - Current player settings:', playerSettings)

    const handleAspectRatioToggle = () => {
        const newRatio = playerSettings.aspectRatio === '16:9' ? '9:16' : '16:9'
        console.log('Toggling aspect ratio from', playerSettings.aspectRatio, 'to', newRatio)
        updatePlayerSettings({ aspectRatio: newRatio })
    }

    const handleBackgroundChange = (type: 'black' | 'white' | 'image') => {
        console.log('Changing background to:', type)
        if (type === 'image') {
            fileInputRef.current?.click()
        } else {
            const newSettings = { 
                background: { 
                    type, 
                    imageUrl: null 
                } 
            }
            console.log('Updating player settings with:', newSettings)
            updatePlayerSettings(newSettings)
        }
        setShowBackgroundOptions(false)
    }

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        console.log('File selected:', file)
        if (file) {
            // Check if file is an image
            if (!file.type.startsWith('image/')) {
                console.error('Selected file is not an image')
                return
            }

            const reader = new FileReader()
            reader.onload = (e) => {
                const imageUrl = e.target?.result as string
                console.log('Image loaded, URL length:', imageUrl?.length)
                const newSettings = { 
                    background: { type: 'image' as const, imageUrl } 
                }
                console.log('Updating player settings with image:', newSettings)
                updatePlayerSettings(newSettings)
            }
            reader.onerror = (e) => {
                console.error('Error reading file:', e)
            }
            reader.readAsDataURL(file)
        }
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        setShowBackgroundOptions(false)
    }

    return (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            {/* Aspect Ratio Toggle */}
            <button
                onClick={handleAspectRatioToggle}
                className="bg-white text-black/70 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-300 hover:bg-gray-50"
                title="Toggle aspect ratio"
            >
                {playerSettings.aspectRatio}
            </button>

            {/* Background Options */}
            <div className="relative">
                <button
                    onClick={() => setShowBackgroundOptions(!showBackgroundOptions)}
                    className="bg-white text-black/70 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-300 hover:bg-gray-50"
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