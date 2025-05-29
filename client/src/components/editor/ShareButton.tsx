import React, { useState, useRef, useEffect } from 'react'
import { Share } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { useAssetUrls } from '@/hooks/useAssetUrls'
import ExportStatusModal from './ExportStatusModal'
import { VideoExporter } from '../VideoExporter'
import { useAuth } from '@/contexts/AuthContext'

const ShareButton = () => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [selectedExportType, setSelectedExportType] = useState('studio')
    const [isExporting, setIsExporting] = useState(false)
    const [exportProgress, setExportProgress] = useState(0)
    const [exportError, setExportError] = useState<string | null>(null)
    const buttonRef = useRef<HTMLDivElement>(null)
    const { clips, tracks } = useEditor()
    const { assets } = useAssets()
    const { session } = useAuth()

    // Get all unique asset IDs from clips
    const assetIds = clips
        .filter(clip => clip.assetId)
        .map(clip => clip.assetId!)
    const { urls: assetUrls, loading: loadingUrls } = useAssetUrls(assetIds)

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

    const handleExport = async () => {
        if (isExporting || loadingUrls) return

        setIsExporting(true)
        setExportProgress(0)
        setExportError(null)

        try {
            // Simulate export progress
            const simulateProgress = () => {
                return new Promise<void>((resolve) => {
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += Math.random() * 10;
                        if (progress >= 100) {
                            progress = 100;
                            clearInterval(interval);
                            resolve();
                        }
                        setExportProgress(progress);
                    }, 500);
                });
            };

            await simulateProgress();
            setIsExporting(false);
        } catch (error) {
            console.error('Export error:', error)
            setExportError(error instanceof Error ? error.message : 'Export failed')
            setIsExporting(false)
        }
    }

    const handleCloseExport = () => {
        if (exportProgress < 100) {
            // TODO: Show confirmation dialog
            return
        }
        setIsExporting(false)
        setExportProgress(0)
        setExportError(null)
    }

    return (
        <div ref={buttonRef} className="relative">
            <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={isExporting || loadingUrls}
                className={`
                    flex items-center gap-2 px-4 py-2
                    bg-white text-black hover:bg-gray-200
                    font-medium rounded-lg
                    transition-all duration-300
                    shadow-lg hover:shadow-xl
                    disabled:opacity-50 disabled:cursor-not-allowed
                `}
            >
                <Share size={18} />
                <span>Share</span>
            </button>

            {isDropdownOpen && !isExporting && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50">
                    <div className="px-6 py-2 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Export Settings</h3>
                    </div>

                    {/* Export Type Selection */}
                    <div className="px-6 py-4">
                        <div className="flex flex-col gap-4">
                            {exportTypeOptions.map((type) => (
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
                            ))}
                        </div>
                    </div>

                    {/* Export Button */}
                    <div className="px-6 py-4 border-t border-gray-200">
                        <button
                            onClick={handleExport}
                            disabled={loadingUrls}
                            className="
                                w-full px-4 py-3
                                bg-blue-500 hover:bg-blue-600
                                text-white font-semibold rounded-xl
                                transition-colors duration-200 text-lg
                                shadow-md
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        >
                            {loadingUrls ? 'Loading Assets...' : 'Export Video'}
                        </button>
                    </div>
                </div>
            )}

            <ExportStatusModal
                isOpen={isExporting}
                progress={exportProgress}
                onClose={handleCloseExport}
                error={exportError}
            />
        </div>
    )
}

export default ShareButton