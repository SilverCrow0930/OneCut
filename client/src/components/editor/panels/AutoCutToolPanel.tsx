import React, { useState, useRef, useEffect } from 'react'
import { UploadButton } from './auto-cut/UploadButton'
import { PromptModal } from './auto-cut/PromptModal'
import { ProcessingStatus } from './auto-cut/ProcessingStatus'
import { useAuth } from '@/contexts/AuthContext'
import { useAssets } from '@/contexts/AssetsContext'
import { useAutoCut } from '@/contexts/AutocutContext'
import { apiPath } from '@/lib/config'
import { getMediaDuration } from '@/lib/utils'
import AssetThumbnail from '../upload/AssetThumbnail'
import { CheckCircle2, AlertCircle, Loader2, Brain, Sparkles, ChevronDown, ChevronUp, Play } from 'lucide-react'
import VideoDetailsSection from './VideoDetailsSection';
import ReactMarkdown from 'react-markdown'
import { Components } from 'react-markdown'
import { useEditor } from '@/contexts/EditorContext'
import { v4 as uuid } from 'uuid'
import { useParams } from 'next/navigation'
import { TrackType } from '@/types/editor'
import PanelHeader from './PanelHeader'

type ProcessingState = 'idle' | 'starting' | 'generatingurl' | 'analyzing' | 'completed' | 'error';

interface ModelResponse {
    thoughts: string;
    textOutput: string;
}

interface Scene {
    src_start: number;
    src_end: number;
    description: string;
    captions: string[];
    viral_score?: number;
    hook_type?: string;
}

interface SceneCardProps {
    scene: Scene;
    index: number;
}

