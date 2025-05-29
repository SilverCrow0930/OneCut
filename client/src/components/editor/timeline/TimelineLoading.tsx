import React from 'react'

export default function TimelineLoading() {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white">
            <div className="relative w-10 h-10 mb-3">
                {/* Outer ring */}
                <div className="absolute inset-0 border-3 border-gray-200 rounded-full"></div>
                {/* Animated ring */}
                <div className="absolute inset-0 border-3 border-t-cyan-500 rounded-full animate-spin"></div>
            </div>
            <div className="flex flex-col items-center">
                <h3 className="text-base font-medium text-gray-700 mb-1.5">Loading Timeline</h3>
                <div className="flex space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        </div>
    )
} 