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