const FuturisticThought: React.FC<{
    text: string;
    index: number;
    total: number;
    onTypingComplete?: () => void
}> = ({ text, index, total, onTypingComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [cursorVisible, setCursorVisible] = useState(true);
    const textRef = useRef(text);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('FuturisticThought mounted/updated:', { text, index, total });
        let currentIndex = 0;
        const currentText = textRef.current || '';
        setDisplayedText('');

        // Cursor blink effect
        const cursorInterval = setInterval(() => {
            setCursorVisible(prev => !prev);
        }, 500);

        // Text typing effect
        const typingInterval = setInterval(() => {
            if (currentIndex < currentText.length) {
                setDisplayedText(prev => prev + currentText[currentIndex]);
                currentIndex++;

                // Scroll to bottom after each character is added
                if (contentRef.current) {
                    contentRef.current.scrollTop = contentRef.current.scrollHeight;
                }
            } else {
                clearInterval(typingInterval);
                onTypingComplete?.();
            }
        }, 20);

        return () => {
            clearInterval(typingInterval);
            clearInterval(cursorInterval);
        };
    }, [text, index, total, onTypingComplete]);

    // Update textRef when text prop changes
    useEffect(() => {
        textRef.current = text || '';
    }, [text]);

    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="relative w-full max-w-2xl mx-auto">
                {/* Futuristic background with dynamic gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-indigo-50/20 to-slate-100 rounded-xl" />

                {/* Animated grid overlay */}
                <div className="absolute inset-0 overflow-hidden rounded-xl">
                    <div className="absolute inset-0 opacity-10">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute h-[1px] bg-gradient-to-r from-indigo-400/0 via-indigo-400/20 to-indigo-400/0"
                                style={{
                                    top: `${i * 5}%`,
                                    left: '0',
                                    right: '0',
                                    animation: `scanline ${2 + i * 0.1}s linear infinite`,
                                    animationDelay: `${i * 0.1}s`
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Main content container */}
                <div className="relative bg-white/90 backdrop-blur-md rounded-xl p-4 border border-indigo-200/50">
                    {/* Header with progress indicator */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-indigo-200/50">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                            <span className="text-xs font-medium text-indigo-600/70">THOUGHT PROCESS</span>
                        </div>
                    </div>

                    {/* Content area with markdown support and scrolling */}
                    <div className="prose prose-sm max-w-none max-h-64 overflow-y-auto elegant-scrollbar" ref={contentRef}>
                        <div className="relative">
                            <ReactMarkdown
                                components={{
                                    p: ({ children }) => (
                                        <p className="text-gray-700 leading-relaxed mb-3">
                                            {children}
                                        </p>
                                    ),
                                    strong: ({ children }) => (
                                        <strong className="text-indigo-700 font-semibold">
                                            {children}
                                        </strong>
                                    ),
                                    em: ({ children }) => (
                                        <em className="text-indigo-600/90 italic">
                                            {children}
                                        </em>
                                    ),
                                    code: ({ children }) => (
                                        <code className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-sm">
                                            {children}
                                        </code>
                                    ),
                                    pre: ({ children }) => (
                                        <pre className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-200/50 overflow-x-auto">
                                            {children}
                                        </pre>
                                    ),
                                    ul: ({ children }) => (
                                        <ul className="list-disc list-inside text-gray-700 space-y-1">
                                            {children}
                                        </ul>
                                    ),
                                    ol: ({ children }) => (
                                        <ol className="list-decimal list-inside text-gray-700 space-y-1">
                                            {children}
                                        </ol>
                                    ),
                                    li: ({ children }) => (
                                        <li className="text-gray-700">
                                            {children}
                                        </li>
                                    ),
                                }}
                            >
                                {displayedText}
                            </ReactMarkdown>
                            <span
                                className={`inline-block w-0.5 h-4 ml-0.5 bg-indigo-400/50 align-middle ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}
                                style={{ animation: 'blink 1s step-end infinite' }}
                            />
                        </div>
                    </div>

                    {/* Processing indicator */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        <div className="flex gap-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1 h-1 bg-indigo-400 rounded-full"
                                    style={{
                                        animation: `pulse ${1 + i * 0.2}s ease-in-out infinite`,
                                        animationDelay: `${i * 0.2}s`
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const formatDuration = (timeValue: number) => {
    // Handle both seconds and milliseconds
    // If the value is very large (>10000), assume it's in milliseconds
    const seconds = timeValue > 10000 ? Math.floor(timeValue / 1000) : Math.floor(timeValue);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const SceneCard: React.FC<SceneCardProps> = ({ scene, index }) => {
    const duration = scene.src_end - scene.src_start;

    return (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            {/* Header with timing and description */}
            <div className="bg-blue-50/50 px-4 py-3">
                <div className="flex items-start gap-3 mb-3">
                    {/* Scene number badge */}
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white rounded border border-blue-100 text-blue-600 text-sm font-medium shadow-sm">
                        {index + 1}
                    </div>
                    <div className="flex-1 flex flex-col gap-1 text-xs text-gray-600 leading-tight">
                        {/* Timing information */}
                        <div>
                            <span className="font-medium">Original:</span> {formatDuration(scene.src_start)} - {formatDuration(scene.src_end)}
                        </div>
                        <div>
                            <span className="font-medium text-blue-700">Duration:</span> <span className="text-blue-700">{formatDuration(duration)}</span>
                        </div>
                    </div>
                </div>
                {/* Description */}
                <p className="text-xs text-gray-700 italic leading-relaxed pl-9">{scene.description}</p>
            </div>
        </div>
    );
};

const AnalysisResult: React.FC<{ data: any }> = ({ data }) => {
    try {
        // Handle the case where data might be an object or string
        let scenes: Scene[];

        if (typeof data === 'string') {
            // Try to extract JSON from markdown code block if present
            const jsonMatch = data.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                scenes = JSON.parse(jsonMatch[1].trim());
            } else {
                // If no markdown block, try to find JSON array
                const arrayMatch = data.match(/\[\s*\{[\s\S]*\}\s*\]/);
                if (arrayMatch) {
                    scenes = JSON.parse(arrayMatch[0].trim());
                } else {
                    // If it's just a string, try to parse it directly
                    scenes = JSON.parse(data);
                }
            }
        } else if (typeof data === 'object') {
            // If data is already an object, use it directly
            scenes = Array.isArray(data) ? data : [data];
        } else {
            throw new Error('Invalid data format');
        }

        if (!Array.isArray(scenes)) {
            console.error('Parsed data is not an array:', scenes);
            return <div className="text-sm text-gray-600">Invalid data format</div>;
        }

        return (
            <div className="flex flex-col gap-4">
                {scenes.map((scene, index) => (
                    <SceneCard key={index} scene={scene} index={index} />
                ))}
            </div>
        );
    } catch (e) {
        console.error('Error parsing analysis result:', e);
        return (
            <div className="text-sm text-gray-600">
                <p>Error parsing analysis result. Raw data:</p>
                <pre className="mt-2 p-4 bg-gray-50 rounded-lg overflow-auto">
                    {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
                </pre>
            </div>
        );
    }
};

// Add custom CSS to hide the scrollbar
const styles = `
.custom-scrollbar-hidden::-webkit-scrollbar {
    display: none; /* For Chrome, Safari, and Opera */
}

.custom-scrollbar-hidden {
    -ms-overflow-style: none;  /* For Internet Explorer and Edge */
    scrollbar-width: none;  /* For Firefox */
}

@keyframes scanline {
    0% {
        transform: translateY(-100%);
    }
    100% {
        transform: translateY(100%);
    }
}

@keyframes pulse {
    0%, 100% {
        opacity: 0.3;
        transform: scale(0.8);
    }
    50% {
        opacity: 1;
        transform: scale(1.2);
    }
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}
`;

const AutoCutToolPanel = () => {
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState('');
    const [contentType, setContentType] = useState<string>('');
    const [videoFormat, setVideoFormat] = useState<string>('short_vertical');
    const [targetDuration, setTargetDuration] = useState<number>(60);
    const [lastPrompt, setLastPrompt] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [processingState, setProcessingState] = useState<ProcessingState>('idle');
    const [modelResponse, setModelResponse] = useState<ModelResponse | null>(null);
    const [showThoughts, setShowThoughts] = useState(false);
    const [showResponse, setShowResponse] = useState(false);
    const [currentThoughtIndex, setCurrentThoughtIndex] = useState(0);
    const thoughtsRef = useRef<string[]>([]);
    const [uploadedAsset, setUploadedAsset] = useState<{
        id: string;
        mime_type: string;
        duration: number | null;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { session } = useAuth();
    const { refresh, assets } = useAssets();
    const { sendAutoCutRequest, socket } = useAutoCut();
    const [isExpanded, setIsExpanded] = useState(true);
    const { tracks, executeCommand } = useEditor();
    const params = useParams();
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

    // Check for URL settings on component mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const settingsParam = urlParams.get('settings');
            
            if (settingsParam) {
                try {
                    const settings = JSON.parse(decodeURIComponent(settingsParam));
                    
                    // Generate prompt based on settings
                    const contentTypeLabels: Record<string, string> = {
                        'meeting': '会议',
                        'interview': '访谈',
                        'tutorial': '教程',
                        'podcast': '播客'
                    };
                    
                    const generatedPrompt = `请帮我从这个${contentTypeLabels[settings.contentType] || settings.contentType}视频中剪辑出${settings.targetDuration}分钟的精彩片段。重点关注最有价值、最吸引人的内容片段。`;
                    
                    setPrompt(generatedPrompt);
                    setContentType(settings.contentType);
                    if (settings.videoFormat) {
                        setVideoFormat(settings.videoFormat);
                    }
                    if (settings.targetDuration) {
                        setTargetDuration(settings.targetDuration);
                    }
                    
                    // If coming from home page with file, auto-select the most recent asset
                    if (settings.hasFile && assets && assets.length > 0) {
                        const mostRecentAsset = assets
                            .filter(asset => asset.mime_type?.startsWith('video/'))
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                            
                        if (mostRecentAsset) {
                            setUploadedAsset({
                                id: mostRecentAsset.id,
                                mime_type: mostRecentAsset.mime_type,
                                duration: mostRecentAsset.duration || null,
                            });
                            
                            // Show prompt modal with pre-filled prompt
                            setTimeout(() => {
                                setShowPromptModal(true);
                            }, 1000);
                        }
                    }
                    
                    // Clear the URL parameters to avoid re-triggering
                    const newUrl = window.location.pathname + window.location.search.replace(/[?&]settings=[^&]*/, '').replace(/^\?&/, '?').replace(/^\?$/, '');
                    window.history.replaceState({}, '', newUrl);
                    
                } catch (error) {
                    console.error('Error parsing settings from URL:', error);
                }
            }
        }
    }, [assets]); // Add assets as dependency

    useEffect(() => {
        if (!socket) {
            console.log('No socket connection available');
            return;
        }

        console.log('Setting up WebSocket event listeners');

        socket.on('autocut_state', (data: { state: ProcessingState, message: string }) => {
            console.log('=== AUTOCUT STATE EVENT ===');
            console.log('Received autocut_state:', data);
            console.log('Current processingState:', processingState);
            console.log('Current isUploading:', isUploading);
            console.log('Current uploadProgress:', uploadProgress);

            setProcessingState(data.state);
            console.log('Updated processingState to:', data.state);

            if (data.state === 'error') {
                console.log('=== ERROR STATE HANDLING ===');
                console.error('Autocut error state:', data.message);
                setError(data.message || 'An error occurred during processing');
                setIsUploading(false);
                setSelectedFile(null);
                setUploadedAsset(null);
                setUploadProgress(0);
                console.log('Reset states after error');
            } else if (data.state === 'completed') {
                console.log('=== COMPLETED STATE HANDLING ===');
                console.log('Autocut completed state received');
                setIsUploading(false);
                setUploadProgress(0);
                console.log('Updated isUploading and uploadProgress');
            }
        });

        socket.on('autocut_response', (response: { success: boolean, data?: any, error?: string }) => {
            console.log('=== AUTOCUT RESPONSE EVENT ===');
            console.log('Received autocut_response:', response);
            console.log('Response data:', response.data);
            console.log('Thoughts type:', typeof response.data?.thoughts);
            console.log('Thoughts value:', response.data?.thoughts);
            console.log('TextOutput type:', typeof response.data?.textOutput);
            console.log('TextOutput value:', response.data?.textOutput);
            console.log('Current processingState:', processingState);
            console.log('Current isUploading:', isUploading);
            console.log('Current modelResponse:', modelResponse);

            if (!response.success) {
                console.log('=== ERROR RESPONSE HANDLING ===');
                console.error('Autocut response error:', response.error);
                let errorMessage = response.error || 'An error occurred during processing';

                // Add more specific error messages based on the error
                if (errorMessage.includes('File did not become active')) {
                    errorMessage = 'The video processing is taking longer than expected. Please try again with a shorter video or wait a few minutes before retrying.';
                } else if (errorMessage.includes('File not found in GCS')) {
                    errorMessage = 'The video file could not be found. Please try uploading the video again.';
                } else if (errorMessage.includes('Failed to generate signed URL')) {
                    errorMessage = 'There was an issue accessing the video file. Please try uploading the video again.';
                } else if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
                    errorMessage = 'The AI service is temporarily unavailable. This usually happens when the service is under heavy load. Please wait a few minutes and try again.';
                } else if (errorMessage.includes('timeout')) {
                    errorMessage = 'The video processing timed out. Please try with a shorter video or wait a few minutes before retrying.';
                } else if (errorMessage.includes('No valid JSON array found')) {
                    errorMessage = 'The AI had trouble analyzing your video. Please try with a different video or adjust your prompt.';
                } else if (errorMessage.includes('Failed to download video file')) {
                    errorMessage = 'There was an issue downloading your video for processing. Please try uploading it again.';
                } else if (errorMessage.includes('Video file is empty')) {
                    errorMessage = 'The uploaded video file appears to be empty or corrupted. Please try uploading a different video.';
                }

                setError(errorMessage);
                setProcessingState('error');
                setIsUploading(false);
                setSelectedFile(null);
                setUploadedAsset(null);
                setUploadProgress(0);
                console.log('Reset states after error response');
                return;
            }
            if (response.data) {
                console.log('=== SUCCESS RESPONSE HANDLING ===');
                console.log('Autocut response success:', response.data);

                // Set the model response data
                setModelResponse({
                    thoughts: response.data.thoughts?.text || response.data.thoughts || '',
                    textOutput: response.data.textOutput?.text || response.data.textOutput || ''
                });
                console.log('Updated modelResponse');

                // Process thoughts with improved handling
                let thoughtsText = '';
                if (typeof response.data.thoughts === 'string') {
                    thoughtsText = response.data.thoughts;
                } else if (response.data.thoughts?.text) {
                    thoughtsText = response.data.thoughts.text;
                } else if (Array.isArray(response.data.thoughts)) {
                    thoughtsText = response.data.thoughts.join('\n\n');
                }

                console.log('Processed thoughtsText:', thoughtsText);
                // Split thoughts and ensure we have valid entries, filtering out any JSON/cuts content
                const processedThoughts = thoughtsText
                    .split('\n\n')
                    .map(thought => thought.trim())
                    .filter((thought: string) => {
                        // Filter out any thoughts that contain JSON or look like cuts
                        return thought &&
                            thought.length > 0 &&
                            !thought.includes('```json') &&
                            !thought.includes('{') &&
                            !thought.includes('[') &&
                            !thought.includes('"src_start"') &&
                            !thought.includes('"src_end"');
                    });

                console.log('Processed thoughts array:', processedThoughts);
                thoughtsRef.current = processedThoughts;

                // Set processing state to completed
                setProcessingState('completed');
                setIsUploading(false);
                setUploadProgress(0);

                // Show thoughts after a short delay
                setTimeout(() => {
                    console.log('Setting showThoughts to true after delay');
                    setShowThoughts(true);
                    setCurrentThoughtIndex(0); // Reset thought index
                }, 1500);

                // Reset file and prompt states
                setSelectedFile(null);
                setPrompt('');

                // Update uploaded asset if available
                if (response.data.asset) {
                    console.log('Updating uploadedAsset with response data:', response.data.asset);
                    setUploadedAsset({
                        id: response.data.asset.id,
                        mime_type: response.data.asset.mime_type,
                        duration: response.data.asset.duration || null,
                    });
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('=== WEBSOCKET DISCONNECTED ===');
        });

        socket.on('connect', () => {
            console.log('=== WEBSOCKET CONNECTED ===');
        });

        socket.on('connect_error', (err: any) => {
            console.log('=== WEBSOCKET CONNECTION ERROR ===');
            console.error('WebSocket connection error:', err);
            setError('WebSocket connection error. Please try again.');
            setProcessingState('error');
            setIsUploading(false);
            setSelectedFile(null);
            setUploadedAsset(null);
            setUploadProgress(0);
        });

        return () => {
            console.log('Cleaning up WebSocket event listeners');
            socket.off('autocut_state');
            socket.off('autocut_response');
            socket.off('disconnect');
            socket.off('connect');
            socket.off('connect_error');
        };
    }, [socket, processingState, isUploading, uploadProgress, modelResponse]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Reset previous asset's state
            setUploadedAsset(null);
            setPrompt('');
            setContentType('');
            setError(null);
            setUploadProgress(0);
            setProcessingState('idle');

            setSelectedFile(file);
            setShowPromptModal(true);
        }
    };

    const handlePromptSubmit = async () => {
        if (!selectedFile || !session?.access_token) {
            setError('No file selected or not signed in');
            return;
        }

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);
        setShowPromptModal(false);

        try {
            // 1. Get video duration
            const url = URL.createObjectURL(selectedFile);
            const durationSeconds = await getMediaDuration(selectedFile, url);
            URL.revokeObjectURL(url);

            // 2. Upload video with progress tracking
            const form = new FormData();
            form.append('file', selectedFile);
            form.append('duration', String(durationSeconds));
            form.append('prompt', prompt);
            if (contentType) {
                form.append('contentType', contentType);
            }

            const xhr = new XMLHttpRequest();

            // Create a promise to handle the XHR request
            const uploadPromise = new Promise<{ id: string, object_key: string }>((resolve, reject) => {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        // Calculate progress with more precision
                        const progress = (event.loaded * 100) / event.total;
                        // Only update if the change is significant enough (0.5% or more)
                        if (Math.abs(progress - uploadProgress) >= 0.5) {
                            setUploadProgress(Math.round(progress));
                        }
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        reject(new Error(`Upload failed ${xhr.status}: ${xhr.responseText}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed'));
                });

                xhr.open('POST', apiPath('assets/upload'));
                xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
                xhr.send(form);
            });

            const assetData = await uploadPromise;

            // 3. Send the video processing request via WebSocket
            setProcessingState('starting');
            sendAutoCutRequest({
                prompt,
                contentType,
                videoFormat,
                targetDuration,
                fileUri: `gs://${process.env.NEXT_PUBLIC_GCS_BUCKET_NAME}/${assetData.object_key}`,
                mimeType: selectedFile.type
            });

            // Set the uploaded asset for display
            setUploadedAsset({
                id: assetData.id,
                mime_type: selectedFile.type,
                duration: durationSeconds * 1000 // Convert to milliseconds
            });
            setLastPrompt(prompt);

            // Refresh the assets list after successful upload
            refresh();

            // Reset state and close modal only after successful upload
            // setSelectedFile(null);
            // setPrompt('');
            setUploadProgress(0);
        }
        catch (err: any) {
            console.error('Upload error:', err);
            setError(err.message);
            setProcessingState('error');
        }
        finally {
            setIsUploading(false);
        }
    };

    const handleCloseModal = () => {
        setShowPromptModal(false);
        setSelectedFile(null);
        setPrompt('');
        setContentType('');
        setVideoFormat('short_vertical');
        setTargetDuration(60);
        setError(null);
        // Reset all states to go back to upload view
        setUploadedAsset(null);
        setLastPrompt('');
        setProcessingState('idle');
        setModelResponse(null);
        setShowThoughts(false);
        setShowResponse(false);
        setUploadProgress(0);
        setIsUploading(false);
    };

    const resetToUploadView = () => {
        setSelectedFile(null);
        setUploadedAsset(null);
        setPrompt('');
        setContentType('');
        setVideoFormat('short_vertical');
        setTargetDuration(60);
        setLastPrompt('');
        setError(null);
        setProcessingState('idle');
        setModelResponse(null);
        setShowThoughts(false);
        setShowResponse(false);
        setUploadProgress(0);
        setIsUploading(false);
    };

    const getProcessingMessage = () => {
        switch (processingState) {
            case 'starting':
                return 'Starting video analysis...';
            case 'generatingurl':
                return 'Preparing video for analysis...';
            case 'analyzing':
                return 'Analyzing video content...';
            case 'completed':
                return 'Analysis completed!';
            case 'error':
                return 'An error occurred';
            default:
                return 'Processing video...';
        }
    };

    // Determine what description to show based on state
    const getDescription = () => {
        if (showResponse && modelResponse) {
            return 'Your clips are ready!';
        }
        if (showThoughts || processingState === 'analyzing') {
            return 'AI is analyzing your content...';
        }
        if (isUploading || processingState !== 'idle') {
            return 'Processing your video...';
        }
        if (selectedFile || uploadedAsset) {
            return 'Video uploaded successfully';
        }
        return 'Find the moments worth sharing';
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg h-full">
            {/* Consistent header with dynamic description */}
            <div className="flex items-center justify-between">
                <PanelHeader
                    icon={Brain}
                    title="Autocut"
                    description={getDescription()}
                    iconBgColor="bg-purple-50"
                    iconColor="text-purple-600"
                />
                {(selectedFile || uploadedAsset || processingState !== 'idle') && (
                    <button
                        onClick={resetToUploadView}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                    >
                        Upload New
                    </button>
                )}
            </div>

            <div className="space-y-2 flex-1 min-h-0">
                <div className="flex flex-col gap-2 h-full">
                    <style>{styles}</style>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="video/*"
                        className="hidden"
                    />
                    
                    {/* Upload button - only show when in initial state */}
                    {(!selectedFile && !uploadedAsset && processingState === 'idle') && (
                        <div className="bg-white">
                            <UploadButton
                                onClick={() => {
                                    fileInputRef.current?.click()
                                }}
                            />
                        </div>
                    )}
                    
                    {/* Processing Status */}
                    {((isUploading || processingState !== 'idle') && !showThoughts && !showResponse) && (
                        <ProcessingStatus
                            processingState={processingState}
                            isUploading={isUploading}
                            uploadProgress={uploadProgress}
                            processingMessage={getProcessingMessage()}
                        />
                    )}
                    
                    {/* Futuristic Thought */}
                    {showThoughts && modelResponse && thoughtsRef.current.length > 0 && (
                        <div className="h-64">
                            <FuturisticThought
                                text={thoughtsRef.current.join('\n\n')}
                                index={0}
                                total={1}
                                onTypingComplete={() => {
                                    // Wait a bit after typing is complete before showing response
                                    setTimeout(() => {
                                        setShowThoughts(false);
                                        setShowResponse(true);
                                    }, 2000);
                                }}
                            />
                        </div>
                    )}
                    
                    {/* Video Details Section */}
                    {((isUploading || processingState !== 'idle' || uploadedAsset || showThoughts || showResponse)) && (
                        <VideoDetailsSection
                            isExpanded={isExpanded}
                            setIsExpanded={setIsExpanded}
                            processingState={processingState}
                            selectedFile={selectedFile}
                            uploadedAsset={uploadedAsset}
                            prompt={prompt}
                            lastPrompt={lastPrompt}
                            assets={assets}
                            showThoughts={showThoughts}
                            showResponse={showResponse}
                        />
                    )}
                    
                    {/* Error Message */}
                    {error && (
                        <div className="text-sm text-red-500 animate-fadeIn">
                            {error}
                            <button
                                onClick={resetToUploadView}
                                className="ml-2 text-xs underline hover:no-underline"
                            >
                                Try again
                            </button>
                        </div>
                    )}
                    
                    {/* Results Section */}
                    {showResponse && modelResponse && (
                        <div className="animate-slideUp flex-1 min-h-0">
                            <div className="flex flex-col gap-2 bg-white rounded-lg h-full">
                                <div className="flex items-center gap-3 p-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                                    <div className="p-2 bg-white rounded-lg shadow-sm">
                                        <img
                                            src="/assets/icons/lemon.png"
                                            alt="Autocut"
                                            className="w-5 h-5"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">Autocut</p>
                                    </div>
                                                                        
                                    <button
                                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                        onClick={() => {
                                            if (!modelResponse?.textOutput || !uploadedAsset?.id) return;

                                            try {
                                                const scenes: Scene[] = JSON.parse(modelResponse.textOutput);
                                                console.log('Adding scenes to timeline:', scenes);

                                                // Sort scenes by viral score for better ordering
                                                const sortedScenes = scenes.sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));

                                                // Create a new video track
                                                const newTrack = {
                                                    id: uuid(),
                                                    projectId: projectId!,
                                                    index: tracks.length,
                                                    type: 'video' as TrackType,
                                                    createdAt: new Date().toISOString(),
                                                    name: 'AutoCut - Viral Clips',
                                                    isLocked: false,
                                                    isMuted: false,
                                                    isSolo: false,
                                                    volume: 1,
                                                    pan: 0,
                                                };

                                                // Create clips from sorted scenes
                                                const newClips = sortedScenes.map((scene, index) => {
                                                    const duration = scene.src_end - scene.src_start;
                                                    const timelineStartMs = index === 0 ? 0 : sortedScenes.slice(0, index).reduce((acc, s) => acc + (s.src_end - s.src_start), 0);
                                                    const timelineEndMs = timelineStartMs + duration;

                                                    const videoClip = {
                                                        id: uuid(),
                                                        trackId: newTrack.id,
                                                        assetId: uploadedAsset.id,
                                                        type: 'video' as const,
                                                        sourceStartMs: scene.src_start,
                                                        sourceEndMs: scene.src_end,
                                                        timelineStartMs,
                                                        timelineEndMs,
                                                        assetDurationMs: uploadedAsset.duration || 0,
                                                        volume: 1,
                                                        speed: 1,
                                                        properties: {
                                                            name: `${scene.hook_type || 'Clip'} ${index + 1} (${scene.viral_score || 'N/A'}/10)`,
                                                            isLocked: false,
                                                            isMuted: false,
                                                            isSolo: false,
                                                        },
                                                        createdAt: new Date().toISOString(),
                                                    };

                                                    return { videoClip };
                                                });

                                                // Add track and clips
                                                executeCommand({
                                                    type: 'BATCH',
                                                    payload: {
                                                        commands: [
                                                            {
                                                                type: 'ADD_TRACK' as const,
                                                                payload: { track: newTrack }
                                                            },
                                                            ...newClips.map(({ videoClip }) => ({
                                                                type: 'ADD_CLIP' as const,
                                                                payload: { clip: videoClip }
                                                            }))
                                                        ]
                                                    }
                                                });
                                            } catch (error) {
                                                console.error('Error adding cuts to timeline:', error);
                                            }
                                        }}
                                    >
                                        <Play className="w-4 h-4 text-blue-600" />
                                    </button>
                                </div>

                                <div className="flex-1 min-h-0 px-3 pb-3">
                                    <div className="space-y-2 h-full overflow-y-auto elegant-scrollbar">
                                        {(() => {
                                            try {
                                                const scenes: Scene[] = JSON.parse(modelResponse.textOutput);
                                                // Sort by viral score descending
                                                const sortedScenes = scenes.sort((a, b) => (b.viral_score || 0) - (a.viral_score || 0));
                                                
                                                return sortedScenes.map((scene, index) => (
                                                    <div key={index} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-gray-900">
                                                                    Clip {index + 1}
                                                                </span>
                                                                {scene.viral_score && (
                                                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                                        scene.viral_score >= 8 ? 'bg-green-100 text-green-700' :
                                                                        scene.viral_score >= 6 ? 'bg-yellow-100 text-yellow-700' :
                                                                        'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                        🔥 {scene.viral_score}/10
                                                                    </div>
                                                                )}
                                                                {scene.hook_type && (
                                                                    <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                                        {scene.hook_type.replace('_', ' ')}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {formatDuration(scene.src_start)} - {formatDuration(scene.src_end)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-700 mb-2">
                                                            {scene.description}
                                                        </p>
                                                        {scene.captions && scene.captions.length > 0 && (
                                                            <div className="text-xs text-gray-500 italic">
                                                                "{scene.captions.join(' • ')}"
                                                            </div>
                                                        )}
                                                    </div>
                                                ));
                                            } catch (error) {
                                                console.error('Error parsing scenes:', error);
                                                return <div className="text-red-500 text-sm">Error parsing scenes</div>;
                                            }
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <PromptModal
                isOpen={showPromptModal}
                onClose={handleCloseModal}
                selectedFile={selectedFile}
                prompt={prompt}
                onPromptChange={setPrompt}
                contentType={contentType}
                onContentTypeChange={setContentType}
                videoFormat={videoFormat}
                onVideoFormatChange={setVideoFormat}
                targetDuration={targetDuration}
                onTargetDurationChange={setTargetDuration}
                onSubmit={handlePromptSubmit}
                isUploading={isUploading}
                error={error}
                uploadProgress={uploadProgress}
            />
        </div>
    );
};

export default AutoCutToolPanel;