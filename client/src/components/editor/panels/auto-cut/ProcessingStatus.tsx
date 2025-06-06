import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';

interface ProcessingStatusProps {
    processingState: 'idle' | 'starting' | 'generatingurl' | 'analyzing' | 'completed' | 'error';
    isUploading: boolean;
    uploadProgress: number;
    processingMessage: string;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
    processingState,
    isUploading,
    uploadProgress,
    processingMessage
}) => {
    return (
        <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
                {processingState === 'completed' ? (
                    <div className="relative">
                        <CheckCircle2 className="w-5 h-5 text-green-500 animate-bounce" />
                        <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                ) : processingState === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-500 animate-pulse" />
                ) : (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                <span className="text-sm text-gray-600">
                    {isUploading ? 'Uploading video...' : processingMessage}
                </span>
                {isUploading && <span className="text-sm text-gray-500">{uploadProgress}%</span>}
            </div>
            {isUploading && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                    />
                </div>
            )}
            {/* Indeterminate bar for analyzing state */}
            {processingState === 'analyzing' && !isUploading && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden relative">
                    <div
                        className="absolute left-0 top-0 h-full bg-blue-400/60 rounded-full"
                        style={{
                            width: '30%',
                            animation: 'indeterminate-bar 1.2s linear infinite'
                        }}
                    />
                    <style>{`
                        @keyframes indeterminate-bar {
                            0% { left: -30%; }
                            100% { left: 100%; }
                        }
                    `}</style>
                </div>
            )}
            {/* Determinate bar for other processing states */}
            {processingState !== 'idle' && !isUploading && processingState !== 'analyzing' && (
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={
                            `h-full transition-all duration-300 ease-out ` +
                            (processingState === 'completed' ? 'bg-green-500' :
                                processingState === 'error' ? 'bg-red-500' :
                                    'bg-blue-500 animate-pulse')
                        }
                        style={{ width: processingState === 'completed' ? '100%' : '90%' }}
                    />
                </div>
            )}
        </div>
    );
}; 