import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Sparkles, Play, Download, Eye } from 'lucide-react';

interface ProcessingStatusProps {
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    message: string;
    error?: string;
    clips?: Array<{
        id: string;
        title: string;
        description: string;
        duration: number;
        downloadUrl: string;
        previewUrl: string;
        thumbnailUrl: string;
        size: {
            width: number;
            height: number;
        };
    }>;
    onPreviewClip?: (clipId: string) => void;
}

const ProcessingStatus = ({ status, progress, message, error, clips, onPreviewClip }: ProcessingStatusProps) => {
    const getStatusDisplay = () => {
        switch (status) {
            case 'queued':
                return {
                    icon: <Loader2 className="w-5 h-5 animate-spin text-blue-600" />,
                    title: 'Queued for Processing',
                    color: 'bg-blue-50 border-blue-200'
                };
            case 'processing':
                return {
                    icon: <Loader2 className="w-5 h-5 animate-spin text-blue-600" />,
                    title: 'Processing Video',
                    color: 'bg-blue-50 border-blue-200'
                };
            case 'completed':
                return {
                    icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
                    title: 'Processing Complete',
                    color: 'bg-green-50 border-green-200'
                };
            case 'failed':
                return {
                    icon: <AlertCircle className="w-5 h-5 text-red-600" />,
                    title: 'Processing Failed',
                    color: 'bg-red-50 border-red-200'
                };
            default:
                return {
                    icon: null,
                    title: 'Ready to Process',
                    color: 'bg-gray-50 border-gray-200'
                };
        }
    };

    const statusDisplay = getStatusDisplay();

    return (
        <div className={`rounded-lg border p-4 ${statusDisplay.color}`}>
            <div className="flex items-center gap-3 mb-3">
                {statusDisplay.icon}
                <h3 className="font-medium text-gray-900">{statusDisplay.title}</h3>
            </div>

            {/* Progress Bar */}
            {status === 'processing' && (
                <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>{message}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="text-sm text-red-600 mb-3">
                    {error}
                </div>
            )}

            {/* Completed Clips */}
            {status === 'completed' && clips && clips.length > 0 && (
                <div className="space-y-3 mt-4">
                    <h4 className="font-medium text-gray-900">Generated Clips</h4>
                    <div className="grid gap-3">
                        {clips.map((clip) => (
                            <div
                                key={clip.id}
                                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                            >
                                {/* Thumbnail */}
                                <div className="relative aspect-video">
                                    <img
                                        src={clip.thumbnailUrl}
                                        alt={clip.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onPreviewClip?.(clip.id)}
                                            className="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
                                        >
                                            <Play className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-2 right-2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                                        {Math.round(clip.duration)}s
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="p-3">
                                    <h5 className="font-medium text-gray-900 mb-1 line-clamp-1">
                                        {clip.title}
                                    </h5>
                                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                        {clip.description}
                                    </p>
                                    
                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onPreviewClip?.(clip.id)}
                                            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Preview
                                        </button>
                                        <a
                                            href={clip.downloadUrl}
                                            download
                                            className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcessingStatus; 