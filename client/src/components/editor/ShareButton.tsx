import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Share, Download, AlertCircle } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { useAssetUrls } from '@/hooks/useAssetUrls'
import ExportStatusModal from './ExportStatusModal'
import { VideoExporter } from '../VideoExporter'
import { useAuth } from '@/contexts/AuthContext'
import { exportService, type TimelineClip, type TimelineTrack } from '@/services/export'
import type { Clip, Track } from '@/types/editor'

// Type conversion functions
const convertClipsForExport = (clips: Clip[]): TimelineClip[] => {
    return clips.map(clip => ({
        id: clip.id,
        type: clip.type as 'video' | 'image' | 'audio' | 'text' | 'caption', // Keep caption as is since TimelineClip supports it
        assetId: clip.assetId,
        trackId: clip.trackId,
        timelineStartMs: clip.timelineStartMs,
        timelineEndMs: clip.timelineEndMs,
        sourceStartMs: clip.sourceStartMs,
        sourceEndMs: clip.sourceEndMs,
        speed: clip.speed,
        volume: clip.volume,
        properties: clip.properties
    }))
}

const convertTracksForExport = (tracks: Track[]): TimelineTrack[] => {
    return tracks.map(track => ({
        id: track.id,
        index: track.index,
        type: track.type === 'caption' ? 'text' : track.type as 'video' | 'audio' | 'image' | 'text',
        name: `Track ${track.index + 1}` // Generate a name since Track doesn't have one
    }))
}

