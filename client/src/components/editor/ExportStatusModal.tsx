import React from 'react'
import { Loader2, X, Download, AlertCircle, CheckCircle } from 'lucide-react'

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
        if (progress === 100) return <CheckCircle className="w-5 h-5 text-green-500" />
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    }

    const getTroubleshootingInfo = () => {
        if (!error) return null
        
        return (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Troubleshooting Tips:</h4>
                <ul className="text-xs text-red-700 space-y-1">
                    <li>• Check if your browser blocks downloads</li>
                    <li>• Ensure you have enough storage space</li>
                    <li>• Try using Chrome or Firefox with latest updates</li>
                    <li>• Clear browser cache and try again</li>
                    <li>• Check browser console for detailed error messages</li>
                </ul>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Export Status</h2>
                    {(error || progress === 100) && (
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                    {getStatusIcon()}
                    <span className="text-lg font-medium text-gray-900">
                        {getStatusMessage()}
                    </span>
                </div>

                {!error && progress < 100 && (
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                        <div
                            className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {!error && progress < 100 && (
                    <p className="text-sm text-gray-600 mb-4">
                        {progress.toFixed(0)}% complete
                    </p>
                )}

                {progress === 100 && !error && (
                    <div className="text-center py-4">
                        <p className="text-sm text-green-600 mb-2">
                            Your video has been exported successfully!
                        </p>
                        <p className="text-xs text-gray-500">
                            Check your browser's download folder for the exported video file.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="text-center py-2">
                        <p className="text-sm text-red-600 mb-2">
                            {error}
                        </p>
                        {getTroubleshootingInfo()}
                    </div>
                )}
            </div>
        </div>
    )
}

export default ExportStatusModal 