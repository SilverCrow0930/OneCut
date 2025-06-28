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
    { id: 'transitions', name: 'Transitions', description: 'Apply video transitions', icon: '→' },
    { id: 'voiceover', name: 'Voiceover', description: 'Generate AI voiceovers', icon: '🎤' },
    { id: 'stickers', name: 'Stickers', description: 'Add stickers and emojis', icon: '⭐' },
    { id: 'timeline', name: 'Timeline', description: 'Edit timeline and clips', icon: '⏱' },
    { id: 'analysis', name: 'Analysis', description: 'Analyze video content', icon: '📊' },
    { id: 'export', name: 'Export', description: 'Export and render video', icon: '↗' },
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
    const [recentAIEdits, setRecentAIEdits] = useState<AIEdit[]>([]);

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

    // Handle @ Button Click
    const handleAtButtonClick = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            const cursorPos = textarea.selectionStart;
            const newMessage = message.slice(0, cursorPos) + '@' + message.slice(cursorPos);
            setMessage(newMessage);
            setCursorPosition(cursorPos + 1);
            setShowToolDropdown(true);
            setToolSearchQuery('');
            
            // Focus and set cursor position
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorPos + 1, cursorPos + 1);
            }, 0);
        }
    };

    // Handle Tool Selection
    const handleToolSelect = (tool: ToolMention) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        const currentCursorPos = textarea.selectionStart;
        const lastAtIndex = message.lastIndexOf('@', currentCursorPos - 1);
        
        if (lastAtIndex !== -1) {
            // Calculate what text to remove: @ + the search query
            const textToRemove = '@' + toolSearchQuery;
            const beforeAt = message.substring(0, lastAtIndex);
            const afterMention = message.substring(lastAtIndex + textToRemove.length);
            const newMessage = beforeAt + afterMention;
            
            setMessage(newMessage);
            
            // Add to mentioned tools if not already present
            if (!mentionedTools.find(t => t.id === tool.id)) {
                setMentionedTools([...mentionedTools, tool]);
            }
            
            // Set cursor position after the removed text
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(lastAtIndex, lastAtIndex);
            }, 0);
        }
        
        setShowToolDropdown(false);
        setToolSearchQuery('');
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
            textarea.style.height = `${Math.min(textarea.scrollHeight, 80)}px`;
            textarea.scrollTop = scrollPos;
        }
    }, [message]);

    return (
        <div className="flex flex-col w-full space-y-2">
            {/* AI Recent Edits Section - Removed demo, keeping structure for future implementation */}
            {/* Main Input Container */}
            <div className="relative border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200">
                {/* Mentioned Tools - Inside Input Box at Top */}
                {mentionedTools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-t-lg">
                        {mentionedTools.map(tool => (
                            <div
                                key={tool.id}
                                className="group flex items-center gap-1.5 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200 transition-colors duration-200"
                            >
                                <div className="flex items-center justify-center w-4 h-4 bg-blue-200 rounded text-xs font-mono text-blue-700">
                                    {tool.icon}
                                </div>
                                <span>{tool.name}</span>
                                <button
                                    onClick={() => removeTool(tool.id)}
                                    className="ml-1 opacity-60 hover:opacity-100 text-blue-600 hover:bg-blue-300 rounded p-0.5 transition-all duration-200"
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

                {/* Input Area */}
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        className="w-full px-3 py-2 text-sm resize-none focus:outline-none placeholder-gray-400 leading-relaxed"
                        placeholder="Ask anything or use @ to mention tools..."
                        rows={1}
                        value={message}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />

                    {/* Tool Dropdown */}
                    {showToolDropdown && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                            <div className="p-1.5">
                                <div className="text-xs font-medium text-gray-500 px-2 py-1.5 border-b border-gray-100 mb-1">
                                    Available Tools
                                </div>
                                {filteredTools.length > 0 ? (
                                    <div className="space-y-0.5">
                                        {filteredTools.map(tool => (
                                            <button
                                                key={tool.id}
                                                onClick={() => handleToolSelect(tool)}
                                                className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-left group"
                                            >
                                                <div className="flex items-center justify-center w-8 h-8 bg-gray-100 group-hover:bg-gray-200 rounded text-xs font-mono text-gray-700 transition-colors duration-200">
                                                    {tool.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-medium text-xs text-gray-900">{tool.name}</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">{tool.description}</div>
                                                </div>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                    <polyline points="9,18 15,12 9,6"></polyline>
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-3 text-xs text-gray-500 text-center">No tools found</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Controls */}
                <div className={`flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/30 ${mentionedTools.length > 0 ? 'rounded-b-lg' : ''}`}>
                    {/* Left Side - @ Button and Mode Toggle */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAtButtonClick}
                            className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-all duration-200"
                            title="Mention tools"
                        >
                            <span className="text-sm font-semibold">@</span>
                        </button>
                        
                        <div className="flex items-center bg-white border border-gray-200 rounded overflow-hidden shadow-sm">
                            <button
                                onClick={() => setAiMode('agent')}
                                className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
                                    aiMode === 'agent'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                }`}
                            >
                                Agent
                            </button>
                            <button
                                onClick={() => setAiMode('ask')}
                                className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
                                    aiMode === 'ask'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                }`}
                            >
                                Ask
                            </button>
                        </div>
                    </div>

                    {/* Right Side - File Upload and Send */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleFileUpload}
                            className="flex items-center justify-center w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-all duration-200"
                            title="Attach file"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.49"></path>
                            </svg>
                        </button>
                        <ChatSendButton onSend={handleSend} />
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