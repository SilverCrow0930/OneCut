import React from 'react'

const ChatHeader = () => {
    return (
        <div className='flex flex-row items-center w-full'>
            <div className='flex flex-row justify-center w-full gap-2'>
                <h1 className="underline underline-offset-4 decoration-gray-400 mt-1">
                    Chat
                </h1>
            </div>
        </div>
    )
}

export default ChatHeader