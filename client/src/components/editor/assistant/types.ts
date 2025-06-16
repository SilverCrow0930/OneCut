// Shared types for the Enhanced AI Assistant system

export interface ToolMention {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface AIEdit {
  id: string;
  timestamp: Date;
  description: string;
  type: 'clip_edit' | 'text_add' | 'transition_add' | 'caption_add' | 'timeline_change';
  status: 'pending' | 'accepted' | 'rejected';
  details: {
    before?: any;
    after?: any;
    changes: string[];
  };
  previewUrl?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  type?: 'text' | 'edit' | 'suggestion';
  mentions?: ToolMention[];
  files?: File[];
}

export interface EnhancedAssistantProps {
  onSendMessage: (message: string, mode: 'agent' | 'ask', mentions: ToolMention[], files: File[]) => void;
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
  onPreviewEdit: (editId: string) => void;
  messages: ChatMessage[];
  edits: AIEdit[];
  isLoading?: boolean;
}

export interface AIEditsPanelProps {
  edits: AIEdit[];
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
  onPreviewEdit: (editId: string) => void;
  className?: string;
}

export interface AdvancedChatInputProps {
  onSend: (message: string, mode: 'agent' | 'ask', mentions: ToolMention[], files: File[]) => void;
  message: string;
  setMessage: (msg: string) => void;
  disabled?: boolean;
}

// Available tools that can be mentioned
export const AVAILABLE_TOOLS: ToolMention[] = [
  { id: 'captions', name: 'Captions Tool', description: 'Generate and edit video captions', icon: '📝' },
  { id: 'text', name: 'Text Tool', description: 'Add text overlays and titles', icon: '🔤' },
  { id: 'transitions', name: 'Transitions Tool', description: 'Apply transitions between clips', icon: '🎬' },
  { id: 'voiceover', name: 'Voiceover Tool', description: 'Generate AI voiceovers', icon: '🎤' },
  { id: 'stickers', name: 'Stickers Tool', description: 'Add stickers and emojis', icon: '😀' },
  { id: 'timeline', name: 'Timeline', description: 'Edit timeline and clips', icon: '⏱️' },
  { id: 'analysis', name: 'Video Analysis', description: 'Analyze video content', icon: '🧠' },
  { id: 'export', name: 'Export Tool', description: 'Export and render videos', icon: '📤' },
]; 