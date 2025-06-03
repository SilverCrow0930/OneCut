import dotenv from 'dotenv'

dotenv.config()

if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not set in environment variables')
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1'

export interface ElevenLabsVoice {
    voice_id: string
    name: string
    category: string
    labels: Record<string, string>
    description: string
    preview_url: string
    available_for_tiers: string[]
    settings: {
        stability: number
        similarity_boost: number
        style: number
        use_speaker_boost: boolean
    }
    sharing: {
        status: string
        history_item_sample_id: string | null
        original_voice_id: string | null
        public_owner_id: string | null
        liked_by_count: number
        cloned_by_count: number
        name: string
        description: string
        labels: Record<string, string>
        review_status: string
        review_message: string | null
        enabled_in_library: boolean
    }
    high_quality_base_model_ids: string[]
}

export interface VoiceSettings {
    stability: number
    similarity_boost: number
    style?: number
    use_speaker_boost?: boolean
}

/**
 * Fetch all available voices from ElevenLabs
 */
export const getVoices = async (): Promise<ElevenLabsVoice[]> => {
    console.log('=== ELEVENLABS GET VOICES STARTED ===')
    
    try {
        const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
            method: 'GET',
            headers: {
                'XI-API-Key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('ElevenLabs API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            })
            throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        console.log('=== ELEVENLABS GET VOICES COMPLETED ===', {
            voiceCount: data.voices?.length || 0
        })
        
        return data.voices || []
    } catch (error) {
        console.error('=== ELEVENLABS GET VOICES FAILED ===')
        console.error('Error details:', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            timestamp: new Date().toISOString()
        })
        throw error
    }
}

/**
 * Generate speech from text using ElevenLabs TTS
 */
export const generateSpeech = async (
    text: string, 
    voiceId: string, 
    settings?: VoiceSettings
): Promise<Buffer> => {
    console.log('=== ELEVENLABS GENERATE SPEECH STARTED ===')
    console.log('Input parameters:', {
        textLength: text.length,
        voiceId,
        settings
    })

    try {
        const defaultSettings: VoiceSettings = {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
        }

        const voiceSettings = { ...defaultSettings, ...settings }

        const response = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'XI-API-Key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2', // High quality multilingual model
                voice_settings: voiceSettings
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('ElevenLabs TTS error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            })
            throw new Error(`ElevenLabs TTS error: ${response.status} ${response.statusText}`)
        }

        const audioBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(audioBuffer)
        
        console.log('=== ELEVENLABS GENERATE SPEECH COMPLETED ===', {
            audioSizeBytes: buffer.length,
            audioSizeMB: (buffer.length / (1024 * 1024)).toFixed(2)
        })
        
        return buffer
    } catch (error) {
        console.error('=== ELEVENLABS GENERATE SPEECH FAILED ===')
        console.error('Error details:', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            timestamp: new Date().toISOString()
        })
        throw error
    }
}

/**
 * Get voice details by ID
 */
export const getVoiceById = async (voiceId: string): Promise<ElevenLabsVoice> => {
    console.log('=== ELEVENLABS GET VOICE BY ID STARTED ===')
    console.log('Voice ID:', voiceId)

    try {
        const response = await fetch(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, {
            method: 'GET',
            headers: {
                'XI-API-Key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            }
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('ElevenLabs API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            })
            throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`)
        }

        const voice = await response.json()
        console.log('=== ELEVENLABS GET VOICE BY ID COMPLETED ===')
        
        return voice
    } catch (error) {
        console.error('=== ELEVENLABS GET VOICE BY ID FAILED ===')
        console.error('Error details:', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            timestamp: new Date().toISOString()
        })
        throw error
    }
} 