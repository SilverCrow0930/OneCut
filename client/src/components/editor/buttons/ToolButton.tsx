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
                relative flex flex-col items-center justify-center gap-1 w-16 h-16 duration-500
                ${isSelected ? 'bg-blue-200 hover:bg-blue-200' : 'hover:bg-blue-100'}
                cursor-pointer
            `}
            onClick={onClick}
        >
            {
                aiTool && (
                    <div className="absolute top-1 right-2">
                        <div className="text-xs font-medium">
                            AI
                        </div>
                    </div>
                )
            }
            <img src={icon} alt={label} className='w-5 h-5 object-contain' />
            <p className='text-[10px]'>{label}</p>
        </button>
    )
}

export default ToolButton