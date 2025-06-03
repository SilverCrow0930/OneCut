import React from 'react'
import { Loader2, X, Download, AlertCircle, CheckCircle, Cloud, StopCircle } from 'lucide-react'

interface ExportStatusModalProps {
    isOpen: boolean
    progress: number
    status?: string
    onClose: () => void
    onCancel?: () => void
    error: string | null
    serverSide?: boolean
}

const ExportStatusModal = ({ 
    isOpen, 
    progress, 
    status = 'queued', 
    onClose, 
    onCancel, 
    error, 
    serverSide = false 
}: ExportStatusModalProps) => {
    if (!isOpen) return null

    const getStatusMessage = () => {
        if (error) return 'Export failed'
        
        if (serverSide) {
            switch (status) {
                case 'queued':
                    return 'Export queued on server...'
                case 'processing':
                    if (progress < 10) return 'Downloading assets...'
                    if (progress < 35) return 'Processing media files...'
                    if (progress < 95) return 'Encoding video...'
                    if (progress < 100) return 'Uploading to cloud...'
                    return 'Finalizing export...'
                case 'completed':
                    return 'Export complete!'
                case 'failed':
                    return 'Export failed'
                case 'cancelled':
                    return 'Export cancelled'
                default:
                    return 'Processing export...'
            }
        } else {
            // Browser-side export messages (legacy)
        if (progress === 0) return 'Preparing export...'
        if (progress < 20) return 'Loading assets...'
        if (progress < 40) return 'Processing video...'
        if (progress < 60) return 'Applying effects...'
        if (progress < 80) return 'Encoding video...'
        if (progress < 100) return 'Finalizing export...'
        return 'Export complete!'
        }
    }

    const getStatusIcon = () => {
        if (error || status === 'failed') return <AlertCircle className="w-5 h-5 text-red-500" />
        if (progress === 100 || status === 'completed') return <CheckCircle className="w-5 h-5 text-green-500" />
        if (status === 'cancelled') return <StopCircle className="w-5 h-5 text-orange-500" />
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    }

    const getTroubleshootingInfo = () => {
        if (!error) return null
        
        return (
            <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Troubleshooting Tips:</h4>
                <ul className="text-xs text-red-700 space-y-1">
                    {serverSide ? (
                        <>
                            <li>• Check your internet connection</li>
                            <li>• Verify all assets are properly uploaded</li>
                            <li>• Try reducing video length or complexity</li>
                            <li>• Contact support if the problem persists</li>
                        </>
                    ) : (
                        <>
                            <li>• Check if your browser blocks downloads</li>
                            <li>• Ensure you have enough storage space</li>
                            <li>• Try using Chrome or Firefox with latest updates</li>
                            <li>• Clear browser cache and try again</li>
                            <li>• Check browser console for detailed error messages</li>
                        </>
                    )}
                </ul>
            </div>
        )
    }

    const canClose = error || status === 'completed' || status === 'failed' || status === 'cancelled' || progress === 100
    const canCancel = !error && status !== 'completed' && status !== 'failed' && status !== 'cancelled' && onCancel

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-900">Export Status</h2>
                        {serverSide && (
                            <Cloud className="w-5 h-5 text-blue-500" />
                        )}
                    </div>
                    {canClose && (
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

                {serverSide && status === 'queued' && (
                    <div className="text-center py-2 mb-4">
                        <p className="text-sm text-blue-600">
                            Your export has been queued for processing on our servers.
                        </p>
                    </div>
                )}

                {!error && status !== 'completed' && status !== 'cancelled' && progress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                        <div
                            className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(progress, 5)}%` }}
                        />
                    </div>
                )}

                {!error && status !== 'completed' && status !== 'cancelled' && progress > 0 && (
                    <p className="text-sm text-gray-600 mb-4">
                        {progress.toFixed(0)}% complete
                    </p>
                )}

                {(progress === 100 || status === 'completed') && !error && (
                    <div className="text-center py-4">
                        <p className="text-sm text-green-600 mb-2">
                            Your video has been exported successfully!
                        </p>
                        <p className="text-xs text-gray-500">
                            {serverSide 
                                ? "The download should start automatically. Check your browser's download folder."
                                : "Check your browser's download folder for the exported video file."
                            }
                        </p>
                    </div>
                )}

                {status === 'cancelled' && (
                    <div className="text-center py-4">
                        <p className="text-sm text-orange-600 mb-2">
                            Export was cancelled.
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

                {/* Cancel button */}
                {canCancel && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
                        >
                            Cancel Export
                        </button>
                        </div>
                    )}

                {/* Server-side benefits info */}
                {serverSide && !error && status !== 'completed' && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-700">
                            <strong>Server Processing:</strong> Faster encoding, higher quality, and no browser limitations.
                        </p>
                </div>
                )}
            </div>
        </div>
    )
}

export default ExportStatusModal 