import React, { useState, useRef, useEffect } from 'react'
import { Share } from 'lucide-react'

const ShareButton = () => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [selectedExportType, setSelectedExportType] = useState('studio')
    const buttonRef = useRef<HTMLDivElement>(null)

    const exportTypeOptions = [
        { id: 'studio', label: 'Studio', description: 'Maximum quality for professional use' },
        { id: 'social', label: 'Social', description: 'Optimized for social media platforms (IG Reels, TikTok, etc.)' },
        { id: 'web', label: 'Web', description: 'Balanced quality for web streaming' }
    ]

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isDropdownOpen])

    const handleExport = () => {
        // TODO: Implement video export functionality
        console.log(`Exporting video for ${selectedExportType}`)
        setIsDropdownOpen(false)
    }

    return (
        <div ref={buttonRef} className="relative">
            <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="
                    flex items-center gap-2 px-4 py-2
                    bg-white text-black hover:bg-gray-200
                    font-medium rounded-lg
                    transition-all duration-300
                    shadow-lg hover:shadow-xl
                "
            >
                <Share size={18} />
                <span>Share</span>
            </button>

            {
                isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50">
                        <div className="px-6 py-2 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Export Settings</h3>
                        </div>

                        {/* Export Type Selection */}
                        <div className="px-6 py-4">
                            <div className="flex flex-col gap-4">
                                {
                                    exportTypeOptions.map((type) => (
                                        <div key={type.id} className="flex flex-col">
                                            <button
                                                onClick={() => setSelectedExportType(type.id)}
                                                className={`
                                                    px-6 py-4 rounded-2xl text-lg text-left font-bold
                                                    border transition-all duration-200 shadow-sm
                                                    ${selectedExportType === type.id
                                                        ? 'bg-blue-500 text-white border-blue-500 shadow-lg'
                                                        : 'bg-gray-100 text-gray-900 border-gray-200 hover:bg-gray-200 hover:border-gray-300'}
                                                 `}
                                            >
                                                {type.label}
                                            </button>
                                            {selectedExportType === type.id && (
                                                <p className="text-sm text-gray-400 mt-3 ml-1 leading-snug">
                                                    {type.description}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                }
                            </div>
                        </div>

                        {/* Export Button */}
                        <div className="px-6 py-4 border-t border-gray-200">
                            <button
                                onClick={handleExport}
                                className="
                                    w-full px-4 py-3
                                    bg-blue-500 hover:bg-blue-600
                                    text-white font-semibold rounded-xl
                                    transition-colors duration-200 text-lg
                                    shadow-md
                                "
                            >
                                Export Video
                            </button>
                        </div>
                    </div>
                )
            }
        </div>
    )
}

export default ShareButton