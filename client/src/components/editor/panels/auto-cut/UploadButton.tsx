import React from 'react';
import { Upload, Video } from 'lucide-react';

interface UploadButtonProps {
    onClick: () => void;
    isUploading?: boolean;
}

export const UploadButton: React.FC<UploadButtonProps> = ({ onClick, isUploading = false }) => (
    <button
        onClick={onClick}
        disabled={isUploading}
        className="
            group relative w-full h-16 px-6 rounded-xl
            font-medium text-white
            bg-gradient-to-r from-blue-500 to-indigo-600
            hover:from-blue-600 hover:to-indigo-700
            active:from-blue-700 active:to-indigo-800
            transition-all duration-300 ease-out
            flex items-center justify-center gap-3
            active:scale-[0.98]
            overflow-hidden
            disabled:opacity-50 disabled:cursor-not-allowed
        "
    >
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 
            translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

        {/* Content */}
        <div className="relative flex items-center gap-3">
            <div className="p-2 rounded-lg transition-colors">
                {isUploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Video className="w-5 h-5" />
                )}
            </div>
            <span className="text-base">{isUploading ? 'Uploading...' : 'Upload Video'}</span>
        </div>
    </button>
); 