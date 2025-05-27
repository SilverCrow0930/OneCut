import React from 'react';
import { Video } from 'lucide-react';

interface FilePreviewProps {
    file: File;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file }) => (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
                <Video className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                    {file.name}
                </p>
                <p className="text-xs text-gray-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
            </div>
        </div>
    </div>
); 