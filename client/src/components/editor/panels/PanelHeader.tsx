import React from 'react'
import { LucideIcon } from 'lucide-react'

interface PanelHeaderProps {
    icon: LucideIcon
    title: string
    description?: string
    iconBgColor?: string
    iconColor?: string
}

export default function PanelHeader({
    icon: Icon,
    title,
    description,
    iconBgColor = 'bg-blue-50',
    iconColor = 'text-blue-600'
}: PanelHeaderProps) {
    return (
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <div className={`p-1.5 ${iconBgColor} rounded-md`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-semibold text-black/50">{title}</span>
                {description && (
                    <span className="text-xs text-gray-500">{description}</span>
                )}
            </div>
        </div>
    )
} 