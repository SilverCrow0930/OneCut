import React, { useState, useRef } from 'react'
import { FileText, Copy, Search, Download, Check } from 'lucide-react'

interface TranscriptionSectionProps {
    transcript: string
    contentType: string
    isExpanded?: boolean
    onToggle?: () => void
}

const TranscriptionSection: React.FC<TranscriptionSectionProps> = ({ 
    transcript, 
    contentType, 
    isExpanded = false, 
    onToggle 
}) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [copied, setCopied] = useState(false)
    const textAreaRef = useRef<HTMLTextAreaElement>(null)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(transcript)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error('Failed to copy transcript:', error)
            // Fallback for older browsers
            if (textAreaRef.current) {
                textAreaRef.current.select()
                document.execCommand('copy')
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            }
        }
    }

    const handleDownload = () => {
        const blob = new Blob([transcript], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transcript-${Date.now()}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const highlightText = (text: string, searchTerm: string) => {
        if (!searchTerm.trim()) return text

        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
        const parts = text.split(regex)

        return parts.map((part, index) => 
            regex.test(part) ? (
                <mark key={index} className="bg-yellow-200 px-1 rounded">
                    {part}
                </mark>
            ) : part
        )
    }

    const formatTranscript = (text: string) => {
        // Add paragraph breaks for better readability
        return text
            .split(/\n\n|\. {2,}/)
            .filter(paragraph => paragraph.trim().length > 0)
            .map((paragraph, index) => (
                <p key={index} className="mb-3 leading-relaxed">
                    {highlightText(paragraph.trim(), searchTerm)}
                </p>
            ))
    }

    const wordCount = transcript.split(/\s+/).filter(word => word.length > 0).length
    const readingTime = Math.ceil(wordCount / 200) // Average reading speed

    return (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div 
                className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={onToggle}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Transcript</h3>
                        <p className="text-sm text-gray-600">
                            {wordCount.toLocaleString()} words • {readingTime} min read
                            {contentType === 'talking_video' && ' • Enhanced with AI analysis'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isExpanded && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDownload()
                                }}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Download transcript"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopy()
                                }}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Copy transcript"
                            >
                                {copied ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                    <Copy className="w-4 h-4" />
                                )}
                            </button>
                        </>
                    )}
                    <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4">
                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search in transcript..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Transcript Content */}
                    <div className="max-h-96 overflow-y-auto">
                        <div className="prose prose-sm max-w-none text-gray-700">
                            {formatTranscript(transcript)}
                        </div>
                    </div>

                    {/* Hidden textarea for fallback copy */}
                    <textarea
                        ref={textAreaRef}
                        value={transcript}
                        readOnly
                        className="sr-only"
                        tabIndex={-1}
                    />

                    {/* Stats */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                                Generated with {contentType === 'talking_video' ? 'enhanced AI transcription' : 'AI transcription'}
                            </span>
                            {searchTerm && (
                                <span>
                                    {(transcript.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length} matches found
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TranscriptionSection 