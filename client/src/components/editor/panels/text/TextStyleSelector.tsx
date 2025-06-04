import React from 'react'

// Style presets - practical styles everyone actually uses
export const stylePresets = [
    // Essential high-contrast combinations
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
        },
    },
    {
        name: 'White Outline',
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
        name: 'Black Outline',
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
    
    // Popular font combinations
    {
        name: 'Roboto Bold',
        style: {
            fontFamily: 'Roboto, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
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
        },
    },
    {
        name: 'Montserrat',
        style: {
            fontFamily: 'Montserrat, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'rgba(0,0,0,0.8)',
            padding: '8px 16px',
            borderRadius: '8px',
        },
    },
    {
        name: 'Helvetica',
        style: {
            fontFamily: 'Helvetica, Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'black', 
            background: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
        },
    },

    // Attention-grabbing but practical
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

    // Subtle and clean options
    {
        name: 'Gray Subtitle',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 400, 
            textTransform: 'none' as 'none', 
            color: '#666666', 
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 8px',
            borderRadius: '4px',
        },
    },
    {
        name: 'Light Gray',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'rgba(0,0,0,0.5)',
            padding: '6px 12px',
            borderRadius: '6px',
        },
    },
    {
        name: 'Clean White',
        style: {
            fontFamily: 'Helvetica, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'none',
            textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
        },
    },
    {
        name: 'Clean Black',
        style: {
            fontFamily: 'Helvetica, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'black', 
            background: 'none',
            textShadow: '1px 1px 3px rgba(255,255,255,0.8)',
        },
    },

    // Professional options
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
            borderRadius: '8px',
            border: '2px solid #333333',
        },
    },
    {
        name: 'News',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'white', 
            background: '#CC0000',
            padding: '4px 12px',
            borderRadius: '0px',
        },
    },
    {
        name: 'Caption',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 400, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'rgba(0,0,0,0.6)',
            padding: '6px 12px',
            borderRadius: '20px',
        },
    },
    {
        name: 'Title',
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
    
    // Social Media & Modern Styles
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
            WebkitTextStroke: '4px red',
            textShadow: '4px 4px 8px rgba(0,0,0,0.8)',
        },
    },
    {
        name: 'Minimalist',
        style: {
            fontFamily: 'Roboto, sans-serif', 
            fontSize: 20, 
            fontWeight: 300, 
            textTransform: 'lowercase' as 'lowercase', 
            color: '#2C3E50', 
            background: 'rgba(255,255,255,0.95)',
            padding: '6px 12px',
            borderRadius: '2px',
        },
    },

    // Educational & Tutorial Styles
    {
        name: 'Highlight Box',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#8B4513', 
            background: '#FFF8DC',
            padding: '8px 16px',
            borderRadius: '6px',
            border: '2px solid #DAA520',
        },
    },
    {
        name: 'Tutorial Step',
        style: {
            fontFamily: 'Verdana, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#4A90E2',
            padding: '6px 12px',
            borderRadius: '16px',
        },
    },
    {
        name: 'Warning',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#8B4513', 
            background: '#FFE4B5',
            padding: '6px 12px',
            borderRadius: '4px',
            border: '2px solid #FF8C00',
        },
    },
    {
        name: 'Quote',
        style: {
            fontFamily: 'Georgia, serif', 
            fontSize: 20, 
            fontWeight: 400, 
            textTransform: 'none' as 'none', 
            color: '#2F4F4F', 
            background: 'rgba(240,248,255,0.9)',
            padding: '10px 16px',
            borderRadius: '8px',
            fontStyle: 'italic',
            borderLeft: '4px solid #4682B4',
        },
    },

    // Business & Professional Extended
    {
        name: 'Executive',
        style: {
            fontFamily: 'Times New Roman, serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#1A1A1A', 
            background: '#F8F8FF',
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid #4169E1',
        },
    },
    {
        name: 'Modern Tech',
        style: {
            fontFamily: 'Courier New, monospace', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: '#00FF41', 
            background: 'rgba(0,0,0,0.9)',
            padding: '8px 12px',
            borderRadius: '4px',
        },
    },
    {
        name: 'Startup',
        style: {
            fontFamily: 'San Francisco, Roboto, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '8px 16px',
            borderRadius: '8px',
        },
    },

    // Color Variations & Popular Combinations
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
    {
        name: 'Purple Modern',
        style: {
            fontFamily: 'Helvetica, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#8A2BE2',
            padding: '8px 16px',
            borderRadius: '10px',
        },
    },
    {
        name: 'Teal Fresh',
        style: {
            fontFamily: 'Open Sans, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#20B2AA',
            padding: '6px 12px',
            borderRadius: '8px',
        },
    },
    {
        name: 'Pink Vibrant',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: '#FF1493',
            padding: '6px 12px',
            borderRadius: '6px',
        },
    },

    // Specialty & Creative Styles
    {
        name: 'Retro Gaming',
        style: {
            fontFamily: 'Courier New, monospace', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#00FF00', 
            background: 'black',
            padding: '4px 8px',
            borderRadius: '0px',
        },
    },
    {
        name: 'Neon Glow',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#00FFFF', 
            background: 'black',
            padding: '6px 12px',
            borderRadius: '4px',
            textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF',
        },
    },
    {
        name: 'Elegant Script',
        style: {
            fontFamily: 'Brush Script MT, cursive', 
            fontSize: 20, 
            fontWeight: 400, 
            textTransform: 'none' as 'none', 
            color: '#4B0082', 
            background: 'rgba(255,255,255,0.9)',
            padding: '8px 16px',
            borderRadius: '12px',
        },
    },
    {
        name: 'Sports Bold',
        style: {
            fontFamily: 'Impact, Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'white', 
            background: 'linear-gradient(45deg, #FF6B35, #F7931E)',
            padding: '6px 12px',
            borderRadius: '4px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
        },
    },
    {
        name: 'Soft Pastel',
        style: {
            fontFamily: 'Comic Sans MS, sans-serif', 
            fontSize: 20, 
            fontWeight: 500, 
            textTransform: 'none' as 'none', 
            color: '#8B4789', 
            background: 'rgba(230,230,250,0.9)',
            padding: '8px 16px',
            borderRadius: '16px',
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
                            border rounded-lg p-3 flex items-center justify-center transition-all duration-200 h-16 text-sm font-medium
                            ${selectedStyleIdx === i ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' : 'hover:bg-blue-50 hover:border-blue-300 shadow-sm hover:shadow-md'}
                        `}
                        style={{
                            ...preset.style,
                            fontSize: 14, // Better readability
                            ...(preset.style.WebkitTextStroke ? { WebkitTextStroke: preset.style.WebkitTextStroke } : {}),
                            ...(preset.style.textShadow ? { textShadow: preset.style.textShadow } : {}),
                            background: preset.style.background !== 'none' ? preset.style.background : undefined
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