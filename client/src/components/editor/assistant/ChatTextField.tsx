import React, { ChangeEvent, useEffect, useRef, useState } from "react"
import ChatSendButton from "./ChatSendButton";
import { Paperclip } from "lucide-react";

interface ChatTextFieldProps {
    onSend: (message: string) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const ChatTextField: React.FC<ChatTextFieldProps> = ({ onSend, onSubmit, fileInputRef }) => {

    // Message State
    const [message, setMessage] = useState<string>("");

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

        // Send message
        onSend(message.trim());

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

            // Reset height
            textarea.style.height = "auto"

            // Set to scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`
        }
    }, [message])

    return (
        <div className="
            flex flex-col w-full 
            gap-2 px-2 py-2 
            bg-white border border-gray-300 rounded-lg
        ">
            <div className="flex flex-col gap-2 w-full h-full">
                <div className="flex flex-row gap-1">
                    <div className="
                        flex flex-row items-center justify-center gap-1
                        bg-gradient-to-r from-blue-500 to-purple-600 text-[11px] text-white px-2 py-1 rounded-md
                    ">
                        Chat with Melody
                    </div>
                </div>
                <div className="flex flex-row gap-1 w-full">
                    {/* <button className="
                        flex flex-row items-center justify-center w-[24px] h-[24px]
                        border-gray-300 rounded-md text-gray-700 hover:bg-gray-200 duration-500
                    ">
                        <Paperclip
                            className="
                                w-[14px] h-[14px]
                            "
                        />
                    </button> */}
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
            <div className="flex flex-row items-center justify-between">
                <div></div>
                <ChatSendButton
                    onSend={handleSend}
                />
            </div>
        </div>
    )
}

export default ChatTextField