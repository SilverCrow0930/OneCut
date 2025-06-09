import React from 'react'
import { Zap } from 'lucide-react'
import UnifiedQuickClips from '@/components/shared/UnifiedQuickClips'

const QuickClipsButton = () => {
    return (
        <UnifiedQuickClips 
            mode="modal" 
            showAsButton={true}
        />
    )
}

export default QuickClipsButton 