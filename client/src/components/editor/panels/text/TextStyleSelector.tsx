import React from 'react'

// Most popular and practical text styles for video content
export const stylePresets = [
    // Essential High-Contrast Styles (Most Used)
    {
        name: 'White on Black',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'black',
            padding: '8px 16px',
            borderRadius: '4px',
        },
    },
    {
        name: 'Black on White',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'black', 
            background: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid #ddd',
        },
    },
    {
        name: 'White with Black Outline',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'none',
            WebkitTextStroke: '2px black',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
        },
    },
    {
        name: 'Black with White Outline',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'black', 
            background: 'none',
            WebkitTextStroke: '2px white',
            textShadow: '2px 2px 4px rgba(255,255,255,0.8)',
        },
    },

    // Popular Modern Fonts
    {
        name: 'Montserrat Bold',
        style: {
            fontFamily: 'Montserrat, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'rgba(0,0,0,0.8)',
            padding: '8px 16px',
            borderRadius: '8px',
        },
    },
    {
        name: 'Roboto Medium',
        style: {
            fontFamily: 'Roboto, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'rgba(0,0,0,0.7)',
            padding: '6px 12px',
            borderRadius: '6px',
        },
    },
    {
        name: 'Open Sans',
        style: {
            fontFamily: 'Open Sans, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'black', 
            background: 'rgba(255,255,255,0.9)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #ddd',
        },
    },
    {
        name: 'Poppins',
        style: {
            fontFamily: 'Poppins, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'rgba(0,0,0,0.75)',
            padding: '8px 16px',
            borderRadius: '10px',
        },
    },

    // Alert & Notification Styles
    {
        name: 'Yellow Alert',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'black', 
            background: '#FFFF00',
            padding: '6px 12px',
            borderRadius: '4px',
        },
    },
    {
        name: 'Red Alert',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#FF0000',
            padding: '6px 12px',
            borderRadius: '4px',
        },
    },
    {
        name: 'Blue Info',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#0066CC',
            padding: '6px 12px',
            borderRadius: '4px',
        },
    },
    {
        name: 'Green Success',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#009900',
            padding: '6px 12px',
            borderRadius: '4px',
        },
    },

    // Social Media Styles
    {
        name: 'Instagram Story',
        style: {
            fontFamily: 'Helvetica, Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
            padding: '8px 16px',
            borderRadius: '12px',
        },
    },
    {
        name: 'TikTok Style',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'none',
            WebkitTextStroke: '3px black',
            textShadow: '3px 3px 0px #FF0050, -3px -3px 0px #00F5FF',
        },
    },
    {
        name: 'YouTube Thumbnail',
        style: {
            fontFamily: 'Impact, Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'white', 
            background: 'none',
            WebkitTextStroke: '3px red',
            textShadow: '3px 3px 6px rgba(0,0,0,0.8)',
        },
    },
    {
        name: 'Clean Minimal',
        style: {
            fontFamily: 'Roboto, sans-serif', 
            fontSize: 20, 
            fontWeight: 400, 
            textTransform: 'none' as 'none', 
            color: '#2C3E50', 
            background: 'rgba(255,255,255,0.95)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #E0E0E0',
        },
    },

    // Professional Styles
    {
        name: 'Corporate',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#333333', 
            background: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            border: '2px solid #333333',
        },
    },
    {
        name: 'News Breaking',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'white', 
            background: '#CC0000',
            padding: '4px 12px',
            borderRadius: '2px',
        },
    },
    {
        name: 'Subtitle Style',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'rgba(0,0,0,0.6)',
            padding: '6px 12px',
            borderRadius: '20px',
        },
    },
    {
        name: 'Title Card',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 800, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'black', 
            background: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            border: '3px solid black',
        },
    },

    // Creative & Trendy Styles
    {
        name: 'Neon Glow',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#00FFFF', 
            background: 'rgba(0,0,0,0.8)',
            padding: '6px 12px',
            borderRadius: '4px',
            textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF',
        },
    },
    {
        name: 'Retro Gaming',
        style: {
            fontFamily: 'Courier New, monospace', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#00FF00', 
            background: 'rgba(0,0,0,0.9)',
            padding: '4px 8px',
            borderRadius: '2px',
        },
    },
    {
        name: 'Modern Gradient',
        style: {
            fontFamily: 'Roboto, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '8px 16px',
            borderRadius: '8px',
        },
    },
    {
        name: 'Orange Punch',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#FF4500',
            padding: '6px 12px',
            borderRadius: '6px',
        },
    },
]

interface TextStyleSelectorProps {
    selectedStyleIdx: number
    setSelectedStyleIdx: (idx: number) => void
    className?: string
}

export default function TextStyleSelector({ selectedStyleIdx, setSelectedStyleIdx, className }: TextStyleSelectorProps) {
    return (
        <div className={className}>
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto elegant-scrollbar">
                {stylePresets.map((preset, i) => (
                    <button
                        key={preset.name}
                        type="button"
                        className={`
                            bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-center transition-all duration-200 h-16 text-sm font-medium
                            ${selectedStyleIdx === i ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' : 'hover:bg-gray-50 hover:border-blue-300 shadow-sm hover:shadow-md'}
                        `}
                        style={{
                            ...preset.style,
                            fontSize: 12, // Smaller for better preview fit
                            padding: '4px 8px', // Reduced padding for preview
                            ...(preset.style.WebkitTextStroke ? { WebkitTextStroke: preset.style.WebkitTextStroke } : {}),
                            ...(preset.style.textShadow ? { textShadow: preset.style.textShadow } : {}),
                            background: preset.style.background !== 'none' ? preset.style.background : 'transparent'
                        }}
                        onClick={() => setSelectedStyleIdx(i)}
                        title={preset.name}
                    >
                        {preset.name}
                    </button>
                ))}
            </div>
        </div>
    )
} 