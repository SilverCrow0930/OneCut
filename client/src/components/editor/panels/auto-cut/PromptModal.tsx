import React, { useState } from 'react';
import { X, Video } from 'lucide-react';
import { FilePreview } from './FilePreview';
import { ActionButtons } from './ActionButtons';

const CONTENT_TYPES = [
    {
        type: "storytelling",
        emoji: "📖",
        name: "Storytelling",
        description: "Vlogs, personal stories, lifestyle content",
        examples: "Day-in-life, travel vlogs, personal updates"
    },
    {
        type: "educational", 
        emoji: "🎓",
        name: "Educational",
        description: "Tutorials, how-tos, tips & explanations",
        examples: "Cooking, DIY, life hacks, science"
    },
    {
        type: "entertainment",
        emoji: "😂",
        name: "Entertainment",
        description: "Comedy, reactions, memes & viral content",
        examples: "Funny fails, reactions, challenges, skits"
    },
    {
        type: "performance",
        emoji: "🏆",
        name: "Performance",
        description: "Skills, talents, gaming & achievements",
        examples: "Gaming highlights, sports, music, fitness"
    },
    {
        type: "conversation",
        emoji: "💬",
        name: "Discussion",
        description: "Podcasts, interviews, debates & opinions",
        examples: "Hot takes, expert insights, Q&A sessions"
    },
    {
        type: "business",
        emoji: "💼",
        name: "Business",
        description: "Professional advice & motivational content",
        examples: "Success tips, industry insights, strategies"
    }
]

const PLATFORM_PROMPTS = [
    {
        platform: "TikTok",
        color: "bg-pink-50 border-pink-500 text-pink-700"
    },
    {
        platform: "Instagram Reels", 
        color: "bg-purple-50 border-purple-500 text-purple-700"
    },
    {
        platform: "YouTube Shorts",
        color: "bg-red-50 border-red-500 text-red-700"
    },
    {
        platform: "Twitter/X",
        color: "bg-blue-50 border-blue-500 text-blue-700"
    }
]

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
    contentType?: string;
    onContentTypeChange?: (type: string) => void;
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
    uploadProgress,
    contentType,
    onContentTypeChange
}) => {
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)

    if (!isOpen) return null;

    return (
        <div className="w-full h-full bg-white rounded-lg flex flex-col animate-fadeIn">
            <div className="w-full flex-1 p-6 overflow-y-auto elegant-scrollbar">
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

                {/* Content Type Selection */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">What type of content is this?</h3>
                    <div className="grid grid-cols-1 gap-3">
                        {CONTENT_TYPES.map((type) => (
                            <button
                                key={type.type}
                                onClick={() => onContentTypeChange?.(contentType === type.type ? '' : type.type)}
                                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                                    contentType === type.type
                                        ? 'border-blue-500 bg-blue-50 shadow-md'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                                disabled={isUploading}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl flex-shrink-0">{type.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-gray-900">{type.name}</span>
                                            {contentType === type.type && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-1">{type.description}</p>
                                        <p className="text-xs text-gray-500 italic">{type.examples}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Platform Selection */}
                {contentType && (
                    <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Choose your target platform:</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {PLATFORM_PROMPTS.map((platform) => (
                                <button
                                    key={platform.platform}
                                    onClick={() => setSelectedPlatform(selectedPlatform === platform.platform ? null : platform.platform)}
                                    className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                                        selectedPlatform === platform.platform
                                            ? `${platform.color} shadow-md`
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                    disabled={isUploading}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{platform.platform}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Custom instruction:
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        className="
                            w-full h-24 p-3 border border-gray-200 rounded-lg resize-none 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            text-gray-700 placeholder-gray-400
                            transition-all duration-200
                        "
                        placeholder="E.g., Find the most engaging moments where I explain the main concept, look for viral-worthy clips with strong emotional reactions..."
                        disabled={isUploading}
                        required
                    />
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            💡 Be specific about what moments, emotions, or content you want highlighted
                        </p>
                    </div>
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
                    isSubmitDisabled={!contentType || !prompt.trim() || isUploading}
                    contentType={contentType}
                />
            </div>
        </div>
    );
}; 