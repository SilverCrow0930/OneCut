import { CloudAlert, CloudOff, CloudRainWind, CloudUpload } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'

export default function SaveStatusIndicator() {
    const { saveState } = useEditor()

    let icon, label, extraClass = ''

    switch (saveState) {
        case 'error':
            icon = <CloudAlert />
            label = 'Error saving timeline'
            break
        case 'saving':
            icon = <CloudUpload />
            label = 'Saving…'
            break
        case 'unsaved':
            icon = <CloudOff />
            label = 'Unsaved changes'
            break
        case 'saved':
        default:
            icon = <CloudRainWind />
            label = 'All changes saved'
    }

    return (
        <div
            className={`
                flex items-center gap-1 text-sm
                select-none ${extraClass}
            `}
            title={label}
        >
            {icon}
            <span className="hidden sm:inline">
                {label}
            </span>
        </div>
    )
}
