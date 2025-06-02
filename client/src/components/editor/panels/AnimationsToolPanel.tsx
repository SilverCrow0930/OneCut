import React, { useState } from 'react'

const AnimationsToolPanel = () => {

    return (
        <div className="flex flex-col w-full gap-4 p-4">
            <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold text-gray-800">Animations</h3>
                <p className="text-sm text-gray-600">Add smooth transitions and animations to your clips</p>
            </div>
            
            <div className="flex flex-col gap-4">
                {/* Coming soon placeholder */}
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                    <div className="text-4xl mb-3">🎭</div>
                    <h4 className="text-base font-medium text-gray-700 mb-2">Coming Soon</h4>
                    <p className="text-sm text-gray-500 text-center">
                        Animation tools are in development
                    </p>
                </div>
            </div>
        </div>
    )
}

export default AnimationsToolPanel 