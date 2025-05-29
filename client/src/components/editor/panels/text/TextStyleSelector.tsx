import React from 'react'

// Style presets based on the provided table
export const stylePresets = [
    {
        name: 'Montserrat',
        style: {
            fontFamily: 'Montserrat, sans-serif', fontSize: 20, fontWeight: 700, textTransform: 'none' as 'none', color: 'black', background: 'none',
        },
    },
    {
        name: 'PT-Serif',
        style: {
            fontFamily: 'PT Serif, serif', fontSize: 20, fontWeight: 700, textTransform: 'none' as 'none', color: 'black', background: 'yellow', textShadow: '1px 1px 2px rgba(0,0,0,0.15)',
        },
    },
    {
        name: 'Poppins',
        style: {
            fontFamily: 'Poppins, sans-serif', fontSize: 20, fontWeight: 700, textTransform: 'none' as 'none', color: 'white', background: 'none', WebkitTextStroke: '1px black', textShadow: '1px 1px 2px rgba(0,0,0,0.15)',
        },
    },
    {
        name: 'Open Sans (Uppercase)',
        style: {
            fontFamily: 'Open Sans, sans-serif', fontSize: 20, fontWeight: 700, textTransform: 'uppercase' as 'uppercase', color: 'white', background: 'black',
        },
    },
    {
        name: 'Open Sans (Medium)',
        style: {
            fontFamily: 'Open Sans, sans-serif', fontSize: 20, fontWeight: 500, textTransform: 'none' as 'none', color: 'black', background: 'white',
        },
    },
    {
        name: 'Oswald',
        style: {
            fontFamily: 'Oswald, sans-serif', fontSize: 20, fontWeight: 700, textTransform: 'uppercase' as 'uppercase', color: 'yellow', background: 'black',
        },
    },
    {
        name: 'Roboto',
        style: {
            fontFamily: 'Roboto, sans-serif', fontSize: 20, fontWeight: 500, textTransform: 'none' as 'none', color: 'yellow', background: 'none', WebkitTextStroke: '1px black', textShadow: '1px 1px 2px rgba(0,0,0,0.15)',
        },
    },
    {
        name: 'Montserrat (Red)',
        style: {
            fontFamily: 'Montserrat, sans-serif', fontSize: 20, fontWeight: 700, textTransform: 'uppercase' as 'uppercase', color: 'red', background: 'none', WebkitTextStroke: '1px black', textShadow: '1px 1px 2px rgba(0,0,0,0.15)',
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
            <div className="grid grid-cols-2 gap-2">
                {stylePresets.map((preset, i) => (
                    <button
                        key={preset.name}
                        type="button"
                        className={`
                            border rounded-md p-2 flex items-center justify-center transition-colors h-16 
                            ${selectedStyleIdx === i ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:bg-blue-100'}
                        `}
                        style={{
                            ...preset.style,
                            fontSize: 22,
                            ...(preset.style.WebkitTextStroke ? { WebkitTextStroke: preset.style.WebkitTextStroke } : {}),
                            ...(preset.style.textShadow ? { textShadow: preset.style.textShadow } : {}),
                            background: preset.style.background !== 'none' ? preset.style.background : undefined
                        }}
                        onClick={() => setSelectedStyleIdx(i)}
                    >
                        Text
                    </button>
                ))}
            </div>
        </div>
    )
} 