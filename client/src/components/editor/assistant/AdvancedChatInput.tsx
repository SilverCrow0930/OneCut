import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Paperclip, Send, X } from 'lucide-react';
import { AdvancedChatInputProps, ToolMention, AVAILABLE_TOOLS } from './types';

const AdvancedChatInput: React.FC<AdvancedChatInputProps> = ({
  onSend,
  message,
  setMessage,
  disabled = false
}) => {
  const [mode, setMode] = useState<'agent' | 'ask'>('ask');
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [mentionedTools, setMentionedTools] = useState<ToolMention[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      // Show dropdown if @ is at word boundary and no space after it
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
    
    onSend(message.trim(), mode, mentionedTools, selectedFiles);
    
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

  return (
    <div className="relative w-full">
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
            disabled={disabled}
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
              disabled={disabled || (message.trim() === '' && selectedFiles.length === 0)}
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
  );
};

export default AdvancedChatInput; 