import React from 'react'

interface ChatSendButtonProps {
    onSend: () => void;
}

const ChatSendButton: React.FC<ChatSendButtonProps> = ({ onSend }) => {
    return (
        <button
            className='
                flex flex-row items-center justify-center gap-1 px-2 py-1 
                bg-blue-500 text-white text-[10px] rounded-lg
                hover:bg-blue-600 transition-colors
            '
            onClick={onSend}
        >
            Send
            <img
                src="/assets/icons/enter.png"
                alt="Send"
                className='w-2 h-2 filter invert'
            />
        </button>
    )
}

export default ChatSendButton