import React from 'react'
import { LucideIcon } from 'lucide-react'

interface PanelHeaderProps {
    icon: LucideIcon
    title: string
    iconBgColor?: string
    iconColor?: string
}

export default function PanelHeader({
    icon: Icon,
    title,
    iconBgColor = 'bg-blue-50',
    iconColor = 'text-blue-600'
}: PanelHeaderProps) {
    return (
        <div className="flex items-center gap-3 pb-6 border-b border-gray-100">
            <div className={`p-2 ${iconBgColor} rounded-lg`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <span className="text-lg font-semibold text-black/50">{title}</span>
        </div>
    )
} 