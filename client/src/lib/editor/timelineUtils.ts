import { Clip, Track, Command } from '@/types/editor'

export interface TimelineOperation {
    type: 'move' | 'resize' | 'delete' | 'insert'
    clipId: string
    trackId?: string
    startMs?: number
    endMs?: number
    ripple?: boolean
    magnetic?: boolean
}

export interface SnapPoint {
    position: number
    type: 'clip-start' | 'clip-end' | 'grid' | 'playhead'
    clipId?: string
    strength: number // 0-1, higher = stronger snap
}

export interface GapInfo {
    trackId: string
    startMs: number
    endMs: number
    durationMs: number
}

/**
 * Advanced timeline utilities for professional editing experience
 */
export class TimelineEngine {
    private clips: Clip[]
    private tracks: Track[]
    private snapThreshold: number = 8 // pixels
    private gridSnapMs: number = 250 // 0.25 seconds
    private timeScale: number = 1

    constructor(clips: Clip[], tracks: Track[], timeScale: number) {
        this.clips = clips
        this.tracks = tracks
        this.timeScale = timeScale
    }

    /**
     * Find all gaps in the timeline that can be automatically closed
     */
    findGaps(): GapInfo[] {
        const gaps: GapInfo[] = []

        for (const track of this.tracks) {
            const trackClips = this.clips
                .filter(c => c.trackId === track.id)
                .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

            for (let i = 0; i < trackClips.length - 1; i++) {
                const currentClip = trackClips[i]
                const nextClip = trackClips[i + 1]
                
                const gapStart = currentClip.timelineEndMs
                const gapEnd = nextClip.timelineStartMs
                
                if (gapEnd > gapStart) {
                    gaps.push({
                        trackId: track.id,
                        startMs: gapStart,
                        endMs: gapEnd,
                        durationMs: gapEnd - gapStart
                    })
                }
            }
        }

        return gaps
    }

    /**
     * Generate commands to close gaps after clip deletion
     */
    generateGapClosureCommands(deletedClip: Clip, fillGaps: boolean = true): Command[] {
        if (!fillGaps) return []

        const commands: Command[] = []
        const trackClips = this.clips
            .filter(c => c.trackId === deletedClip.trackId && c.id !== deletedClip.id)
            .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

        // Find clips that come after the deleted clip
        const clipsAfterDeleted = trackClips.filter(c => c.timelineStartMs >= deletedClip.timelineEndMs)
        
        if (clipsAfterDeleted.length === 0) return commands

        // Calculate the gap to close
        const gapDuration = deletedClip.timelineEndMs - deletedClip.timelineStartMs

        // Move all subsequent clips left to close the gap
        for (const clip of clipsAfterDeleted) {
            const newStartMs = clip.timelineStartMs - gapDuration
            const newEndMs = clip.timelineEndMs - gapDuration

            // Don't move clips before timeline start
            if (newStartMs >= 0) {
                commands.push({
                    type: 'UPDATE_CLIP',
                    payload: {
                        before: clip,
                        after: {
                            ...clip,
                            timelineStartMs: newStartMs,
                            timelineEndMs: newEndMs
                        }
                    }
                } as Command)
            }
        }

        return commands
    }

    /**
     * Generate snap points for magnetic timeline behavior
     */
    generateSnapPoints(excludeClipId?: string, currentTimeMs?: number): SnapPoint[] {
        const snapPoints: SnapPoint[] = []

        // Add grid snap points
        const maxMs = Math.max(...this.clips.map(c => c.timelineEndMs), 30000) // 30 seconds minimum
        for (let ms = 0; ms <= maxMs; ms += this.gridSnapMs) {
            snapPoints.push({
                position: ms * this.timeScale,
                type: 'grid',
                strength: 0.3
            })
        }

        // Add clip edge snap points
        for (const clip of this.clips) {
            if (clip.id === excludeClipId) continue

            // Clip start
            snapPoints.push({
                position: clip.timelineStartMs * this.timeScale,
                type: 'clip-start',
                clipId: clip.id,
                strength: 0.8
            })

            // Clip end
            snapPoints.push({
                position: clip.timelineEndMs * this.timeScale,
                type: 'clip-end',
                clipId: clip.id,
                strength: 0.8
            })
        }

        // Add playhead snap point
        if (currentTimeMs !== undefined) {
            snapPoints.push({
                position: currentTimeMs * this.timeScale,
                type: 'playhead',
                strength: 0.6
            })
        }

        return snapPoints.sort((a, b) => a.position - b.position)
    }

    /**
     * Find the best snap position for a given pixel position
     */
    findSnapPosition(targetPixels: number, snapPoints: SnapPoint[]): { position: number, snapped: boolean, snapPoint?: SnapPoint } {
        let bestSnap: SnapPoint | undefined
        let bestDistance = Infinity

        for (const snapPoint of snapPoints) {
            const distance = Math.abs(targetPixels - snapPoint.position)
            
            if (distance <= this.snapThreshold && distance < bestDistance) {
                bestDistance = distance
                bestSnap = snapPoint
            }
        }

        if (bestSnap) {
            return {
                position: bestSnap.position,
                snapped: true,
                snapPoint: bestSnap
            }
        }

        return {
            position: targetPixels,
            snapped: false
        }
    }

    /**
     * Check for collisions between clips
     */
    checkCollisions(clipId: string, newStartMs: number, newEndMs: number, trackId: string): Clip[] {
        const collisions: Clip[] = []

        for (const clip of this.clips) {
            if (clip.id === clipId || clip.trackId !== trackId) continue

            // Check if clips overlap
            const hasOverlap = !(newEndMs <= clip.timelineStartMs || newStartMs >= clip.timelineEndMs)
            if (hasOverlap) {
                collisions.push(clip)
            }
        }

        return collisions
    }

