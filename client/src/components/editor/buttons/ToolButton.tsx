import React from 'react'

interface ToolButtonProps {
    label: string
    icon: string
    onClick: () => void
    isSelected: boolean
    aiTool: boolean
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon, onClick, isSelected, aiTool }) => {
    return (
        <button
            className={`
                relative flex flex-col items-center justify-center gap-1 w-16 h-16 
                rounded-lg transition-all duration-300 ease-out
                ${isSelected 
                    ? 'bg-blue-100 shadow-md border border-blue-200 scale-105' 
                    : 'hover:bg-gray-100/70 hover:shadow-sm hover:scale-102 border border-transparent'
                }
                cursor-pointer group
            `}
            onClick={onClick}
        >
            {
                aiTool && (
                    <div className="absolute top-1 right-1">
                        <div className="text-[13px] font-semibold text-black opacity-70 bg-white/80 px-1 py-0.5 rounded-full">
                            AI
                        </div>
                    </div>
                )
            }
            <img 
                src={icon} 
                alt={label} 
                className={`w-6 h-6 object-contain transition-all duration-300 ${
                    isSelected ? 'opacity-90' : 'opacity-70 group-hover:opacity-85'
                }`} 
            />
            <p className={`text-[13px] font-medium transition-all duration-300 ${
                isSelected 
                    ? 'text-blue-700 opacity-90' 
                    : 'text-black opacity-70 group-hover:opacity-85'
            }`}>
                {label}
            </p>
        </button>
    )
}

export default ToolButton