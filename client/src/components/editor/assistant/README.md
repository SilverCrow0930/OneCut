# Enhanced AI Assistant Components

This directory contains the new enhanced AI assistant components that provide a Cursor-style chat interface for Lemona's video editor.

## Components

### 1. `EnhancedAssistant.tsx`
The main enhanced assistant component that combines all features:

**Features:**
- **Chat Interface**: Clean, modern chat UI with message history
- **AI Edits Panel**: Shows pending, accepted, and rejected AI edits
- **@ Mentions**: Type `@` to mention and search available tools
- **Agent/Ask Modes**: Switch between autonomous agent mode and question-answering mode
- **File Upload**: Attach files to your messages
- **Tool Integration**: Direct integration with all editor tools

**Props:**
```typescript
interface EnhancedAssistantProps {
  onSendMessage: (message: string, mode: 'agent' | 'ask', mentions: ToolMention[], files: File[]) => void;
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
  onPreviewEdit: (editId: string) => void;
  messages: ChatMessage[];
  edits: AIEdit[];
  isLoading?: boolean;
}
```

### 2. `AdvancedChatInput.tsx`
The advanced chat input component with all the interactive features:

**Features:**
- **@ Tool Mentions**: Dropdown with searchable tool list
- **Mode Selection**: Agent vs Ask mode selector
- **File Attachments**: Multiple file upload support
- **Auto-resize**: Textarea automatically adjusts height
- **Keyboard Shortcuts**: Enter to send, Escape to close dropdowns

### 3. `EnhancedAssistantDemo.tsx`
A complete demo component showcasing all features with sample data:

**Features:**
- **Sample Conversations**: Pre-loaded chat history
- **Mock AI Responses**: Simulated AI responses based on user input
- **Interactive Edits**: Accept/reject functionality with visual feedback
- **Tool Mentions**: Working @ mentions with contextual responses

### 4. `EnhancedAssistantPanel.tsx`
Integration component for use within the existing editor:

**Features:**
- **Editor Integration**: Uses existing EditorContext and AuthContext
- **Project Awareness**: Shows current project information
- **Status Indicators**: Connection status and edit counters
- **Real Integration Points**: Ready for connecting to actual AI backend

## Available Tools for @ Mentions

The system includes these predefined tools that can be mentioned:

- **📝 Captions Tool** - Generate and edit video captions
- **🔤 Text Tool** - Add text overlays and titles
- **🎬 Transitions Tool** - Apply transitions between clips
- **🎤 Voiceover Tool** - Generate AI voiceovers
- **😀 Stickers Tool** - Add stickers and emojis
- **⏱️ Timeline** - Edit timeline and clips
- **🧠 Video Analysis** - Analyze video content
- **📤 Export Tool** - Export and render videos

## Usage Examples

### Basic Usage
```tsx
import EnhancedAssistant from './assistant/EnhancedAssistant';

function MyEditor() {
  const [messages, setMessages] = useState([]);
  const [edits, setEdits] = useState([]);

  const handleSendMessage = (message, mode, mentions, files) => {
    // Handle the message and integrate with your AI backend
  };

  return (
    <EnhancedAssistant
      onSendMessage={handleSendMessage}
      onAcceptEdit={handleAcceptEdit}
      onRejectEdit={handleRejectEdit}
      onPreviewEdit={handlePreviewEdit}
      messages={messages}
      edits={edits}
    />
  );
}
```

### Using the Demo
```tsx
import EnhancedAssistantDemo from './assistant/EnhancedAssistantDemo';

function DemoPage() {
  return <EnhancedAssistantDemo />;
}
```

### Integration with Existing Editor
```tsx
import EnhancedAssistantPanel from './panels/EnhancedAssistantPanel';

function EditorWithAI() {
  return (
    <div className="editor-layout">
      <div className="main-editor">
        {/* Your existing editor components */}
      </div>
      <div className="ai-panel">
        <EnhancedAssistantPanel />
      </div>
    </div>
  );
}
```

## Key Features Implemented

### 1. AI Edits Management
- **Pending Edits**: Show edits waiting for user approval
- **Accept/Reject**: Users can approve or decline AI suggestions
- **Edit History**: Track all accepted and rejected edits
- **Preview**: Preview changes before accepting

### 2. Tool Mentions System
- **@ Symbol Detection**: Automatically detect when user types @
- **Searchable Dropdown**: Filter tools by name or description
- **Visual Indicators**: Show mentioned tools as chips
- **Easy Removal**: Hover to remove mentioned tools

### 3. Agent vs Ask Modes
- **Ask Mode**: Get answers and suggestions from AI
- **Agent Mode**: Let AI take autonomous actions
- **Mode Indicator**: Clear indication of current mode
- **Contextual Responses**: AI responds differently based on mode

### 4. File Upload Support
- **Multiple Files**: Support for multiple file attachments
- **File Types**: Images, videos, documents supported
- **Visual Feedback**: Show attached files as removable chips
- **Integration Ready**: Files passed to message handlers

### 5. Modern UI/UX
- **Clean Design**: Modern, professional interface
- **Responsive**: Works on different screen sizes
- **Smooth Animations**: Subtle transitions and hover effects
- **Accessibility**: Keyboard navigation and screen reader support

## Next Steps

To fully integrate these components:

1. **Connect to AI Backend**: Replace mock responses with actual AI API calls
2. **Integrate with Editor State**: Connect edit actions to actual timeline modifications
3. **Add Preview System**: Implement actual preview functionality for edits
4. **Enhance Tool Integration**: Connect @ mentions to actual tool panels
5. **Add Persistence**: Save chat history and edit states
6. **Implement File Processing**: Handle uploaded files in AI processing

## Styling

All components use Tailwind CSS classes and are designed to match Lemona's existing design system. The color scheme uses:

- **Primary**: Blue (blue-600, blue-700)
- **Success**: Green (green-500, green-600)
- **Danger**: Red (red-500, red-600)
- **Neutral**: Gray scale (gray-50 to gray-900)

The components are fully responsive and include hover states, focus states, and loading states for a polished user experience. 