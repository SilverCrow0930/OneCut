import React from 'react'

interface ChatSendButtonProps {
    onSend: () => void;
}

const ChatSendButton: React.FC<ChatSendButtonProps> = ({ onSend }) => {
    return (
        <button
            className="flex items-center justify-center w-7 h-7 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            onClick={onSend}
            title="Send message"
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
            </svg>
        </button>
    )
}

export default ChatSendButton