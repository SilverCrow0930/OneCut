import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
    hasError: boolean
    error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details
        console.error('ClipLayer Error Boundary caught an error:', error, errorInfo)
        
        // Call optional error handler
        this.props.onError?.(error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback
            }

            // Default fallback UI
            return (
                <div className="flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-center">
                        <div className="text-red-600 text-sm font-medium mb-2">
                            ⚠️ Video Playback Error
                        </div>
                        <div className="text-red-500 text-xs mb-3">
                            {this.state.error?.message || 'An error occurred while rendering this clip'}
                        </div>
                        <button
                            onClick={() => this.setState({ hasError: false, error: undefined })}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
} 