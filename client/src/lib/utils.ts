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