const ShareButton = () => {
    const { tracks, clips, project } = useEditor()
    const { session } = useAuth()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [selectedExportType, setSelectedExportType] = useState<'480p' | '720p' | '1080p'>('720p')
    const [quickExport, setQuickExport] = useState(false)
    const [useServerExport, setUseServerExport] = useState(true)
    const buttonRef = useRef<HTMLDivElement>(null)

    // Export states
    const [isExporting, setIsExporting] = useState(false)
    const [exportProgress, setExportProgress] = useState(0)
    const [exportError, setExportError] = useState<string | null>(null)
    const [exportStatus, setExportStatus] = useState<string>('queued')
    const [currentJobId, setCurrentJobId] = useState<string | null>(null)

    // Use aspect ratio from EditorContext instead of project object
    const { aspectRatio } = useEditor()

    // Set access token when session changes
    useEffect(() => {
        exportService.setAccessToken(session?.access_token || null)
    }, [session?.access_token])

    // Memoize asset IDs to prevent unnecessary re-renders and requests
    const assetIds = useMemo(() => {
        return clips
            .filter(clip => {
                // Exclude text clips - they don't need asset URLs
                if (clip.type === 'text' || clip.type === 'caption') {
                    return false
                }
                return clip.assetId
            })
            .map(clip => clip.assetId!)
    }, [clips])
    
    const { urls: assetUrls, loading: loadingUrls } = useAssetUrls(assetIds)

    // Check for missing assets and warn user
    const missingAssets = useMemo(() => {
        return assetIds.filter(id => {
            const url = assetUrls.get(id)
            return url === null // null means failed to fetch
        })
    }, [assetIds, assetUrls])

    const exportTypeOptions = [
        { id: '480p', label: '480P', description: 'Fast export, smaller file size' },
        { id: '720p', label: '720P', description: 'Good quality, balanced file size' },
        { id: '1080p', label: '1080P', description: 'High quality, larger file size' }
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

    // Poll server export status
    useEffect(() => {
        let pollInterval: NodeJS.Timeout | null = null

        if (isExporting && currentJobId && useServerExport) {
            pollInterval = setInterval(async () => {
                try {
                    const status = await exportService.getExportStatus(currentJobId)
                    
                    if (status.success && status.job) {
                        setExportProgress(status.job.progress)
                        setExportStatus(status.job.status)
                        
                        if (status.job.status === 'completed') {
                            // Begin downloading
                            if (status.job.downloadUrl) {
                                // Update status to downloading
                                setExportProgress(100)
                                setExportStatus('downloading')
                                // Use streaming download with progress, pass jobId for fallback
                                await exportService.downloadFileWithProgress(
                                    status.job.downloadUrl,
                                    `video-export-${selectedExportType}-${Date.now()}.mp4`,
                                    (percent) => {
                                        // Map download progress 0-100 to 100-200 for UI or reuse 0-100
                                        const dlProgress = Math.min(percent, 100)
                                        setExportProgress(dlProgress)
                                    },
                                    currentJobId || undefined
                                )
                                setExportStatus('completed')
                            }
                            setIsExporting(false)
                            setCurrentJobId(null)
                        } else if (status.job.status === 'failed') {
                            setExportError(status.job.error || 'Export failed')
                            setExportStatus('failed')
                            setIsExporting(false)
                            setCurrentJobId(null)
                        }
                    }
                } catch (error) {
                    console.error('Status polling error:', error)
                }
            }, 2000) // Poll every 2 seconds
        }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval)
            }
        }
    }, [isExporting, currentJobId, useServerExport, exportService, selectedExportType])

    const handleVideoExport = async () => {
        if (isExporting || loadingUrls) return

        setIsExporting(true)
        setExportProgress(0)
        setExportError(null)
        setExportStatus('queued')

        try {
            if (useServerExport) {
                // Use aspect ratio from EditorContext instead of project object
                console.log(`[Export] Using aspect ratio from EditorContext: ${aspectRatio}`)
                
                // Use server-side export
                const result = await exportService.startExport(
                    convertClipsForExport(clips), 
                    convertTracksForExport(tracks), 
                    {
                        resolution: selectedExportType as '480p' | '720p' | '1080p',
                        fps: 30,
                        quality: quickExport ? 'low' : 'medium',
                        quickExport,
                        aspectRatio: aspectRatio
                    }
                )

                if (result.success && result.jobId) {
                    setCurrentJobId(result.jobId)
                    setExportProgress(5)
                    setExportStatus('processing')
                } else {
                    throw new Error(result.error || 'Failed to start export')
                }
            } else {
                // Use browser-side export (fallback)
                const exporter = new VideoExporter({
                    clips: convertClipsForExport(clips),
                    tracks: convertTracksForExport(tracks),
                    exportType: selectedExportType as '480p' | '720p' | '1080p',
                    onError: (error) => {
                        console.error('VideoExporter error:', error)
                        setExportError(error)
                        setIsExporting(false)
                    },
                    accessToken: session?.access_token,
                    quickExport,
                    aspectRatio: aspectRatio,
                    onProgress: (progress) => {
                        setExportProgress(Math.min(progress, 100))
                    }
                })

                await exporter.processVideo()
                
                // Only set to false if no error occurred
                if (!exportError) {
                    setIsExporting(false)
                }
            }
        } catch (error) {
            console.error('Export error:', error)
            setExportError(error instanceof Error ? error.message : 'Export failed')
            setIsExporting(false)
            setCurrentJobId(null)
        }
    }

    const handleCleanupMissingAssets = () => {
        const missingAssetIds = assetIds.filter(id => 
            !id.startsWith('external_') && assetUrls.get(id) === null
        )
        
        if (missingAssetIds.length === 0) return
        
        const confirmMessage = `This will remove ${missingAssetIds.length} clips with missing uploaded assets from your project. External assets (Pexels, Giphy) will not be affected. This action cannot be undone. Continue?`
        
        if (window.confirm(confirmMessage)) {
            // Remove clips that reference missing regular assets (not external ones)
            const clipsToRemove = clips.filter(clip => 
                clip.assetId && missingAssetIds.includes(clip.assetId)
            )
            
            // Execute remove commands for each clip
            // Note: This would need to be connected to your editor's command system
            console.log('Would remove clips with missing regular assets:', clipsToRemove.map(c => c.id))
            
            // For now, just alert the user
            alert(`Found ${clipsToRemove.length} clips with missing uploaded assets to remove. External assets are preserved. This feature needs to be connected to the editor's command system.`)
        }
    }

    const handleCloseExport = () => {
        setIsExporting(false)
        setExportError(null)
        setExportProgress(0)
        setCurrentJobId(null)
    }

    return (
        <div className="relative" ref={buttonRef}>
            <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="
                    flex items-center gap-2 
                    px-4 py-2
                    bg-white hover:bg-gray-50
                    text-gray-900 font-medium rounded-lg
                    transition-all duration-200
                    shadow-sm hover:shadow-md
                    border border-gray-200 hover:border-gray-300
                "
            >
                <Share size={18} />
                Share
            </button>

            {isDropdownOpen && (
                <div className="
                    absolute top-full mt-2 right-0
                    bg-white border border-gray-200 rounded-xl shadow-xl
                    w-80 z-50
                    overflow-hidden
                ">
                    {missingAssets.length > 0 && (
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="text-sm font-semibold text-red-800">Missing Assets</h4>
                                    <p className="text-xs text-red-700 mt-1">
                                        {missingAssets.length} asset(s) failed to load. Export may fail.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {typeof SharedArrayBuffer === 'undefined' && !useServerExport && (
                        <div className="px-6 py-4 border-b border-gray-200">
                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h4 className="text-sm font-semibold text-blue-800">Processing Mode: Standard</h4>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Video will be processed using standard browser methods. May be slower but will work.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Video Share Type Selection */}
                    <div className="px-6 py-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Download Quality</h4>
                        
                        <div className="flex flex-col gap-3">
                            {exportTypeOptions.map((type) => (
                                <div key={type.id} className="flex flex-col">
                                    <button
                                        onClick={() => setSelectedExportType(type.id as '480p' | '720p' | '1080p')}
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

                    {/* Video Share Button */}
                    <div className="px-6 py-4 border-t border-gray-200">
                        <button
                            onClick={handleVideoExport}
                            disabled={loadingUrls || clips.length === 0}
                            className="
                                w-full px-4 py-3
                                bg-blue-500 hover:bg-blue-600
                                text-white font-semibold rounded-lg
                                transition-all duration-200 text-lg
                                shadow-md hover:shadow-lg
                                border border-transparent
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        >
                            {loadingUrls ? 'Loading Assets...' : clips.length === 0 ? 'No Clips to Download' : 'Download Video'}
                        </button>
                    </div>
                </div>
            )}

            <ExportStatusModal
                isOpen={isExporting}
                progress={exportProgress}
                status={exportStatus}
                onClose={handleCloseExport}
                error={exportError}
                serverSide={useServerExport}
            />
        </div>
    )
}

export default ShareButton