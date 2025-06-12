import React, { useState } from 'react'
import { Smartphone, Monitor, AlertTriangle } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'

export function AspectRatioButton() {
    const { aspectRatio, setAspectRatio, clips } = useEditor()
    const [showWarning, setShowWarning] = useState(false)
    const [pendingRatio, setPendingRatio] = useState<'vertical' | 'horizontal' | null>(null)

    const hasContent = clips.length > 0

    const handleRatioChange = (newRatio: 'vertical' | 'horizontal') => {
        if (hasContent && newRatio !== aspectRatio) {
            // Show warning if there's content and we're switching ratios
            setPendingRatio(newRatio)
            setShowWarning(true)
        } else {
            // No content or same ratio, change immediately
            setAspectRatio(newRatio)
        }
    }

    const confirmRatioChange = () => {
        if (pendingRatio) {
            setAspectRatio(pendingRatio)
        }
        setShowWarning(false)
        setPendingRatio(null)
    }

    const cancelRatioChange = () => {
        setShowWarning(false)
        setPendingRatio(null)
    }

    return (
        <>
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200/60 p-1">
                <button
                    onClick={() => handleRatioChange('vertical')}
                    className={`
                        flex items-center justify-center p-2 rounded-md text-xs font-medium transition-all duration-200
                        ${aspectRatio === 'vertical'
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }
                    `}
                    title="Vertical (9:16) - Mobile, TikTok, Instagram Reels"
                >
                    <Smartphone className="w-4 h-4" />
                </button>
                
                <button
                    onClick={() => handleRatioChange('horizontal')}
                    className={`
                        flex items-center justify-center p-2 rounded-md text-xs font-medium transition-all duration-200
                        ${aspectRatio === 'horizontal'
                            ? 'bg-blue-500 text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }
                    `}
                    title="Horizontal (16:9) - YouTube, Desktop, TV"
                >
                    <Monitor className="w-4 h-4" />
                </button>
            </div>

            {/* Warning Modal */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Switch Aspect Ratio?
                                </h3>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    Changing the aspect ratio will affect how your content appears. 
                                    Existing clips will be automatically adapted to fit the new format.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600">From:</span>
                                {aspectRatio === 'vertical' ? (
                                    <div className="flex items-center gap-1 text-blue-600 font-medium">
                                        <Smartphone className="w-4 h-4" />
                                        <span>9:16</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-blue-600 font-medium">
                                        <Monitor className="w-4 h-4" />
                                        <span>16:9</span>
                                    </div>
                                )}
                            </div>
                            <span className="text-gray-400">→</span>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600">To:</span>
                                {pendingRatio === 'vertical' ? (
                                    <div className="flex items-center gap-1 text-green-600 font-medium">
                                        <Smartphone className="w-4 h-4" />
                                        <span>9:16</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-green-600 font-medium">
                                        <Monitor className="w-4 h-4" />
                                        <span>16:9</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={cancelRatioChange}
                                className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRatioChange}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Switch Format
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
} 