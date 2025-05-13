import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github.css';

interface ChatMessageProps {
    id: number;
    message: string;
    sender: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ id, message, sender }) => {

    // Custom renderers for markdown
    const renderers = {
        code: ({ node, ...props }: any) => (
            <div className='flex flex-col w-full items-center'>
                {props.children}
            </div>
        ),
    };

    return (
        <div className='flex flex-col w-96 p-1 text-sm'>
            {
                sender === 'user' ? (
                    <div className='flex flex-row w-full h-full bg-blue-100 text-black rounded-lg px-4 py-3'>
                        {message}
                    </div>
                ) : (
                    <div className="markdown-body px-4 w-full">
                        <ReactMarkdown
                            children={message}
                            components={renderers}
                            rehypePlugins={[rehypeRaw, rehypeHighlight]}
                        />
                    </div>
                )
            }
        </div>
    );
}

export default ChatMessage;