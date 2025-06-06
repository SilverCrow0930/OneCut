import React, { useState } from 'react';
import { X, Video, Clock, Smartphone, Monitor, Headphones, Mouse, Eye, Camera, Zap, Users, BookOpen } from 'lucide-react';
import { FilePreview } from './FilePreview';
import { ActionButtons } from './ActionButtons';

// Enhanced content types with processing method indicators
const CONTENT_TYPES = [
    {
        type: "podcast",
        emoji: "🎙️",
        name: "Podcast",
        description: "Audio-focused content analysis",
        examples: "Interviews, discussions, commentary",
        processingMethod: "audio-primary",
        icon: Headphones,
        characteristics: ["High content density", "Audio-driven", "Long-form suitable"]
    },
    {
        type: "talking_video", 
        emoji: "💬",
        name: "Talking Video",
        description: "Speech-focused video content",
        examples: "Vlogs, explanations, reviews",
        processingMethod: "audio-primary",
        icon: Video,
        characteristics: ["Structured speech", "Educational value", "Quote-worthy"]
    },
    {
        type: "professional_meeting",
        emoji: "💼",
        name: "Professional Meeting",
        description: "Business and educational content",
        examples: "Conferences, presentations, webinars",
        processingMethod: "audio-primary",
        icon: Users,
        characteristics: ["High commercial value", "Structured content", "Actionable insights"]
    },
    {
        type: "educational_video",
        emoji: "🎓",
        name: "Educational Video",
        description: "Learning and tutorial content",
        examples: "Tutorials, courses, explanations",
        processingMethod: "audio-primary",
        icon: BookOpen,
        characteristics: ["Very high content density", "Step-by-step", "Knowledge transfer"]
    },
    {
        type: "gaming",
        emoji: "🎮",
        name: "Gaming",
        description: "Visual + audio gameplay analysis",
        examples: "Gameplay highlights, reactions, commentary",
        processingMethod: "visual-audio",
        icon: Mouse,
        characteristics: ["Action-driven", "Visual highlights", "Reaction moments"]
    },
    {
        type: "tutorial_mousework",
        emoji: "🖱️",
        name: "Screen Tutorial",
        description: "Mouse-driven demonstration content",
        examples: "Software tutorials, design process, how-tos",
        processingMethod: "visual-audio",
        icon: Mouse,
        characteristics: ["Visual demonstration", "Step-by-step", "Skill-focused"]
    },
    {
        type: "reaction_video",
        emoji: "😲",
        name: "Reaction Video",
        description: "Facial expression and emotion analysis",
        examples: "First reactions, surprise moments, commentary",
        processingMethod: "visual-audio",
        icon: Eye,
        characteristics: ["Emotion-driven", "Facial expressions", "Authentic moments"]
    },
    {
        type: "cinematic_montage",
        emoji: "🎬",
        name: "Cinematic/Montage",
        description: "Visual storytelling and aesthetics",
        examples: "Travel videos, lifestyle, artistic content",
        processingMethod: "visual-primary",
        icon: Camera,
        characteristics: ["Visual storytelling", "Aesthetic focus", "Mood-driven"]
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
    videoFormat?: string;
    onVideoFormatChange?: (format: string) => void;
    targetDuration?: number;
    onTargetDurationChange?: (duration: number) => void;
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
    onContentTypeChange,
    videoFormat,
    onVideoFormatChange,
    targetDuration = 60,
    onTargetDurationChange
}) => {
    if (!isOpen) return null;

    // Specific time intervals in seconds
    const timeIntervals = [20, 40, 60, 90, 120, 240, 360, 480, 600, 900, 1200, 1500, 1800]

    // Automatically determine video format based on duration
    const getVideoFormat = (durationSeconds: number) => {
        return durationSeconds < 120 ? 'short_vertical' : 'long_horizontal'
    }

    const getFormatInfo = (durationSeconds: number) => {
        if (durationSeconds < 120) {
            return {
                format: 'Short Vertical',
                aspectRatio: '9:16'
            }
        } else {
            return {
                format: 'Long Horizontal', 
                aspectRatio: '16:9'
            }
        }
    }

    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
        } else {
            const hours = Math.floor(seconds / 3600)
            const minutes = Math.floor((seconds % 3600) / 60)
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
        }
    }

    // Find the closest interval value
    const getClosestInterval = (value: number) => {
        return timeIntervals.reduce((prev, curr) => 
            Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
        )
    }

    const handleDurationChange = (newValue: number) => {
        const closestInterval = getClosestInterval(newValue)
        if (onTargetDurationChange) {
            onTargetDurationChange(closestInterval)
        }
        // Auto-update video format based on duration
        const newFormat = getVideoFormat(closestInterval)
        if (onVideoFormatChange && newFormat !== videoFormat) {
            onVideoFormatChange(newFormat)
        }
    }

    const selectedContentType = CONTENT_TYPES.find(type => type.type === contentType);
    const currentFormat = getFormatInfo(targetDuration);

    // Generate smart prompt suggestions based on selections
    const generateSmartPrompt = () => {
        if (!selectedContentType) return;

        const isShort = targetDuration < 120;
        const processingMethod = selectedContentType.processingMethod;
        
        let basePrompt = "";
        
        // Format-specific prompts
        if (isShort) {
            basePrompt = `Create ${formatDuration(targetDuration)} viral clips that hook viewers in the first 3 seconds. `;
        } else {
            basePrompt = `Create ${formatDuration(targetDuration)} engaging segments that tell a complete story. `;
        }

        // Content-type specific instructions
        switch (selectedContentType.type) {
            case "podcast":
                basePrompt += isShort 
                    ? "Find the most quotable moments, surprising insights, and controversial takes that spark discussion."
                    : "Extract meaningful conversations, complete thoughts, and valuable insights that provide context.";
                break;
            case "gaming":
                basePrompt += isShort
                    ? "Capture epic moments, clutch plays, funny reactions, and skill showcases."
                    : "Show complete gameplay sequences, strategies, and extended highlight reels.";
                break;
            case "educational_video":
                basePrompt += isShort
                    ? "Find key learning moments, 'aha' insights, and actionable tips."
                    : "Extract complete explanations, step-by-step processes, and comprehensive lessons.";
                break;
            case "reaction_video":
                basePrompt += isShort
                    ? "Capture peak emotional reactions, surprise moments, and authentic expressions."
                    : "Show complete reaction sequences with context and follow-up discussions.";
                break;
            default:
                basePrompt += isShort
                    ? "Focus on the most engaging, surprising, and shareable moments."
                    : "Create complete, contextual segments that tell a full story.";
        }

        onPromptChange?.(basePrompt);
    };

    return (
        <div className="w-full h-full bg-white rounded-lg flex flex-col animate-fadeIn">
            <div className="w-full flex-1 p-6 overflow-y-auto elegant-scrollbar">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Video className="w-5 h-5 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">Smart Auto-Cut</h3>
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

                {/* Target Duration */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                            <Clock className="w-4 h-4 text-white" />
                        </div>
                        <label className="text-sm font-semibold text-gray-700">
                            Target: {formatDuration(targetDuration)}
                        </label>
                    </div>
                    
                    {/* Format indicator */}
                    <div className="mb-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                        <div className="flex items-center gap-4">
                            <div className="flex-1 text-center">
                                <div className="text-sm font-medium text-gray-900 mb-2">
                                    {currentFormat.format}
                                </div>
                                <div className="text-lg font-bold text-blue-600">
                                    {currentFormat.aspectRatio}
                                </div>
                            </div>
                            <div className="flex-1 flex justify-center">
                                {targetDuration < 120 ? (
                                    <div className="w-16 h-28 bg-gradient-to-b from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                                        <Smartphone className="w-6 h-6 text-white" />
                                    </div>
                                ) : (
                                    <div className="w-28 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                                        <Monitor className="w-6 h-6 text-white" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <input
                            type="range"
                            min="20"
                            max="1800"
                            value={targetDuration}
                            onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                            className="
                                w-full h-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full appearance-none cursor-pointer
                                [&::-webkit-slider-thumb]:appearance-none 
                                [&::-webkit-slider-thumb]:w-6 
                                [&::-webkit-slider-thumb]:h-6 
                                [&::-webkit-slider-thumb]:rounded-full 
                                [&::-webkit-slider-thumb]:bg-gradient-to-r
                                [&::-webkit-slider-thumb]:from-blue-500
                                [&::-webkit-slider-thumb]:to-purple-500
                                [&::-webkit-slider-thumb]:border-3
                                [&::-webkit-slider-thumb]:border-white
                                [&::-webkit-slider-thumb]:shadow-lg
                                [&::-webkit-slider-thumb]:cursor-pointer
                                [&::-webkit-slider-thumb]:hover:scale-110
                                [&::-webkit-slider-thumb]:transition-transform
                            "
                            disabled={isUploading}
                        />
                        
                        {/* Time interval markers */}
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <div className="text-center">
                                <div className="font-medium">20s</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium">90s</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium">2m</div>
                                <div className="text-gray-400">Switch</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium">10m</div>
                            </div>
                            <div className="text-center">
                                <div className="font-medium">30m</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Type Selection */}
                <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">What type of content is this?</h3>
                    <div className="grid grid-cols-1 gap-3">
                        {CONTENT_TYPES.map((type) => {
                            const Icon = type.icon;
                            return (
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
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl flex-shrink-0">{type.emoji}</span>
                                            <div className={`p-1 rounded-lg ${
                                                type.processingMethod === 'audio-primary' ? 'bg-green-100' :
                                                type.processingMethod === 'visual-audio' ? 'bg-yellow-100' : 'bg-purple-100'
                                            }`}>
                                                <Icon className={`w-3 h-3 ${
                                                    type.processingMethod === 'audio-primary' ? 'text-green-600' :
                                                    type.processingMethod === 'visual-audio' ? 'text-yellow-600' : 'text-purple-600'
                                                }`} />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-gray-900">{type.name}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                    type.processingMethod === 'audio-primary' ? 'bg-green-100 text-green-700' :
                                                    type.processingMethod === 'visual-audio' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {type.processingMethod === 'audio-primary' ? 'Audio Focus' :
                                                     type.processingMethod === 'visual-audio' ? 'Visual + Audio' : 'Visual Focus'}
                                                </span>
                                                {contentType === type.type && (
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-1">{type.description}</p>
                                            <p className="text-xs text-gray-500 italic mb-2">{type.examples}</p>
                                            <div className="flex flex-wrap gap-1">
                                                {type.characteristics.map(char => (
                                                    <span key={char} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                                        {char}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Smart Prompt Generation */}
                {selectedContentType && (
                    <div className="mb-4">
                        <button
                            onClick={generateSmartPrompt}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                            disabled={isUploading}
                        >
                            <Zap className="w-4 h-4" />
                            Generate smart prompt for {selectedContentType.name} → {currentFormat.format}
                        </button>
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
                            w-full h-32 p-3 border border-gray-200 rounded-lg resize-none 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            text-gray-700 placeholder-gray-400
                            transition-all duration-200
                        "
                        placeholder={selectedContentType ? 
                            `E.g., For ${selectedContentType.name}: Find the most ${
                                targetDuration < 120 ? 'viral-worthy moments with strong hooks' : 'complete and contextual segments'
                            } that showcase ${selectedContentType.characteristics.join(', ').toLowerCase()}...` :
                            "E.g., Find the most engaging moments where I explain the main concept, look for viral-worthy clips with strong emotional reactions..."
                        }
                        disabled={isUploading}
                        required
                    />
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                            💡 Be specific about what moments, emotions, or content you want highlighted
                        </p>
                        {selectedContentType && (
                            <span className="text-xs text-gray-400">
                                Optimized for {selectedContentType.processingMethod.replace('-', ' + ')} analysis
                            </span>
                        )}
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
                    videoFormat={getVideoFormat(targetDuration)}
                />
            </div>
        </div>
    );
}; 