import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import type { Components } from 'react-markdown';
import 'highlight.js/styles/github.css';

interface ChatMessageProps {
    id: number;
    message: string;
    sender: string;
    fullWidth?: boolean;
}

interface ListItemProps {
    children: React.ReactNode;
    itemIndex?: number;
    className?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ id, message, sender, fullWidth = false }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [renderError, setRenderError] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timeout);
    }, []);

    // Custom renderers for markdown
    const renderers: Components = {
        code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline ? (
                <div className="w-full my-2">
                    <div className="bg-gray-800 rounded-t-lg px-3 py-1 flex items-center justify-between">
                        <span className="text-gray-300 text-xs">
                            {match ? match[1] : 'code'}
                        </span>
                    </div>
                    <div className="bg-gray-900 rounded-b-lg p-2 overflow-x-auto">
                        <code className={className} {...props}>
                            {children}
                        </code>
                    </div>
                </div>
            ) : (
                <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm" {...props}>
                    {children}
                </code>
            );
        },
        p: ({ children }: any) => (
            <p className="my-2 leading-6">{children}</p>
        ),
        h1: ({ children }: any) => (
            <h1 className="text-3xl font-bold my-6 pb-2 border-b border-gray-200 dark:border-gray-700 text-black">
                {children}
            </h1>
        ),
        h2: ({ children }: any) => (
            <h2 className="text-2xl font-semibold my-4 pl-3 border-l-4 border-blue-300 bg-gray-50 dark:bg-gray-800 rounded-md text-black">
                {children}
            </h2>
        ),
        h3: ({ children }: any) => (
            <h3 className="text-lg font-medium my-3 text-black tracking-tight">
                {children}
            </h3>
        ),
        ul: ({ children }: any) => (
            <ul className="flex flex-wrap gap-4 my-4 p-0 list-none">{children}</ul>
        ),
        ol: ({ children }: any) => {
            if (!children) return null;
            return (
                <ol className="my-2 space-y-1">
                    {React.Children.toArray(children).map((child, idx) => {
                        if (!React.isValidElement(child)) return null;
                        return React.cloneElement(child, { itemIndex: idx + 1 } as ListItemProps);
                    })}
                </ol>
            );
        },
        li: ({ children, itemIndex, ...props }: any) => {
            const hasListChild = React.Children.toArray(children).some(
                (child: any) => child?.type === 'ul' || child?.type === 'ol'
            );

            if (!hasListChild) {
                return (
                    <li {...props} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm px-5 py-4 min-w-[220px] max-w-full flex-1 transition hover:shadow-md flex flex-col items-start">
                        <div className="flex items-center w-full">
                            <span className="text-black flex-1">{children}</span>
                        </div>
                    </li>
                );
            }

            return (
                <li {...props} className="pl-4 list-disc text-black">
                    {children}
                </li>
            );
        },
        blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 my-2 italic">
                {children}
            </blockquote>
        ),
        a: ({ href, children }: any) => (
            <a href={href} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        ),
    };

    const renderContent = () => {
        if (renderError) {
            return <div className="text-gray-900 dark:text-gray-100">{message}</div>;
        }

        try {
            return (
                <div className="markdown-body prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                        children={message}
                        components={renderers}
                        rehypePlugins={[rehypeRaw, rehypeHighlight]}
                    />
                </div>
            );
        } catch (error) {
            setRenderError(true);
            return <div className="text-gray-900 dark:text-gray-100">{message}</div>;
        }
    };

    return (
        <div
            className={`flex flex-col w-full text-sm mt-3 ${sender === 'user' ? 'items-end' : 'items-start'} transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
        >
            {/* Sender label (optional, can be removed if not needed) */}
            <span className={`mb-1 text-xs font-medium px-3 py-0.5 rounded ${sender === 'user' ? 'text-blue-500 pl-3' : 'text-gray-500 pr-3'}`}>{sender === 'user' ? 'You' : 'Assistant'}</span>
            {
                sender === 'user' ? (
                    <div className="w-fit max-w-full bg-gradient-to-br from-blue-500 to-blue-400 text-white rounded-t-2xl rounded-bl-2xl rounded-br-lg px-5 py-3 shadow-md">
                        {message}
                    </div>
                ) : (
                    <div className="w-fit max-w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-t-2xl rounded-br-2xl rounded-bl-lg px-5 py-3 shadow-sm">
                        {renderContent()}
                    </div>
                )
            }
        </div>
    );
}

export default ChatMessage;