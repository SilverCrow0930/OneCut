import React, { useState } from 'react'
import { 
    Settings, 
    Magnet, 
    Grid3X3, 
    Scissors, 
    RotateCcw, 
    ChevronDown,
    Zap,
    Move,
    AlignLeft
} from 'lucide-react'
import { useTimelineSettings } from '@/contexts/TimelineSettingsContext'
import { useEditor } from '@/contexts/EditorContext'
import { TimelineEngine } from '@/lib/editor/timelineUtils'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'

export default function TimelineToolbar() {
    const { settings, toggleSetting, updateSettings, resetSettings } = useTimelineSettings()
    const { clips, tracks, executeCommand } = useEditor()
    const { zoomLevel } = useZoom()
    const [showSettings, setShowSettings] = useState(false)

    const timeScale = getTimeScale(zoomLevel)
    const timelineEngine = new TimelineEngine(clips, tracks, timeScale)

    const handleOptimizeTimeline = () => {
        const commands = timelineEngine.generateOptimizationCommands({
            removeSmallGaps: true,
            alignToGrid: settings.gridSnapping,
            maxGapMs: 500
        })

        if (commands.length > 0) {
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            })
        }
    }

    const gaps = timelineEngine.findGaps()
    const hasGaps = gaps.length > 0

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
            {/* Timeline Mode Indicators */}
            <div className="flex items-center gap-1">
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    settings.magneticSnapping ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                    <Magnet size={14} />
                    <span>Magnetic</span>
                </div>
                
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    settings.rippleEdit ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                    <Move size={14} />
                    <span>Ripple</span>
                </div>
                
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    settings.autoCloseGaps ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                }`}>
                    <AlignLeft size={14} />
                    <span>Auto-Close</span>
                </div>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => toggleSetting('magneticSnapping')}
                    className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                        settings.magneticSnapping ? 'bg-green-100 text-green-700' : 'text-gray-600'
                    }`}
                    title="Toggle Magnetic Snapping"
                >
                    <Magnet size={16} />
                </button>

                <button
                    onClick={() => toggleSetting('gridSnapping')}
                    className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                        settings.gridSnapping ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
                    }`}
                    title="Toggle Grid Snapping"
                >
                    <Grid3X3 size={16} />
                </button>

                <button
                    onClick={() => toggleSetting('rippleEdit')}
                    className={`p-2 rounded hover:bg-gray-200 transition-colors ${
                        settings.rippleEdit ? 'bg-orange-100 text-orange-700' : 'text-gray-600'
                    }`}
                    title="Toggle Ripple Edit"
                >
                    <Scissors size={16} />
                </button>

                <button
                    onClick={handleOptimizeTimeline}
                    disabled={!hasGaps}
                    className={`p-2 rounded transition-colors ${
                        hasGaps 
                            ? 'hover:bg-gray-200 text-gray-600' 
                            : 'text-gray-400 cursor-not-allowed'
                    }`}
                    title={hasGaps ? `Optimize Timeline (${gaps.length} gaps found)` : 'No gaps to optimize'}
                >
                    <Zap size={16} />
                </button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* Settings Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-1 px-3 py-2 rounded hover:bg-gray-200 transition-colors text-gray-600"
                >
                    <Settings size={16} />
                    <span className="text-sm">Settings</span>
                    <ChevronDown size={14} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                </button>

                {showSettings && (
                    <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="p-4">
                            <h3 className="font-semibold text-gray-900 mb-3">Timeline Settings</h3>
                            
                            {/* Snapping Settings */}
                            <div className="space-y-3 mb-4">
                                <h4 className="text-sm font-medium text-gray-700">Snapping</h4>
                                
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Magnetic Snapping</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.magneticSnapping}
                                        onChange={() => toggleSetting('magneticSnapping')}
                                        className="rounded"
                                    />
                                </label>
                                
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Grid Snapping</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.gridSnapping}
                                        onChange={() => toggleSetting('gridSnapping')}
                                        className="rounded"
                                    />
                                </label>
                                
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Show Snap Guides</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.showSnapGuides}
                                        onChange={() => toggleSetting('showSnapGuides')}
                                        className="rounded"
                                    />
                                </label>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">
                                        Snap Threshold: {settings.snapThreshold}px
                                    </label>
                                    <input
                                        type="range"
                                        min="4"
                                        max="20"
                                        value={settings.snapThreshold}
                                        onChange={(e) => updateSettings({ snapThreshold: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">
                                        Grid Snap: {settings.gridSnapMs}ms
                                    </label>
                                    <select
                                        value={settings.gridSnapMs}
                                        onChange={(e) => updateSettings({ gridSnapMs: parseInt(e.target.value) })}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                                    >
                                        <option value={100}>100ms (0.1s)</option>
                                        <option value={250}>250ms (0.25s)</option>
                                        <option value={500}>500ms (0.5s)</option>
                                        <option value={1000}>1000ms (1s)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Editing Settings */}
                            <div className="space-y-3 mb-4">
                                <h4 className="text-sm font-medium text-gray-700">Editing</h4>
                                
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Ripple Edit</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.rippleEdit}
                                        onChange={() => toggleSetting('rippleEdit')}
                                        className="rounded"
                                    />
                                </label>
                                
                                <label className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Auto-Close Gaps</span>
                                    <input
                                        type="checkbox"
                                        checked={settings.autoCloseGaps}
                                        onChange={() => toggleSetting('autoCloseGaps')}
                                        className="rounded"
                                    />
                                </label>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Multi-Select Mode</label>
                                    <select
                                        value={settings.multiSelectMode}
                                        onChange={(e) => updateSettings({ multiSelectMode: e.target.value as 'additive' | 'replace' })}
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                                    >
                                        <option value="additive">Additive (Ctrl+Click)</option>
                                        <option value="replace">Replace</option>
                                    </select>
                                </div>
                            </div>

                            {/* Gap Analysis */}
                            {hasGaps && (
                                <div className="space-y-2 mb-4">
                                    <h4 className="text-sm font-medium text-gray-700">Timeline Analysis</h4>
                                    <div className="text-sm text-gray-600">
                                        Found {gaps.length} gap{gaps.length !== 1 ? 's' : ''} in timeline
                                    </div>
                                    <button
                                        onClick={handleOptimizeTimeline}
                                        className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm"
                                    >
                                        Optimize Timeline
                                    </button>
                                </div>
                            )}

                            {/* Reset */}
                            <div className="pt-3 border-t border-gray-200">
                                <button
                                    onClick={() => {
                                        resetSettings()
                                        setShowSettings(false)
                                    }}
                                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                                >
                                    <RotateCcw size={14} />
                                    Reset to Defaults
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Click outside to close */}
            {showSettings && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSettings(false)}
                />
            )}
        </div>
    )
}
