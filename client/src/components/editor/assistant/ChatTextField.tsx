import React, { ChangeEvent, useEffect, useRef, useState } from "react"
import ChatSendButton from "./ChatSendButton";

interface ChatTextFieldProps {
    onSend: (message: string, useIdeation: boolean) => void;
    message: string;
    setMessage: (msg: string) => void;
}

const ChatTextField: React.FC<ChatTextFieldProps> = ({ onSend, message, setMessage }) => {

    // Textarea Ref
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Handle Message Change
    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
    };

    // Handle Send Message
    const handleSend = () => {
        // Check if message is empty
        if (message.trim() === "") {
            return;
        }

        // Send message without ideation
        onSend(message.trim(), false);

        // Clear message
        setMessage("");
    };

    // Handle Key Down Event
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Check if Enter key is pressed without shift key
        if (e.key === "Enter" && !e.shiftKey) {
            // Prevent default behavior
            e.preventDefault();

            // Send message
            handleSend();
        }
    };

    useEffect(() => {
        // Auto Resize Textarea
        const textarea = textareaRef.current

        // Check if textarea exists
        if (textarea) {
            // Store current scroll position
            const scrollPos = textarea.scrollTop;

            // Reset height
            textarea.style.height = "auto"

            // Set to scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`

            // Restore scroll position
            textarea.scrollTop = scrollPos;
        }
    }, [message]) // Only depend on message changes, not button state

    return (
        <div className="
            flex flex-col w-full 
            gap-2 px-2 py-2 
            bg-white border border-gray-300 rounded-lg
        ">
            <div className="flex flex-col gap-2 w-full h-full">
                <div className="flex flex-row gap-1 w-full">
                    <textarea
                        ref={textareaRef}
                        className="focus:outline-none text-sm overflow-auto resize-none mt-[2px] w-full"
                        placeholder="Tell me your idea, ask me anything ..."
                        rows={2}
                        value={message}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </div>
            <div className="flex flex-row items-center justify-end">
                <ChatSendButton
                    onSend={handleSend}
                />
            </div>
        </div>
    )
}

export default ChatTextField