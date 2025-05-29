import React from 'react';
import { X, Video } from 'lucide-react';
import { FilePreview } from './FilePreview';
import { ActionButtons } from './ActionButtons';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedFile: File | null;
    prompt: string;
    onPromptChange: (value: string) => void;
    onSubmit: () => void;
    isUploading: boolean;
    error: string | null;
    uploadProgress: number;
}

export const PromptModal: React.FC<PromptModalProps> = ({
    isOpen,
    onClose,
    selectedFile,
    prompt,
    onPromptChange,
    onSubmit,
    isUploading,
    error,
    uploadProgress
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-5000 animate-fadeIn">
            <div className="bg-white rounded-xl p-6 w-[450px] max-w-[90%] shadow-2xl transform transition-all animate-slideUp">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Video className="w-5 h-5 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">Auto-Cut Video</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {selectedFile && <FilePreview file={selectedFile} />}

                {isUploading && (
                    <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Uploading video...</span>
                            <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        How would you like to cut this video?
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        className="
                            w-full h-32 p-3 border border-gray-200 rounded-lg resize-none 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            text-gray-700 placeholder-gray-400
                            transition-all duration-200
                        "
                        placeholder="Example: Cut out all the silent parts and keep only the most engaging moments..."
                        disabled={isUploading}
                    />
                </div>

                {
                    error && (
                        <div className="mt-2 text-sm text-red-500">
                            {error}
                        </div>
                    )
                }

                <ActionButtons
                    onCancel={onClose}
                    onSubmit={onSubmit}
                    isSubmitDisabled={!prompt.trim() || isUploading}
                />
            </div>
        </div>
    );
}; 