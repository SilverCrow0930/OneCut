'use client'

import Editor from "@/components/editor/Editor"
import { ProjectProvider } from "@/contexts/EditorContext"
import { useParams } from 'next/navigation'

export default function EditPage() {
    const { projectId } = useParams()

    return (
        <ProjectProvider>
            <Editor />
        </ProjectProvider>
    )
}