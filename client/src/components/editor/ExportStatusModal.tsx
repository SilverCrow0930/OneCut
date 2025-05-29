import React from 'react'
import { Loader2, X, Download, AlertCircle } from 'lucide-react'

interface ExportStatusModalProps {
    isOpen: boolean
    progress: number
    onClose: () => void
    error: string | null
}

const ExportStatusModal = ({ isOpen, progress, onClose, error }: ExportStatusModalProps) => {
    if (!isOpen) return null

    const getStatusMessage = () => {
        if (error) return 'Export failed'
        if (progress === 0) return 'Preparing export...'
        if (progress < 20) return 'Loading assets...'
        if (progress < 40) return 'Processing video...'
        if (progress < 60) return 'Applying effects...'
        if (progress < 80) return 'Encoding video...'
        if (progress < 100) return 'Finalizing export...'
        return 'Export complete!'
    }

    const getStatusIcon = () => {
        if (error) return <AlertCircle className="w-5 h-5 text-red-500" />
        if (progress === 100) return <Download className="w-5 h-5 text-green-500" />
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">
                        {error ? 'Export Failed' : 'Exporting Video'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ease-out ${error ? 'bg-red-500' :
                                progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                                }`}
                            style={{ width: error ? '100%' : `${progress}%` }}
                        />
                    </div>

                    {/* Status text only below the progress bar */}
                    <div className="flex items-center justify-center gap-2 text-gray-600 mt-4">
                        {getStatusIcon()}
                        <span>{getStatusMessage()}</span>
                    </div>

                    {/* Error details */}
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            <span>Please try again or contact support if the problem persists</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ExportStatusModal 