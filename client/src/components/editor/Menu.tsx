import React from 'react'
import { Redo2, Undo2 } from 'lucide-react'

const Menu = () => {
    return (
        <div className="flex flex-row items-center w-full h-16">
            <Undo2 />
            <Redo2 />
        </div>
    )
}

export default Menu