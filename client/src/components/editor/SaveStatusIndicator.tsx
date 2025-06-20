import { CloudAlert, CloudOff, CloudRainWind, CloudUpload, RefreshCw } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { useState } from 'react'

export default function SaveStatusIndicator() {
    const { saveState, error } = useEditor()
    const [showErrorDetails, setShowErrorDetails] = useState(false)

    let icon, label, extraClass = ''

    const isConstraintError = error?.includes('track') || error?.includes('constraint') || error?.includes('foreign key')
    const isAIContentError = error?.includes('AI-generated') || error?.includes('placeholder')

    switch (saveState) {
        case 'error':
            icon = <CloudAlert className="text-red-500" />
            label = 'Error saving timeline'
            extraClass = 'text-red-600 cursor-pointer'
            break
        case 'saving':
            icon = <CloudUpload className="animate-pulse text-blue-500" />
            label = 'Saving…'
            extraClass = 'text-blue-600'
            break
        case 'unsaved':
            icon = <CloudOff className="text-amber-500" />
            label = 'Unsaved changes'
            extraClass = 'text-amber-600'
            break
        case 'saved':
        default:
            icon = <CloudRainWind className="text-green-500" />
            label = 'All changes saved'
            extraClass = 'text-green-600'
    }

    const handleRefreshPage = () => {
        window.location.reload()
    }

    return (
        <div className="relative">
            <div
                className={`
                    flex items-center gap-1 text-sm
                    select-none ${extraClass}
                `}
                title={label}
                onClick={saveState === 'error' ? () => setShowErrorDetails(!showErrorDetails) : undefined}
            >
                {icon}
                <span className="hidden sm:inline">
                    {label}
                </span>
            </div>

            {/* Error Details Modal */}
            {showErrorDetails && saveState === 'error' && error && (
                <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-red-200 rounded-lg shadow-lg p-4 z-50">
                    <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-red-700 flex items-center gap-2">
                            <CloudAlert size={16} />
                            Save Error
                        </h3>
                        <button
                            onClick={() => setShowErrorDetails(false)}
                            className="text-gray-400 hover:text-gray-600 text-lg"
                        >
                            ×
                        </button>
                    </div>
                    
                    <div className="text-sm text-red-600 mb-4 whitespace-pre-line">
                        {error}
                    </div>

                    {/* Specific recovery options based on error type */}
                    <div className="space-y-2">
                        {isConstraintError && (
                            <div className="p-3 bg-red-50 rounded-md">
                                <p className="text-sm font-medium text-red-800 mb-2">Quick Fix:</p>
                                <p className="text-xs text-red-700 mb-3">
                                    This error usually happens when content references deleted items. 
                                    Try refreshing the page to reload your project.
                                </p>
                                <button
                                    onClick={handleRefreshPage}
                                    className="flex items-center gap-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
                                >
                                    <RefreshCw size={12} />
                                    Refresh Page
                                </button>
                            </div>
                        )}

                        {isAIContentError && (
                            <div className="p-3 bg-amber-50 rounded-md">
                                <p className="text-sm font-medium text-amber-800 mb-2">AI Content Issue:</p>
                                <p className="text-xs text-amber-700 mb-3">
                                    AI-generated content without actual URLs cannot be saved. 
                                    Wait for generation to complete or remove placeholder content.
                                </p>
                                <p className="text-xs text-amber-600">
                                    💡 Look for clips with "AI Image:" or "AI Video:" labels and remove them if they appear blank.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-gray-200">
                            <button
                                onClick={() => setShowErrorDetails(false)}
                                className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={handleRefreshPage}
                                className="flex-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm rounded transition-colors flex items-center justify-center gap-1"
                            >
                                <RefreshCw size={14} />
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backdrop to close modal */}
            {showErrorDetails && (
                <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowErrorDetails(false)}
                />
            )}
        </div>
    )
}
