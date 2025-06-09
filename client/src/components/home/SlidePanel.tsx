import React from 'react'

interface SlidePanelProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
}

const SlidePanel = ({ isOpen, onClose, children }: SlidePanelProps) => {
    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                    onClick={onClose}
                />
            )}
            
            {/* Panel */}
            <div className={`
                fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-50
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                {children}
            </div>
        </>
    )
}

export default SlidePanel 