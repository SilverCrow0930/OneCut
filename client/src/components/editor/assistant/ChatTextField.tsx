import React, { ChangeEvent, useEffect, useRef, useState } from "react"
import ChatSendButton from "./ChatSendButton";

interface ChatTextFieldProps {
    onSend: (message: string, useIdeation: boolean) => void;
    message: string;
    setMessage: (msg: string) => void;
}

interface ToolMention {
    id: string;
    name: string;
    description: string;
    icon: string;
}

interface AIEdit {
    id: string;
    description: string;
    timestamp: Date;
    status: 'pending' | 'accepted' | 'rejected';
}

const AVAILABLE_TOOLS: ToolMention[] = [
    { id: 'captions', name: 'Captions', description: 'Generate and edit video captions', icon: 'CC' },
    { id: 'text', name: 'Text', description: 'Add text overlays and titles', icon: 'T' },
    { id: 'transitions', name: 'Transitions', description: 'Apply video transitions', icon: 'TR' },
    { id: 'voiceover', name: 'Voiceover', description: 'Generate AI voiceovers', icon: 'VO' },
    { id: 'stickers', name: 'Stickers', description: 'Add stickers and emojis', icon: 'ST' },
    { id: 'timeline', name: 'Timeline', description: 'Edit timeline and clips', icon: 'TL' },
    { id: 'analysis', name: 'Analysis', description: 'Analyze video content', icon: 'AN' },
    { id: 'export', name: 'Export', description: 'Export and render video', icon: 'EX' },
];

