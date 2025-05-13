// src/components/editor/upload/DraggableAsset.tsx
'use client'

import React from 'react'

interface DraggableAssetProps {
    assetId: string
    children: React.ReactElement
}

export default function DraggableAsset({ assetId, children }: DraggableAssetProps) {
    const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
        e.dataTransfer.setData(
            'application/json',
            JSON.stringify({ assetId })
        )
        e.dataTransfer.effectAllowed = 'copy'
        // Set a drag image if needed
        if (e.target instanceof HTMLElement) {
            e.dataTransfer.setDragImage(e.target, 0, 0)
        }
    }

    // We know it's a single element, so cast it to ReactElement<any>
    const child = React.Children.only(children) as React.ReactElement<any>

    return React.cloneElement(child, {
        draggable: true,          // now allowed, because child.props is any
        onDragStart: (e: React.DragEvent<HTMLElement>) => {
            // call any existing onDragStart first
            child.props.onDragStart?.(e)
            handleDragStart(e)
        },
        style: {
            cursor: 'grab',
            ...child.props.style,
        },
    })
}
