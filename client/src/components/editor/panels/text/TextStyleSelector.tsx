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
]

interface TextStyleSelectorProps {
    selectedStyleIdx: number
    setSelectedStyleIdx: (idx: number) => void
    className?: string
}

export default function TextStyleSelector({ selectedStyleIdx, setSelectedStyleIdx, className }: TextStyleSelectorProps) {
    return (
        <div className={className}>
            <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
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