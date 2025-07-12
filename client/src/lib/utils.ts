export function formatSecondsAsTimestamp(totalSeconds: number): string {
    if (totalSeconds < 0) {
        throw new Error('formatSecondsAsTimestamp: totalSeconds must be non-negative')
    }
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')

    return `${hh}:${mm}:${ss}`
}

// Format milliseconds to HH:MM:SS:MSMS, omitting zero hours and minutes
export function formatTime(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((ms % (1000 * 60)) / 1000)
    const milliseconds = Math.floor((ms % 1000) / 10) // Show only 2 digits for milliseconds

    const parts = []

    // Only add hours if they exist
    if (hours > 0) {
        parts.push(hours.toString().padStart(2, '0'))
    }

    // Only add minutes if they exist or if hours exist
    if (minutes > 0 || hours > 0) {
        parts.push(minutes.toString().padStart(2, '0'))
    }

    // Always show seconds and milliseconds
    parts.push(seconds.toString().padStart(2, '0'))
    parts.push(milliseconds.toString().padStart(2, '0'))

    // Add the largest unit at the end
    let unit = 'ms'
    if (hours > 0) {
        unit = 'h'
    } else if (minutes > 0) {
        unit = 'm'
    } else if (seconds > 0) {
        unit = 's'
    }

    return parts.join(':') + unit
}

export function formatTimeMs(ms: number): string {
    const totalSeconds = ms / 1000
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}


export function generateHexColor(): string {
    const randomColor = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return `#${randomColor()}${randomColor()}${randomColor()}`;
}

export async function getMediaDuration(file: File, url: string): Promise<number> {
    return new Promise((resolve, reject) => {
        let media: HTMLMediaElement

        if (file.type.startsWith('video/')) {
            media = document.createElement('video')
        }
        else if (file.type.startsWith('audio/')) {
            media = document.createElement('audio')
        }
        else {
            // images don't have duration
            return resolve(0)
        }

        media.preload = 'metadata'
        media.src = url
        media.onloadedmetadata = () => {
            URL.revokeObjectURL(media.src)
            resolve(media.duration)
        }
        media.onerror = () => reject(new Error('Could not load media metadata'))
    })
}

/**
 * Calculate credits needed for Smart Cut based on video duration and type
 * @param durationInSeconds Video duration in seconds
 * @param type 'talk_audio' or 'action_visual'
 * @returns Number of credits needed
 */
export function calculateSmartCutCredits(durationInSeconds: number, type: 'talk_audio' | 'action_visual'): number {
  // Convert to hours and round up to nearest minute first
  const durationInMinutes = Math.ceil(durationInSeconds / 60);
  const durationInHours = durationInMinutes / 60;
  
  // Credits per hour based on type
  const creditsPerHour = type === 'talk_audio' ? 20 : 40;
  
  // Calculate and round up
  return Math.ceil(durationInHours * creditsPerHour);
}

/**
 * Calculate credits needed for auto captions based on video duration
 * @param durationInSeconds Video duration in seconds
 * @returns Number of credits needed
 */
export function calculateCaptionsCredits(durationInSeconds: number): number {
  // Convert to hours and round up to nearest minute first
  const durationInMinutes = Math.ceil(durationInSeconds / 60);
  const durationInHours = durationInMinutes / 60;
  
  // 8 credits per hour for captions
  return Math.ceil(durationInHours * 8);
}

/**
 * Calculate credits needed for AI voiceover based on text length
 * @param textLength Number of characters in the text
 * @returns Number of credits needed
 */
export function calculateVoiceoverCredits(textLength: number): number {
  // Estimate: ~150 characters per minute of audio
  const estimatedMinutes = Math.ceil(textLength / 150);
  
  // 4 credits per minute for voiceover
  return estimatedMinutes * 4;
}

/**
 * Get credit cost for a specific AI feature
 * @param featureName Name of the AI feature
 * @returns Number of credits needed
 */
export function getAIFeatureCreditCost(featureName: string): number {
  const creditCosts: Record<string, number> = {
    'smart-cut-audio': 20, // per hour
    'smart-cut-visual': 40, // per hour
    'auto-captions': 8,    // per hour
    'ai-voiceover': 4,     // per minute
    'ai-images': 4,        // per image
    'video-generation': 15, // per video
    'music-generation': 2   // per track
  };
  
  return creditCosts[featureName] || 0;
}
