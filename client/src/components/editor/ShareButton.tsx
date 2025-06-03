import React, { useState, useRef, useEffect } from 'react'
import { Share, Download, AlertCircle } from 'lucide-react'
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
    const [quickExport, setQuickExport] = useState(false)
    const buttonRef = useRef<HTMLDivElement>(null)
    const { clips, tracks, project } = useEditor()
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

    const handleVideoExport = async () => {
        if (isExporting || loadingUrls) return

        setIsExporting(true)
        setExportProgress(0)
        setExportError(null)

        try {
            const exporter = new VideoExporter({
                clips,
                tracks,
                exportType: selectedExportType as 'studio' | 'social' | 'web',
                onError: (error) => {
                    console.error('VideoExporter error:', error)
                    setExportError(error)
                    setIsExporting(false)
                },
                accessToken: session?.access_token,
                quickExport,
                onProgress: (progress) => {
                    setExportProgress(Math.min(progress, 100))
                }
            })

            await exporter.processVideo()
            
            // Only set to false if no error occurred
            if (!exportError) {
                setIsExporting(false)
            }
        } catch (error) {
            console.error('Export error:', error)
            setExportError(error instanceof Error ? error.message : 'Export failed')
            setIsExporting(false)
        }
    }

    const handleProjectExport = () => {
        if (!project) return

        try {
            const projectData = {
                project: {
                    id: project.id,
                    name: project.name,
                    created_at: project.created_at,
                    updated_at: project.updated_at
                },
                tracks,
                clips,
                exportedAt: new Date().toISOString(),
                version: '1.0'
            }

            const dataStr = JSON.stringify(projectData, null, 2)
            const blob = new Blob([dataStr], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            
            const a = document.createElement('a')
            a.href = url
            a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_project_data.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Project export error:', error)
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
                <span>Export</span>
            </button>

            {isDropdownOpen && !isExporting && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50">
                    <div className="px-6 py-2 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">Export Options</h3>
                    </div>

                    {/* Browser Compatibility Warning */}
                    {typeof SharedArrayBuffer === 'undefined' && (
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="text-sm font-semibold text-amber-800">Browser Limitation</h4>
                                    <p className="text-xs text-amber-700 mt-1">
                                        Video processing requires SharedArrayBuffer support. Your browser will download project assets instead.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Project Data Export */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Project Data</h4>
                        <button
                            onClick={handleProjectExport}
                            className="
                                w-full px-4 py-2
                                bg-gray-100 hover:bg-gray-200
                                text-gray-900 font-medium rounded-lg
                                transition-colors duration-200
                                flex items-center gap-2
                            "
                        >
                            <Download size={16} />
                            Export Project as JSON
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                            Download project data for backup or sharing
                        </p>
                    </div>

                    {/* Video Export Type Selection */}
                    <div className="px-6 py-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Video Export</h4>
                        
                        {/* Quick Export Toggle */}
                        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                            <div>
                                <span className="text-sm font-medium text-gray-700">Quick Export</span>
                                <p className="text-xs text-gray-500">Lower quality, faster processing</p>
                            </div>
                            <button
                                onClick={() => setQuickExport(!quickExport)}
                                className={`
                                    w-12 h-6 rounded-full transition-colors duration-200
                                    ${quickExport ? 'bg-blue-500' : 'bg-gray-300'}
                                    relative
                                `}
                            >
                                <div className={`
                                    w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200
                                    absolute top-0.5
                                    ${quickExport ? 'translate-x-6' : 'translate-x-0.5'}
                                `} />
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {exportTypeOptions.map((type) => (
                                <div key={type.id} className="flex flex-col">
                                    <button
                                        onClick={() => setSelectedExportType(type.id)}
                                        className={`
                                            px-4 py-3 rounded-lg text-left font-medium
                                            border transition-all duration-200
                                            ${selectedExportType === type.id
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-gray-100 text-gray-900 border-gray-200 hover:bg-gray-200 hover:border-gray-300'}
                                        `}
                                    >
                                        {type.label}
                                    </button>
                                    {selectedExportType === type.id && (
                                        <p className="text-xs text-gray-500 mt-2 ml-1">
                                            {type.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Video Export Button */}
                    <div className="px-6 py-4 border-t border-gray-200">
                        <button
                            onClick={handleVideoExport}
                            disabled={loadingUrls || clips.length === 0}
                            className="
                                w-full px-4 py-3
                                bg-blue-500 hover:bg-blue-600
                                text-white font-semibold rounded-xl
                                transition-colors duration-200 text-lg
                                shadow-md
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        >
                            {loadingUrls ? 'Loading Assets...' : clips.length === 0 ? 'No Clips to Export' : 'Export Video'}
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