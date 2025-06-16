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
    { id: 'captions', name: 'Captions Tool', description: 'Generate and edit video captions', icon: '📝' },
    { id: 'text', name: 'Text Tool', description: 'Add text overlays and titles', icon: '🔤' },
    { id: 'transitions', name: 'Transitions Tool', description: 'Apply video transitions', icon: '🎬' },
    { id: 'voiceover', name: 'Voiceover Tool', description: 'Generate AI voiceovers', icon: '🎤' },
    { id: 'stickers', name: 'Stickers Tool', description: 'Add stickers and emojis', icon: '😀' },
    { id: 'timeline', name: 'Timeline', description: 'Edit timeline and clips', icon: '⏱️' },
    { id: 'analysis', name: 'Video Analysis', description: 'Analyze video content', icon: '🧠' },
    { id: 'export', name: 'Export Tool', description: 'Export and render video', icon: '📤' },
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
        <div className="flex flex-col w-full gap-3">
            {/* AI Recent Edits Section */}
            {pendingEdits.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-blue-700">AI Recent Edits</span>
                    </div>
                    <div className="space-y-2">
                        {pendingEdits.map(edit => (
                            <div key={edit.id} className="flex items-center justify-between bg-white rounded p-2 border border-blue-100">
                                <div className="flex-1">
                                    <p className="text-sm text-gray-700">{edit.description}</p>
                                    <p className="text-xs text-gray-500">{edit.timestamp.toLocaleTimeString()}</p>
                                </div>
                                <div className="flex gap-1 ml-2">
                                    <button
                                        onClick={() => handleEditAction(edit.id, 'accept')}
                                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                                    >
                                        ✓
                                    </button>
                                    <button
                                        onClick={() => handleEditAction(edit.id, 'reject')}
                                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Input Section */}
            <div className="relative bg-white border border-gray-300 rounded-lg overflow-hidden">
                {/* Mentioned Tools Bar */}
                {mentionedTools.length > 0 && (
                    <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
                        {mentionedTools.map(tool => (
                            <div
                                key={tool.id}
                                className="group flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                            >
                                <span>{tool.icon}</span>
                                <span>{tool.name}</span>
                                <button
                                    onClick={() => removeTool(tool.id)}
                                    className="opacity-0 group-hover:opacity-100 ml-1 text-blue-500 hover:text-blue-700 transition-opacity"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Text Input Area */}
                <div className="relative">
                    <textarea
                        ref={textareaRef}
                        className="w-full p-3 text-sm resize-none focus:outline-none"
                        placeholder="Plan, search, ask anything"
                        rows={2}
                        value={message}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />

                    {/* Tool Dropdown */}
                    {showToolDropdown && (
                        <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                            {filteredTools.length > 0 ? (
                                filteredTools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleToolSelect(tool)}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <span className="text-lg">{tool.icon}</span>
                                        <div>
                                            <div className="font-medium text-sm">{tool.name}</div>
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
                <div className="flex items-center justify-between p-2 bg-gray-50 border-t border-gray-200">
                    {/* Left Side - AI Mode Toggle */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setAiMode('agent')}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                                aiMode === 'agent'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                        >
                            🤖 Agent
                        </button>
                        <button
                            onClick={() => setAiMode('ask')}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                                aiMode === 'ask'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                        >
                            💬 Ask
                        </button>
                    </div>

                    {/* Right Side - File Upload and Send */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleFileUpload}
                            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                            title="Upload file"
                        >
                            📎
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