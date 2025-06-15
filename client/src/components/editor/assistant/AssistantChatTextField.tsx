import React, { ChangeEvent, useEffect, useRef, useState, KeyboardEvent } from "react"
import { ChevronDown, Paperclip, Send, X } from "lucide-react"

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface MentionedTool {
  id: string;
  name: string;
  position: number;
}

interface AssistantChatTextFieldProps {
  onSend: (message: string, mode: 'agent' | 'ask', mentionedTools: string[], files?: File[]) => void;
  message: string;
  setMessage: (msg: string) => void;
  availableTools: Tool[];
  disabled?: boolean;
}

const AssistantChatTextField: React.FC<AssistantChatTextFieldProps> = ({ 
  onSend, 
  message, 
  setMessage, 
  availableTools,
  disabled = false 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [mode, setMode] = useState<'agent' | 'ask'>('ask');
  const [showToolDropdown, setShowToolDropdown] = useState(false);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [mentionedTools, setMentionedTools] = useState<MentionedTool[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(0);

  // Filter tools based on search query
  const filteredTools = availableTools.filter(tool =>
    tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(toolSearchQuery.toLowerCase())
  );

  // Handle message change and detect @ mentions
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setMessage(newMessage);
    setCursorPosition(cursorPos);

    // Check if user typed @ at current position
    const beforeCursor = newMessage.substring(0, cursorPos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    
    if (atMatch) {
      setToolSearchQuery(atMatch[1]);
      setShowToolDropdown(true);
      setDropdownSelectedIndex(0);
    } else {
      setShowToolDropdown(false);
      setToolSearchQuery('');
    }
  };

  // Handle tool selection from dropdown
  const selectTool = (tool: Tool) => {
    const beforeCursor = message.substring(0, cursorPosition);
    const afterCursor = message.substring(cursorPosition);
    
    // Find the @ position
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const atPosition = beforeCursor.lastIndexOf('@');
      const beforeAt = message.substring(0, atPosition);
      const newMessage = beforeAt + `@${tool.name} ` + afterCursor;
      
      setMessage(newMessage);
      setMentionedTools(prev => [...prev, {
        id: tool.id,
        name: tool.name,
        position: atPosition
      }]);
      
      setShowToolDropdown(false);
      setToolSearchQuery('');
      
      // Focus back to textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = atPosition + tool.name.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Remove mentioned tool
  const removeMentionedTool = (toolName: string) => {
    const regex = new RegExp(`@${toolName}\\s?`, 'g');
    const newMessage = message.replace(regex, '');
    setMessage(newMessage);
    setMentionedTools(prev => prev.filter(tool => tool.name !== toolName));
  };

  // Handle file selection
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // Remove selected file
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle send message
  const handleSend = () => {
    if (message.trim() === "" && selectedFiles.length === 0) {
      return;
    }

    const toolIds = mentionedTools.map(tool => tool.id);
    onSend(message.trim(), mode, toolIds, selectedFiles);

    // Clear everything
    setMessage("");
    setMentionedTools([]);
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle key down events
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showToolDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDropdownSelectedIndex(prev => 
          prev < filteredTools.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDropdownSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredTools.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredTools[dropdownSelectedIndex]) {
          selectTool(filteredTools[dropdownSelectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowToolDropdown(false);
      }
    } else {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  // Auto resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
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
    <div className="flex flex-col w-full gap-2">
      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 bg-white px-2 py-1 rounded border">
              <Paperclip className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-700 truncate max-w-32">{file.name}</span>
              <button
                onClick={() => removeFile(index)}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Container */}
      <div className="relative flex flex-col w-full bg-white border border-gray-300 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        
        {/* AI Mode Selector */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'agent' | 'ask')}
                className="appearance-none bg-transparent text-sm font-medium text-gray-700 pr-6 focus:outline-none cursor-pointer"
                disabled={disabled}
              >
                <option value="ask">Ask</option>
                <option value="agent">Agent</option>
              </select>
              <ChevronDown className="absolute right-0 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="text-xs text-gray-500">
              {mode === 'ask' ? 'Get answers and suggestions' : 'Perform actions automatically'}
            </div>
          </div>
        </div>

        {/* Text Input Area */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            className="w-full px-3 py-3 text-sm resize-none focus:outline-none placeholder-gray-400"
            placeholder={mode === 'ask' ? "Ask anything about your video..." : "Tell me what to do with your video..."}
            rows={2}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />

          {/* Tool Dropdown */}
          {showToolDropdown && filteredTools.length > 0 && (
            <div 
              ref={dropdownRef}
              className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            >
              {filteredTools.map((tool, index) => (
                <div
                  key={tool.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                    index === dropdownSelectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                  }`}
                  onClick={() => selectTool(tool)}
                >
                  <span className="text-lg">{tool.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{tool.name}</div>
                    <div className="text-xs text-gray-500">{tool.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            {/* Mentioned Tools */}
            {mentionedTools.map((tool) => (
              <div
                key={tool.id}
                className="group flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs hover:bg-blue-200 cursor-pointer"
                onClick={() => removeMentionedTool(tool.name)}
                title="Click to remove"
              >
                <span>@{tool.name}</span>
                <X className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* File Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={disabled}
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={disabled || (message.trim() === "" && selectedFiles.length === 0)}
              className="p-1 text-blue-500 hover:text-blue-600 disabled:text-gray-300 transition-colors"
              title="Send message"
            >
              <Send className="w-4 h-4" />
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
          accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
        />
      </div>
    </div>
  );
};

export default AssistantChatTextField; 