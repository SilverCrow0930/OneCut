/**
 * Caption types for AI-generated captions
 */

export interface Caption {
    id: string
    project_id: string
    start_ms: number
    end_ms: number
    text: string
    confidence?: number
    speaker?: string
    created_at: string
    updated_at: string
}

export interface CaptionGenerationResponse {
    success: boolean
    captions: Caption[]
    message: string
}

export interface CaptionCreateRequest {
    start_ms: number
    end_ms: number
    text: string
    confidence?: number
    speaker?: string
}

export interface CaptionUpdateRequest {
    text?: string
    start_ms?: number
    end_ms?: number
} 