    /**
     * Generate ripple edit commands when moving a clip
     */
    generateRippleCommands(movedClip: Clip, newStartMs: number, rippleMode: 'all' | 'right' | 'none' = 'right'): Command[] {
        if (rippleMode === 'none') return []

        const commands: Command[] = []
        const deltaMs = newStartMs - movedClip.timelineStartMs

        if (deltaMs === 0) return commands

        const trackClips = this.clips
            .filter(c => c.trackId === movedClip.trackId && c.id !== movedClip.id)
            .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

        let clipsToMove: Clip[] = []

        if (rippleMode === 'all') {
            clipsToMove = trackClips
        } else if (rippleMode === 'right') {
            // Only move clips that start after the original position of the moved clip
            clipsToMove = trackClips.filter(c => c.timelineStartMs >= movedClip.timelineStartMs)
        }

        for (const clip of clipsToMove) {
            const newClipStartMs = clip.timelineStartMs + deltaMs
            const newClipEndMs = clip.timelineEndMs + deltaMs

            // Don't move clips before timeline start
            if (newClipStartMs >= 0) {
                commands.push({
                    type: 'UPDATE_CLIP',
                    payload: {
                        before: clip,
                        after: {
                            ...clip,
                            timelineStartMs: newClipStartMs,
                            timelineEndMs: newClipEndMs
                        }
                    }
                } as Command)
            }
        }

        return commands
    }

    /**
     * Find the best insertion point for a new clip
     */
    findInsertionPoint(trackId: string, preferredStartMs: number, clipDurationMs: number): {
        startMs: number
        endMs: number
        hasCollision: boolean
        suggestedAlternatives: Array<{ startMs: number, endMs: number }>
    } {
        const trackClips = this.clips
            .filter(c => c.trackId === trackId)
            .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

        const endMs = preferredStartMs + clipDurationMs

        // Check if preferred position has collision
        const hasCollision = this.checkCollisions('', preferredStartMs, endMs, trackId).length > 0

        if (!hasCollision) {
            return {
                startMs: preferredStartMs,
                endMs,
                hasCollision: false,
                suggestedAlternatives: []
            }
        }

        // Find alternative positions
        const alternatives: Array<{ startMs: number, endMs: number }> = []

        // Try placing at the end of the track
        if (trackClips.length > 0) {
            const lastClip = trackClips[trackClips.length - 1]
            alternatives.push({
                startMs: lastClip.timelineEndMs,
                endMs: lastClip.timelineEndMs + clipDurationMs
            })
        }

        // Try placing in gaps between clips
        for (let i = 0; i < trackClips.length - 1; i++) {
            const currentClip = trackClips[i]
            const nextClip = trackClips[i + 1]
            const gapDuration = nextClip.timelineStartMs - currentClip.timelineEndMs

            if (gapDuration >= clipDurationMs) {
                alternatives.push({
                    startMs: currentClip.timelineEndMs,
                    endMs: currentClip.timelineEndMs + clipDurationMs
                })
            }
        }

        // Try placing at the beginning
        if (trackClips.length > 0 && trackClips[0].timelineStartMs >= clipDurationMs) {
            alternatives.unshift({
                startMs: 0,
                endMs: clipDurationMs
            })
        }

        return {
            startMs: preferredStartMs,
            endMs,
            hasCollision: true,
            suggestedAlternatives: alternatives
        }
    }
}

/**
 * Debounced command executor for smooth real-time updates
 */
export class DebouncedCommandExecutor {
    private executeCommand: (cmd: Command) => void
    private pendingCommands: Command[] = []
    private timeoutId: NodeJS.Timeout | null = null
    private delay: number

    constructor(executeCommand: (cmd: Command) => void, delay: number = 16) { // ~60fps
        this.executeCommand = executeCommand
        this.delay = delay
    }

    execute(command: Command) {
        this.pendingCommands.push(command)
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
        }

        this.timeoutId = setTimeout(() => {
            this.flush()
        }, this.delay)
    }

    executeBatch(commands: Command[]) {
        this.pendingCommands.push(...commands)
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
        }

        this.timeoutId = setTimeout(() => {
            this.flush()
        }, this.delay)
    }

    flush() {
        if (this.pendingCommands.length === 0) return

        if (this.pendingCommands.length === 1) {
            this.executeCommand(this.pendingCommands[0])
        } else {
            this.executeCommand({
                type: 'BATCH',
                payload: {
                    commands: [...this.pendingCommands]
                }
            })
        }

        this.pendingCommands = []
        this.timeoutId = null
    }

    cancel() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
            this.timeoutId = null
        }
        this.pendingCommands = []
    }
}

/**
 * Timeline preferences and settings
 */
export interface TimelineSettings {
    magneticSnapping: boolean
    rippleEdit: boolean
    autoCloseGaps: boolean
    gridSnapping: boolean
    snapThreshold: number
    gridSnapMs: number
    showSnapGuides: boolean
    multiSelectMode: 'additive' | 'replace'
}

export const defaultTimelineSettings: TimelineSettings = {
    magneticSnapping: true,
    rippleEdit: false,
    autoCloseGaps: true,
    gridSnapping: true,
    snapThreshold: 8,
    gridSnapMs: 250,
    showSnapGuides: true,
    multiSelectMode: 'additive'
}
