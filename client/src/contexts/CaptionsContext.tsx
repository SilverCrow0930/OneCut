import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface Caption {
    id: number
    startTime: string
    endTime: string
    text: string
    highlightedHtml?: string
}

export interface CaptionStyle {
    fontFamily: string
    fontSize: number
    fontWeight: number
    color: string
    textAlign: 'left' | 'center' | 'right'
    WebkitTextStroke: string
    textShadow: string
    textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
    letterSpacing: string
    [key: string]: any
}

interface CaptionsContextType {
    // Caption data
    captions: Caption[]
    setCaptions: React.Dispatch<React.SetStateAction<Caption[]>>
    
    // Style settings
    selectedStyleCategory: 'long' | 'short'
    setSelectedStyleCategory: (category: 'long' | 'short') => void
    selectedLongStyleIdx: number
    setSelectedLongStyleIdx: (idx: number) => void
    selectedShortStyleIdx: number
    setSelectedShortStyleIdx: (idx: number) => void
    useCustomStyle: boolean
    setUseCustomStyle: (use: boolean) => void
    customStyle: CaptionStyle
    setCustomStyle: React.Dispatch<React.SetStateAction<CaptionStyle>>
    
    // Placement
    selectedPlacement: string
    setSelectedPlacement: (placement: string) => void
    
    // Workflow state
    workflowPhase: 'initial' | 'generating' | 'editing' | 'styling'
    setWorkflowPhase: (phase: 'initial' | 'generating' | 'editing' | 'styling') => void
    
    // Track selection
    selectedTrackId: string | null
    setSelectedTrackId: (trackId: string | null) => void
    
    // Reset function
    resetCaptions: () => void
}

const CaptionsContext = createContext<CaptionsContextType | undefined>(undefined)

const defaultCustomStyle: CaptionStyle = {
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fontSize: 32,
    fontWeight: 900,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    WebkitTextStroke: '3px #000000',
    textShadow: '3px 3px 0px rgba(0, 0, 0, 0.8)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
}

export function CaptionsProvider({ children }: { children: ReactNode }) {
    // Caption data
    const [captions, setCaptions] = useState<Caption[]>([])
    
    // Style settings
    const [selectedStyleCategory, setSelectedStyleCategory] = useState<'long' | 'short'>('long')
    const [selectedLongStyleIdx, setSelectedLongStyleIdx] = useState(0)
    const [selectedShortStyleIdx, setSelectedShortStyleIdx] = useState(0)
    const [useCustomStyle, setUseCustomStyle] = useState(false)
    const [customStyle, setCustomStyle] = useState<CaptionStyle>(defaultCustomStyle)
    
    // Placement
    const [selectedPlacement, setSelectedPlacement] = useState('bottom')
    
    // Workflow state
    const [workflowPhase, setWorkflowPhase] = useState<'initial' | 'generating' | 'editing' | 'styling'>('initial')
    
    // Track selection
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
    
    const resetCaptions = () => {
        setCaptions([])
        setWorkflowPhase('initial')
        setSelectedTrackId(null)
        // Keep style settings - don't reset them
    }

    const value: CaptionsContextType = {
        captions,
        setCaptions,
        selectedStyleCategory,
        setSelectedStyleCategory,
        selectedLongStyleIdx,
        setSelectedLongStyleIdx,
        selectedShortStyleIdx,
        setSelectedShortStyleIdx,
        useCustomStyle,
        setUseCustomStyle,
        customStyle,
        setCustomStyle,
        selectedPlacement,
        setSelectedPlacement,
        workflowPhase,
        setWorkflowPhase,
        selectedTrackId,
        setSelectedTrackId,
        resetCaptions,
    }

    return (
        <CaptionsContext.Provider value={value}>
            {children}
        </CaptionsContext.Provider>
    )
}

export function useCaptions() {
    const context = useContext(CaptionsContext)
    if (context === undefined) {
        throw new Error('useCaptions must be used within a CaptionsProvider')
    }
    return context
} 