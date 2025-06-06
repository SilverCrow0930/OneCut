import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import AssetThumbnail from '../upload/AssetThumbnail';
import { Asset } from '@/contexts/AssetsContext'; // Assuming Asset type is exported or defined here

interface VideoDetailsSectionProps {
    isExpanded: boolean;
    setIsExpanded: (expanded: boolean) => void;
    processingState: 'idle' | 'starting' | 'generatingurl' | 'analyzing' | 'completed' | 'error';
    selectedFile: File | null;
    uploadedAsset: { id: string; mime_type: string; duration: number | null; } | null;
    prompt: string;
    lastPrompt: string;
    assets: Asset[]; // Assuming assets type is Asset[]
    showThoughts: boolean;
    showResponse: boolean;
}

const VideoDetailsSection: React.FC<VideoDetailsSectionProps> = ({
    isExpanded,
    setIsExpanded,
    processingState,
    selectedFile,
    uploadedAsset,
    prompt,
    lastPrompt,
    assets,
    showThoughts,
    showResponse,
}) => {
    // This component should only render if there's something to show
    if (!((selectedFile || (uploadedAsset && processingState === 'completed')) && !showThoughts && !showResponse)) {
        return null;
    }

    const videoName = processingState !== 'completed'
        ? selectedFile?.name || 'Untitled Video'
        : assets.find(a => a.id === uploadedAsset?.id)?.name || 'Untitled Video';

    const displayedPrompt = processingState !== 'completed' ? prompt : lastPrompt;

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-3 py-2 flex items-center justify-between bg-gray-50/80 hover:bg-gray-100/80 transition-colors border-b border-gray-200"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                        {processingState !== 'completed' ? 'Clip Details' : 'Autocut Details'}
                    </span>
                    <span className="text-xs text-gray-500">
                        {videoName}
                    </span>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500 transition-transform" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 transition-transform" />
                )}
            </button>
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="p-3 space-y-3">
                    {/* Content based on processing state */}
                    {processingState !== 'completed' ? (
                        // During processing
                        <>
                            {selectedFile && (
                                <div className="relative w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                                    <div className="w-full aspect-[16/9]">
                                        <video
                                            src={selectedFile ? URL.createObjectURL(selectedFile) : undefined}
                                            className="w-full h-full object-cover"
                                            controls={false}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <MessageSquare className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <span className="text-xs font-medium text-gray-500">Prompt</span>
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            {displayedPrompt || 'No prompt provided'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        // After completion
                        uploadedAsset && (
                            <>
                                <div className="relative w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                                    <div className="w-full aspect-[16/9]">
                                        <AssetThumbnail
                                            asset={uploadedAsset}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <MessageSquare className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            <span className="text-xs font-medium text-gray-500">Prompt</span>
                                            <p className="text-sm text-gray-700 leading-relaxed">
                                                {displayedPrompt || 'No prompt provided'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoDetailsSection; 