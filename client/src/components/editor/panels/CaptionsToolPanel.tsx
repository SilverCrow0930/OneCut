import React, { useState } from 'react'

const CaptionsToolPanel = () => {

    return (
        <div className="flex flex-col w-full gap-4 p-4">
            <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold text-gray-800">Captions</h3>
                <p className="text-sm text-gray-600">Generate AI-powered captions for your videos</p>
            </div>
            
            <div className="flex flex-col gap-4">
                {/* AI Caption Generation */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-base font-medium text-gray-700">Auto-Generate Captions</h4>
                    <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                        Generate Captions with AI
                    </button>
                </div>

                {/* Caption Settings */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-base font-medium text-gray-700">Caption Style</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Bottom Center
                        </button>
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Top Center
                        </button>
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Custom Position
                        </button>
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Animated
                        </button>
                    </div>
                </div>

                {/* Font Options */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-base font-medium text-gray-700">Font Style</h4>
                    <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                        <option>Arial</option>
                        <option>Helvetica</option>
                        <option>Times New Roman</option>
                        <option>Roboto</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

export default CaptionsToolPanel