import React from 'react'
import { TOOLS } from '@/lib/constants'
import ToolButton from './buttons/ToolButton'

interface ToolBarProps {
    selectedTool: string | null
    onToolSelect: (tool: string) => void
}

const ToolBar = ({ selectedTool, onToolSelect }: ToolBarProps) => {
    return (
        <div className="flex flex-col items-center w-fit h-full p-1 gap-0.5">
            {
                TOOLS.map(
                    (tool, index) => (
                        <ToolButton
                            key={index}
                            label={tool.label}
                            icon={tool.icon}
                            onClick={() => onToolSelect(tool.label)}
                            isSelected={selectedTool === tool.label}
                            aiTool={tool.aiTool}
                        />
                    ))
            }
        </div>
    )
}

export default ToolBar