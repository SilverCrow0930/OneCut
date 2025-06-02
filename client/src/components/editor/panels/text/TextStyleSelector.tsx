import React from 'react'

// Style presets based on trending short form video styles
export const stylePresets = [
    // 1. TikTok Classic - Bold white with black outline
    {
        name: 'TikTok Bold',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'none',
            WebkitTextStroke: '2px black', 
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
        },
    },
    // 2. Instagram Story - Thin font on gradient
    {
        name: 'Insta Story',
        style: {
            fontFamily: 'Helvetica, sans-serif', 
            fontSize: 20, 
            fontWeight: 300, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
            padding: '8px 16px',
            borderRadius: '20px',
        },
    },
    // 3. YouTube Shorts - Bold red on white
    {
        name: 'YT Shorts',
        style: {
            fontFamily: 'Roboto, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#FF0000', 
            background: 'white',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '2px solid #FF0000',
        },
    },
    // 4. Neon Glow - Electric blue
    {
        name: 'Neon Glow',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#00FFFF', 
            background: 'none',
            textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF, 0 0 30px #00FFFF',
        },
    },
    // 5. Retro Bubble - 80s style
    {
        name: 'Retro Bubble',
        style: {
            fontFamily: 'Comic Sans MS, cursive', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: '#FF1493', 
            background: 'white',
            padding: '8px 16px',
            borderRadius: '25px',
            border: '3px solid #FF1493',
            textShadow: '2px 2px 0px #FFB6C1',
        },
    },
    // 6. Gaming Style - Green matrix
    {
        name: 'Gaming',
        style: {
            fontFamily: 'Courier New, monospace', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#00FF00', 
            background: 'black',
            padding: '6px 12px',
            textShadow: '0 0 10px #00FF00',
        },
    },
    // 7. Minimalist - Clean and simple
    {
        name: 'Minimal',
        style: {
            fontFamily: 'Helvetica, sans-serif', 
            fontSize: 20, 
            fontWeight: 400, 
            textTransform: 'none' as 'none', 
            color: '#333333', 
            background: 'rgba(255,255,255,0.9)',
            padding: '4px 8px',
            borderRadius: '4px',
        },
    },
    // 8. Fire Text - Orange/red gradient
    {
        name: 'Fire',
        style: {
            fontFamily: 'Impact, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'transparent', 
            background: 'linear-gradient(45deg, #FF4500, #FFD700)',
            WebkitBackgroundClip: 'text',
            textShadow: '2px 2px 4px rgba(255,69,0,0.7)',
        },
    },
    // 9. Kawaii - Cute pink style
    {
        name: 'Kawaii',
        style: {
            fontFamily: 'Comic Sans MS, cursive', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#FF69B4', 
            background: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            border: '2px solid #FFB6C1',
            textShadow: '1px 1px 2px rgba(255,182,193,0.5)',
        },
    },
    // 10. Cyberpunk - Purple neon
    {
        name: 'Cyberpunk',
        style: {
            fontFamily: 'Orbitron, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#9D4EDD', 
            background: 'black',
            padding: '6px 12px',
            textShadow: '0 0 15px #9D4EDD, 0 0 25px #9D4EDD',
            border: '1px solid #9D4EDD',
        },
    },
    // 11. Nature - Earth tones
    {
        name: 'Nature',
        style: {
            fontFamily: 'Georgia, serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: '#2D5016', 
            background: 'rgba(173,223,173,0.8)',
            padding: '6px 12px',
            borderRadius: '12px',
        },
    },
    // 12. Anime - Bold manga style
    {
        name: 'Anime',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'white', 
            background: 'none',
            WebkitTextStroke: '3px black', 
            textShadow: '3px 3px 0px #FF6B6B, -1px -1px 0px #4ECDC4',
        },
    },
    // 13. Luxury - Gold elegant
    {
        name: 'Luxury',
        style: {
            fontFamily: 'Times New Roman, serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: '#FFD700', 
            background: 'black',
            padding: '8px 16px',
            textShadow: '2px 2px 4px rgba(255,215,0,0.5)',
            border: '2px solid #FFD700',
        },
    },
    // 14. Street Art - Graffiti style
    {
        name: 'Street',
        style: {
            fontFamily: 'Impact, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#FF4500', 
            background: 'none',
            WebkitTextStroke: '2px white', 
            textShadow: '4px 4px 0px black, 2px 2px 0px #FF4500',
        },
    },
    // 15. Ocean - Blue gradient
    {
        name: 'Ocean',
        style: {
            fontFamily: 'Verdana, sans-serif', 
            fontSize: 20, 
            fontWeight: 600, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '8px 16px',
            borderRadius: '15px',
        },
    },
    // 16. Vintage - Old school
    {
        name: 'Vintage',
        style: {
            fontFamily: 'Georgia, serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#8B4513', 
            background: '#F5DEB3',
            padding: '6px 12px',
            border: '2px solid #8B4513',
            textShadow: '1px 1px 2px rgba(139,69,19,0.3)',
        },
    },
    // 17. Pop Art - Bright and bold
    {
        name: 'Pop Art',
        style: {
            fontFamily: 'Arial Black, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'uppercase' as 'uppercase', 
            color: '#FF1493', 
            background: '#FFFF00',
            padding: '6px 12px',
            border: '3px solid black',
            textShadow: '3px 3px 0px black',
        },
    },
    // 18. Holographic - Rainbow effect
    {
        name: 'Holo',
        style: {
            fontFamily: 'Arial, sans-serif', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'transparent', 
            background: 'linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)',
            WebkitBackgroundClip: 'text',
            textShadow: '0 0 10px rgba(255,255,255,0.8)',
        },
    },
    // 19. Meme - Internet culture
    {
        name: 'Meme',
        style: {
            fontFamily: 'Impact, sans-serif', 
            fontSize: 20, 
            fontWeight: 900, 
            textTransform: 'uppercase' as 'uppercase', 
            color: 'white', 
            background: 'none',
            WebkitTextStroke: '2px black', 
            textShadow: '2px 2px 0px black, -2px -2px 0px black, 2px -2px 0px black, -2px 2px 0px black',
        },
    },
    // 20. Sunset - Warm gradient
    {
        name: 'Sunset',
        style: {
            fontFamily: 'Brush Script MT, cursive', 
            fontSize: 20, 
            fontWeight: 700, 
            textTransform: 'none' as 'none', 
            color: 'white', 
            background: 'linear-gradient(45deg, #ff6b6b, #ffa500, #ff1493)',
            padding: '8px 16px',
            borderRadius: '20px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
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
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {stylePresets.map((preset, i) => (
                    <button
                        key={preset.name}
                        type="button"
                        className={`
                            border rounded-md p-2 flex items-center justify-center transition-colors h-12 text-xs
                            ${selectedStyleIdx === i ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:bg-blue-100'}
                        `}
                        style={{
                            ...preset.style,
                            fontSize: 12, // Smaller font for preview
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