import React, { useState, useRef, useEffect } from 'react';
import { 
  Check, 
  X, 
  Clock, 
  Eye,
  ChevronDown, 
  Paperclip, 
  Send 
} from 'lucide-react';
import { 
  EnhancedAssistantProps, 
  ToolMention, 
  AIEdit, 
  ChatMessage, 
  AVAILABLE_TOOLS 
} from './types';

const EnhancedAssistant: React.FC<EnhancedAssistantProps> = ({
  onSendMessage,
  onAcceptEdit,
  onRejectEdit,
  onPreviewEdit,
  messages,
  edits,
  isLoading = false
}) => {
  // Chat input state
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'agent' | 'ask'>('ask');
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [mentionedTools, setMentionedTools] = useState<ToolMention[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'edits'>('chat');
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);
  
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter tools based on search query
  const filteredTools = AVAILABLE_TOOLS.filter(tool =>
    tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(toolSearchQuery.toLowerCase())
  );

  // Handle @ symbol detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setMessage(value);
    setCursorPosition(cursorPos);

    // Check if user typed @ at current position
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (textAfterAt.length === 0 || !textAfterAt.includes(' ')) {
        setToolSearchQuery(textAfterAt);
        setShowToolDropdown(true);
      } else {
        setShowToolDropdown(false);
      }
    } else {
      setShowToolDropdown(false);
    }
  };

  // Handle tool selection from dropdown
  const handleToolSelect = (tool: ToolMention) => {
    const textBeforeCursor = message.substring(0, cursorPosition);
    const textAfterCursor = message.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const newText = 
        textBeforeCursor.substring(0, lastAtIndex) + 
        `@${tool.name} ` + 
        textAfterCursor;
      
      setMessage(newText);
      setMentionedTools(prev => [...prev.filter(t => t.id !== tool.id), tool]);
    }
    
    setShowToolDropdown(false);
    setToolSearchQuery('');
    textareaRef.current?.focus();
  };

  // Remove mentioned tool
  const removeMentionedTool = (toolId: string) => {
    const tool = mentionedTools.find(t => t.id === toolId);
    if (tool) {
      const newMessage = message.replace(new RegExp(`@${tool.name}\\s?`, 'g'), '');
      setMessage(newMessage);
      setMentionedTools(prev => prev.filter(t => t.id !== toolId));
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // Remove selected file
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle send
  const handleSend = () => {
    if (message.trim() === '' && selectedFiles.length === 0) return;
    
    onSendMessage(message.trim(), mode, mentionedTools, selectedFiles);
    
    // Reset state
    setMessage('');
    setMentionedTools([]);
    setSelectedFiles([]);
    setShowToolDropdown(false);
  };

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    if (e.key === 'Escape') {
      setShowToolDropdown(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowToolDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper functions for edits
  const getEditIcon = (type: AIEdit['type']) => {
    switch (type) {
      case 'clip_edit': return '✂️';
      case 'text_add': return '🔤';
      case 'transition_add': return '🎬';
      case 'caption_add': return '📝';
      case 'timeline_change': return '⏱️';
      default: return '🤖';
    }
  };

  const getEditTypeLabel = (type: AIEdit['type']) => {
    switch (type) {
      case 'clip_edit': return 'Clip Edit';
      case 'text_add': return 'Text Added';
      case 'transition_add': return 'Transition Added';
      case 'caption_add': return 'Captions Added';
      case 'timeline_change': return 'Timeline Change';
      default: return 'AI Edit';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return timestamp.toLocaleDateString();
  };

  const pendingEdits = edits.filter(edit => edit.status === 'pending');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('edits')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'edits'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            AI Edits
            {pendingEdits.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingEdits.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="text-sm">{msg.content}</div>
                    {msg.mentions && msg.mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.mentions.map((mention) => (
                          <span
                            key={mention.id}
                            className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                          >
                            <span>{mention.icon}</span>
                            <span>{mention.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs opacity-70 mt-1">
                      {formatTimeAgo(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      <span className="text-sm text-gray-600">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-200 p-4">
              <div className="relative">
                {/* Tool Dropdown */}
                {showToolDropdown && (
                  <div 
                    ref={dropdownRef}
                    className="absolute bottom-full left-0 w-full mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
                  >
                    {filteredTools.length > 0 ? (
                      filteredTools.map(tool => (
                        <div
                          key={tool.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handleToolSelect(tool)}
                        >
                          <span className="text-lg">{tool.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900">{tool.name}</div>
                            <div className="text-xs text-gray-500">{tool.description}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">No tools found</div>
                    )}
                  </div>
                )}

                {/* Main Input Container */}
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                  {/* Mentioned Tools */}
                  {mentionedTools.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border-b border-gray-100">
                      {mentionedTools.map(tool => (
                        <div
                          key={tool.id}
                          className="group flex items-center gap-2 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-sm hover:bg-blue-100 transition-colors"
                        >
                          <span>{tool.icon}</span>
                          <span>{tool.name}</span>
                          <button
                            onClick={() => removeMentionedTool(tool.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Files */}
                  {selectedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border-b border-gray-100">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="group flex items-center gap-2 bg-gray-50 text-gray-700 px-2 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span className="truncate max-w-32">{file.name}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text Input Area */}
                  <div className="p-3">
                    <textarea
                      ref={textareaRef}
                      value={message}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask AI anything or type @ to mention tools..."
                      className="w-full resize-none border-0 outline-none text-sm placeholder-gray-400 min-h-[40px] max-h-[120px]"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Bottom Controls */}
                  <div className="flex items-center justify-between p-3 border-t border-gray-100">
                    {/* Left Side - Mode Selector */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={mode}
                          onChange={(e) => setMode(e.target.value as 'agent' | 'ask')}
                          className="appearance-none bg-gray-50 border border-gray-200 rounded-md px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
                        >
                          <option value="ask">Ask</option>
                          <option value="agent">Agent</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {mode === 'ask' ? 'Get answers and suggestions' : 'Let AI take actions for you'}
                      </div>
                    </div>

                    {/* Right Side - File Upload and Send */}
                    <div className="flex items-center gap-2">
                      {/* File Upload Button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                        title="Attach file"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {/* Send Button */}
                      <button
                        onClick={handleSend}
                        disabled={isLoading || (message.trim() === '' && selectedFiles.length === 0)}
                        className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        title="Send message"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,video/*,.pdf,.txt,.doc,.docx"
                />
              </div>
            </div>
          </div>
        ) : (
          /* AI Edits Panel */
          <div className="h-full overflow-y-auto">
            {edits.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-4">🤖</div>
                  <div className="text-lg font-medium mb-2">No AI edits yet</div>
                  <div className="text-sm text-gray-400">
                    AI edits will appear here when the assistant makes changes
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Pending Edits */}
                {pendingEdits.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-blue-200">
                      <h3 className="font-medium text-blue-900">Pending Review</h3>
                    </div>
                    
                    {pendingEdits.map(edit => (
                      <div key={edit.id} className="px-4 py-3 border-b border-blue-100 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getEditIcon(edit.type)}</span>
                              <span className="text-sm font-medium text-gray-900">
                                {getEditTypeLabel(edit.type)}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(edit.timestamp)}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">{edit.description}</p>
                            
                            {/* Changes List */}
                            {edit.details.changes.length > 0 && (
                              <div className="mb-3">
                                <button
                                  onClick={() => setExpandedEdit(expandedEdit === edit.id ? null : edit.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {expandedEdit === edit.id ? 'Hide' : 'Show'} details
                                </button>
                                
                                {expandedEdit === edit.id && (
                                  <div className="mt-2 bg-white rounded p-2">
                                    <ul className="text-xs text-gray-600 space-y-1">
                                      {edit.details.changes.map((change, index) => (
                                        <li key={index} className="flex items-start gap-1">
                                          <span className="text-gray-400">•</span>
                                          <span>{change}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-3">
                          {edit.previewUrl && (
                            <button
                              onClick={() => onPreviewEdit(edit.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              Preview
                            </button>
                          )}
                          
                          <button
                            onClick={() => onAcceptEdit(edit.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Accept
                          </button>
                          
                          <button
                            onClick={() => onRejectEdit(edit.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Edits */}
                {edits.filter(edit => edit.status !== 'pending').length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <h3 className="font-medium text-gray-900">Recent Edits</h3>
                    </div>
                    
                    {edits.filter(edit => edit.status !== 'pending').slice(0, 10).map(edit => (
                      <div key={edit.id} className="px-4 py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm">{getEditIcon(edit.type)}</span>
                            <span className="text-sm text-gray-900 truncate">{edit.description}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-xs text-gray-500">{formatTimeAgo(edit.timestamp)}</span>
                            <div className={`w-2 h-2 rounded-full ${
                              edit.status === 'accepted' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAssistant; 