const ChatTextField: React.FC<ChatTextFieldProps> = ({ onSend, message, setMessage }) => {
    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [aiMode, setAiMode] = useState<'agent' | 'ask'>('agent');
    const [showToolDropdown, setShowToolDropdown] = useState(false);
    const [toolSearchQuery, setToolSearchQuery] = useState('');
    const [mentionedTools, setMentionedTools] = useState<ToolMention[]>([]);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [recentAIEdits, setRecentAIEdits] = useState<AIEdit[]>([
        {
            id: '1',
            description: 'Added captions to video segments 0:15-2:30',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            status: 'pending'
        },
        {
            id: '2', 
            description: 'Removed silent parts from timeline',
            timestamp: new Date(Date.now() - 10 * 60 * 1000),
            status: 'pending'
        }
    ]);

    // Handle Message Change
    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;
        
        setMessage(value);
        setCursorPosition(cursorPos);

        // Check for @ mentions
        const lastAtIndex = value.lastIndexOf('@', cursorPos - 1);
        if (lastAtIndex !== -1 && lastAtIndex === cursorPos - 1) {
            setShowToolDropdown(true);
            setToolSearchQuery('');
        } else if (lastAtIndex !== -1) {
            const searchQuery = value.substring(lastAtIndex + 1, cursorPos);
            if (searchQuery.includes(' ')) {
                setShowToolDropdown(false);
            } else {
                setToolSearchQuery(searchQuery);
                setShowToolDropdown(true);
            }
        } else {
            setShowToolDropdown(false);
        }
    };

    // Handle Tool Selection
    const handleToolSelect = (tool: ToolMention) => {
        const lastAtIndex = message.lastIndexOf('@', cursorPosition - 1);
        if (lastAtIndex !== -1) {
            const beforeAt = message.substring(0, lastAtIndex);
            const afterCursor = message.substring(cursorPosition);
            const newMessage = beforeAt + `@${tool.name} ` + afterCursor;
            setMessage(newMessage);
            
            // Add to mentioned tools if not already present
            if (!mentionedTools.find(t => t.id === tool.id)) {
                setMentionedTools([...mentionedTools, tool]);
            }
        }
        setShowToolDropdown(false);
        textareaRef.current?.focus();
    };

    // Remove Tool Mention
    const removeTool = (toolId: string) => {
        const tool = mentionedTools.find(t => t.id === toolId);
        if (tool) {
            const newMessage = message.replace(new RegExp(`@${tool.name}\\s?`, 'g'), '');
            setMessage(newMessage);
            setMentionedTools(mentionedTools.filter(t => t.id !== toolId));
        }
    };

    // Handle AI Edit Actions
    const handleEditAction = (editId: string, action: 'accept' | 'reject') => {
        setRecentAIEdits(edits => 
            edits.map(edit => 
                edit.id === editId 
                    ? { ...edit, status: action === 'accept' ? 'accepted' : 'rejected' }
                    : edit
            )
        );
    };

    // Handle File Upload
    const handleFileUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            // Handle file upload logic here
            console.log('Files selected:', files);
        }
    };

    // Handle Send Message
    const handleSend = () => {
        if (message.trim() === "") return;
        
        // Include mentioned tools in the message context
        const toolContext = mentionedTools.length > 0 
            ? `[Tools: ${mentionedTools.map(t => t.name).join(', ')}] ` 
            : '';
        
        onSend(toolContext + message.trim(), aiMode === 'agent');
        setMessage("");
        setMentionedTools([]);
    };

    // Handle Key Down Event
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showToolDropdown) {
            if (e.key === 'Escape') {
                setShowToolDropdown(false);
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                return;
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Filter tools based on search query
    const filteredTools = AVAILABLE_TOOLS.filter(tool =>
        tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(toolSearchQuery.toLowerCase())
    );

    // Auto resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            const scrollPos = textarea.scrollTop;
            textarea.style.height = "auto";
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
            textarea.scrollTop = scrollPos;
        }
    }, [message]);

    const pendingEdits = recentAIEdits.filter(edit => edit.status === 'pending');

    return (
        <div className="flex flex-col w-full">
            {/* AI Edits Section - Above Input */}
            {pendingEdits.length > 0 && (
                <div className="mb-3 space-y-2">
                    {pendingEdits.map(edit => (
                        <div key={edit.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 truncate">{edit.description}</p>
                                <p className="text-xs text-gray-500">{edit.timestamp.toLocaleTimeString()}</p>
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                                <button
                                    onClick={() => handleEditAction(edit.id, 'accept')}
                                    className="flex items-center justify-center w-6 h-6 bg-green-100 hover:bg-green-200 text-green-600 rounded transition-colors"
                                    title="Accept"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20,6 9,17 4,12"></polyline>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleEditAction(edit.id, 'reject')}
                                    className="flex items-center justify-center w-6 h-6 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors"
                                    title="Reject"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Input Container */}
            <div className="relative border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                {/* Mentioned Tools - Inside Input Box at Top */}
                {mentionedTools.length > 0 && (
                    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
                        {mentionedTools.map(tool => (
                            <div
                                key={tool.id}
                                className="group flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium"
                            >
                                <span className="w-4 h-4 bg-blue-200 text-blue-800 rounded text-xs flex items-center justify-center font-mono">
                                    {tool.icon}
                                </span>
                                <span>{tool.name}</span>
                                <button
                                    onClick={() => removeTool(tool.id)}
                                    className="opacity-0 group-hover:opacity-100 ml-1 text-blue-500 hover:text-blue-700 transition-opacity"
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Text Input Area */}
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        className="w-full p-3 text-sm resize-none focus:outline-none placeholder-gray-500"
                        placeholder="Plan, search, build anything"
                        rows={1}
                        value={message}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        style={{ minHeight: '44px' }}
                    />

                    {/* Tool Dropdown */}
                    {showToolDropdown && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                            {filteredTools.length > 0 ? (
                                filteredTools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleToolSelect(tool)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="w-6 h-6 bg-gray-100 text-gray-700 rounded text-xs flex items-center justify-center font-mono">
                                            {tool.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-gray-900">{tool.name}</div>
                                            <div className="text-xs text-gray-500">{tool.description}</div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-3 text-sm text-gray-500">No tools found</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Bottom Controls */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                    {/* Left Side - AI Mode Toggle */}
                    <div className="flex items-center">
                        <div className="flex bg-white border border-gray-200 rounded-md overflow-hidden">
                            <button
                                onClick={() => setAiMode('agent')}
                                className={`px-3 py-1 text-xs font-medium transition-colors ${
                                    aiMode === 'agent'
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                Agent
                            </button>
                            <button
                                onClick={() => setAiMode('ask')}
                                className={`px-3 py-1 text-xs font-medium transition-colors ${
                                    aiMode === 'ask'
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                            >
                                Ask
                            </button>
                        </div>
                    </div>

                    {/* Right Side - Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleFileUpload}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                            title="Attach file"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path>
                            </svg>
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={!message.trim()}
                            className={`p-1.5 rounded transition-colors ${
                                message.trim()
                                    ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                                    : 'text-gray-400 cursor-not-allowed'
                            }`}
                            title="Send message"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Hidden File Input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                />
            </div>
        </div>
    );
};

export default ChatTextField;