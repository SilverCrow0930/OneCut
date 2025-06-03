// Professional Video Export System
// Handles: Audio, Video, Images, GIFs, Text, Captions, Speed, Transitions

import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

interface TimelineElement {
    id: string
    type: 'video' | 'audio' | 'image' | 'gif' | 'text' | 'caption'
    trackId: string
    
    // Timeline positioning (absolute timing)
    timelineStartMs: number
    timelineEndMs: number
    
    // Source trimming (for media)
    sourceStartMs?: number
    sourceEndMs?: number
    
    // Asset reference
    assetId?: string
    assetPath?: string
    
    // Effects and properties
    speed?: number
    volume?: number
    opacity?: number
    
    // Text/Caption specific
    text?: string
    fontFamily?: string
    fontSize?: number
    fontColor?: string
    position?: { x: number, y: number }
    
    // Transition
    transitionIn?: TransitionConfig
    transitionOut?: TransitionConfig
    
    // Layer/Z-index for overlays
    zIndex?: number
}

interface TransitionConfig {
    type: 'fade' | 'dissolve' | 'slide' | 'wipe' | 'zoom'
    duration: number
    direction?: 'left' | 'right' | 'up' | 'down'
    easing?: 'linear' | 'ease-in' | 'ease-out'
}

interface Track {
    id: string
    type: 'video' | 'audio' | 'overlay' | 'subtitle'
    index: number
    elements: TimelineElement[]
}

class ProfessionalVideoExporter {
    private elements: TimelineElement[]
    private tracks: Track[]
    private totalDurationMs: number
    private outputSettings: {
        width: number
        height: number
        fps: number
        quality: string
    }

    constructor(elements: TimelineElement[], tracks: Track[], outputSettings: any) {
        this.elements = elements.sort((a, b) => a.timelineStartMs - b.timelineStartMs)
        this.tracks = tracks.sort((a, b) => a.index - b.index)
        this.totalDurationMs = Math.max(...elements.map(e => e.timelineEndMs))
        this.outputSettings = outputSettings
    }

    async exportVideo(outputPath: string): Promise<void> {
        const ffmpegCommand = ffmpeg()
        
        // Step 1: Process all input assets
        await this.addInputAssets(ffmpegCommand)
        
        // Step 2: Build complex filter graph
        const filterGraph = await this.buildFilterGraph()
        
        // Step 3: Configure output
        ffmpegCommand
            .complexFilter(filterGraph)
            .outputOptions([
                '-map', '[final_video]',
                '-map', '[final_audio]',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'medium',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart'
            ])
            .output(outputPath)
        
        // Step 4: Execute with progress tracking
        return new Promise((resolve, reject) => {
            ffmpegCommand
                .on('end', resolve)
                .on('error', reject)
                .run()
        })
    }

    private async addInputAssets(command: ffmpeg.FfmpegCommand): Promise<void> {
        const mediaElements = this.elements.filter(e => 
            ['video', 'audio', 'image', 'gif'].includes(e.type) && e.assetPath
        )

        // Add unique assets as inputs
        const uniqueAssets = [...new Set(mediaElements.map(e => e.assetPath!))]
        uniqueAssets.forEach(assetPath => {
            command.input(assetPath)
        })

        // Create blank background
        command.input(`color=c=black:s=${this.outputSettings.width}x${this.outputSettings.height}:r=${this.outputSettings.fps}`)
               .inputFormat('lavfi')
               .duration(this.totalDurationMs / 1000)
    }

    private async buildFilterGraph(): Promise<string> {
        const filters: string[] = []
        const inputMapping = this.createInputMapping()
        
        // Process each track separately
        const videoTracks = this.processVideoTracks(filters, inputMapping)
        const audioTracks = this.processAudioTracks(filters, inputMapping)
        const textOverlays = this.processTextOverlays(filters)
        const transitions = this.processTransitions(filters)
        
        // Composite all layers
        this.compositeVideoLayers(filters, videoTracks, textOverlays)
        this.mixAudioTracks(filters, audioTracks)
        
        return filters.join(';')
    }

    private processVideoTracks(filters: string[], inputMapping: Map<string, number>): string[] {
        const videoOutputs: string[] = []
        
        this.tracks
            .filter(track => track.type === 'video')
            .forEach((track, trackIndex) => {
                const trackElements = track.elements
                    .filter(e => ['video', 'image', 'gif'].includes(e.type))
                    .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

                if (trackElements.length === 0) return

                const trackSegments: string[] = []

                trackElements.forEach((element, elementIndex) => {
                    const inputIndex = inputMapping.get(element.assetPath!)
                    if (inputIndex === undefined) return

                    const segmentLabel = `track${trackIndex}_seg${elementIndex}`
                    
                    // Build element processing filter
                    let elementFilter = this.buildElementFilter(element, inputIndex, segmentLabel)
                    filters.push(elementFilter)
                    
                    // Add timeline positioning
                    const positionedLabel = `${segmentLabel}_positioned`
                    const timelineStartSec = element.timelineStartMs / 1000
                    filters.push(`[${segmentLabel}]setpts=PTS+${timelineStartSec}/TB[${positionedLabel}]`)
                    
                    trackSegments.push(`[${positionedLabel}]`)
                })

                // Combine segments in this track
                if (trackSegments.length > 1) {
                    const trackOutput = `track${trackIndex}_combined`
                    filters.push(`${trackSegments.join('')}concat=n=${trackSegments.length}:v=1:a=0[${trackOutput}]`)
                    videoOutputs.push(`[${trackOutput}]`)
                } else if (trackSegments.length === 1) {
                    videoOutputs.push(trackSegments[0])
                }
            })

        return videoOutputs
    }

    private buildElementFilter(element: TimelineElement, inputIndex: number, outputLabel: string): string {
        let filter = `[${inputIndex}:v]`
        
        // Source trimming
        if (element.sourceStartMs && element.sourceEndMs) {
            const startSec = element.sourceStartMs / 1000
            const durationSec = (element.sourceEndMs - element.sourceStartMs) / 1000
            filter += `trim=start=${startSec}:duration=${durationSec},`
        }
        
        // Speed adjustment
        if (element.speed && element.speed !== 1) {
            filter += `setpts=${1/element.speed}*PTS,`
        }
        
        // Image duration (for static images)
        if (element.type === 'image') {
            const durationSec = (element.timelineEndMs - element.timelineStartMs) / 1000
            filter += `loop=loop=-1:size=1:start=0,setpts=N/(${this.outputSettings.fps}*TB),`
        }
        
        // Scaling and positioning
        filter += `scale=${this.outputSettings.width}:${this.outputSettings.height}:force_original_aspect_ratio=decrease,`
        filter += `pad=${this.outputSettings.width}:${this.outputSettings.height}:(ow-iw)/2:(oh-ih)/2:black`
        
        // Opacity
        if (element.opacity && element.opacity !== 1) {
            filter += `,format=rgba,colorchannelmixer=aa=${element.opacity}`
        }
        
        return `${filter}[${outputLabel}]`
    }

    private processAudioTracks(filters: string[], inputMapping: Map<string, number>): string[] {
        const audioOutputs: string[] = []
        
        this.tracks
            .filter(track => track.type === 'audio')
            .forEach((track, trackIndex) => {
                const audioElements = track.elements
                    .filter(e => ['video', 'audio'].includes(e.type))
                    .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

                if (audioElements.length === 0) return

                const trackSegments: string[] = []

                audioElements.forEach((element, elementIndex) => {
                    const inputIndex = inputMapping.get(element.assetPath!)
                    if (inputIndex === undefined) return

                    const segmentLabel = `audio_track${trackIndex}_seg${elementIndex}`
                    
                    let audioFilter = `[${inputIndex}:a]`
                    
                    // Source trimming
                    if (element.sourceStartMs && element.sourceEndMs) {
                        const startSec = element.sourceStartMs / 1000
                        const durationSec = (element.sourceEndMs - element.sourceStartMs) / 1000
                        audioFilter += `atrim=start=${startSec}:duration=${durationSec},`
                    }
                    
                    // Speed adjustment
                    if (element.speed && element.speed !== 1) {
                        audioFilter += `atempo=${element.speed},`
                    }
                    
                    // Volume adjustment
                    if (element.volume && element.volume !== 1) {
                        audioFilter += `volume=${element.volume},`
                    }
                    
                    // Timeline positioning (audio delay)
                    const timelineStartMs = element.timelineStartMs
                    if (timelineStartMs > 0) {
                        audioFilter += `adelay=${timelineStartMs}|${timelineStartMs},`
                    }
                    
                    // Remove trailing comma
                    audioFilter = audioFilter.replace(/,$/, '')
                    
                    filters.push(`${audioFilter}[${segmentLabel}]`)
                    trackSegments.push(`[${segmentLabel}]`)
                })

                // Mix segments in this track
                if (trackSegments.length > 1) {
                    const trackOutput = `audio_track${trackIndex}_mixed`
                    filters.push(`${trackSegments.join('')}amix=inputs=${trackSegments.length}[${trackOutput}]`)
                    audioOutputs.push(`[${trackOutput}]`)
                } else if (trackSegments.length === 1) {
                    audioOutputs.push(trackSegments[0])
                }
            })

        return audioOutputs
    }

    private processTextOverlays(filters: string[]): string[] {
        const textOverlays: string[] = []
        
        const textElements = this.elements.filter(e => e.type === 'text' || e.type === 'caption')
        
        textElements.forEach((element, index) => {
            const startSec = element.timelineStartMs / 1000
            const endSec = element.timelineEndMs / 1000
            
            const textFilter = `drawtext=text='${element.text?.replace(/'/g, "\\'")}':` +
                `fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:` +
                `fontsize=${element.fontSize || 24}:` +
                `fontcolor=${element.fontColor || 'white'}:` +
                `x=${element.position?.x || 'center'}:` +
                `y=${element.position?.y || 'center'}:` +
                `enable='between(t,${startSec},${endSec})'`
            
            textOverlays.push(textFilter)
        })
        
        return textOverlays
    }

    private processTransitions(filters: string[]): void {
        // Process transition effects between clips
        const elementsWithTransitions = this.elements.filter(e => 
            e.transitionIn || e.transitionOut
        )
        
        elementsWithTransitions.forEach(element => {
            if (element.transitionIn) {
                const transitionFilter = this.buildTransitionFilter(element.transitionIn, element)
                filters.push(transitionFilter)
            }
            
            if (element.transitionOut) {
                const transitionFilter = this.buildTransitionFilter(element.transitionOut, element)
                filters.push(transitionFilter)
            }
        })
    }

    private buildTransitionFilter(transition: TransitionConfig, element: TimelineElement): string {
        const startSec = element.timelineStartMs / 1000
        const endSec = element.timelineEndMs / 1000
        
        switch (transition.type) {
            case 'fade':
                return `fade=t=in:st=${startSec}:d=${transition.duration}`
            case 'dissolve':
                return `fade=t=in:st=${startSec}:d=${transition.duration}:alpha=1`
            default:
                return `fade=t=in:st=${startSec}:d=${transition.duration}`
        }
    }

    private compositeVideoLayers(filters: string[], videoTracks: string[], textOverlays: string[]): void {
        let currentOutput = '[0:v]' // Start with background
        
        // Overlay video tracks
        videoTracks.forEach((track, index) => {
            const overlayOutput = index === videoTracks.length - 1 && textOverlays.length === 0 
                ? 'video_composed' 
                : `overlay_${index}`
            
            filters.push(`${currentOutput}${track}overlay[${overlayOutput}]`)
            currentOutput = `[${overlayOutput}]`
        })
        
        // Apply text overlays
        textOverlays.forEach((textFilter, index) => {
            const textOutput = index === textOverlays.length - 1 
                ? 'final_video' 
                : `text_${index}`
            
            filters.push(`${currentOutput}${textFilter}[${textOutput}]`)
            currentOutput = `[${textOutput}]`
        })
        
        // If no text overlays, rename final video output
        if (textOverlays.length === 0 && videoTracks.length > 0) {
            const lastFilter = filters[filters.length - 1]
            filters[filters.length - 1] = lastFilter.replace(/\[.*?\]$/, '[final_video]')
        }
    }

    private mixAudioTracks(filters: string[], audioTracks: string[]): void {
        if (audioTracks.length === 0) {
            // Create silent audio
            filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000[final_audio]`)
        } else if (audioTracks.length === 1) {
            // Rename single audio track
            const lastAudioFilter = filters.find(f => f.includes(audioTracks[0]))!
            const filterIndex = filters.indexOf(lastAudioFilter)
            filters[filterIndex] = lastAudioFilter.replace(audioTracks[0], '[final_audio]')
        } else {
            // Mix multiple audio tracks
            filters.push(`${audioTracks.join('')}amix=inputs=${audioTracks.length}[final_audio]`)
        }
    }

    private createInputMapping(): Map<string, number> {
        const mapping = new Map<string, number>()
        const uniqueAssets = [...new Set(
            this.elements
                .filter(e => e.assetPath)
                .map(e => e.assetPath!)
        )]
        
        uniqueAssets.forEach((assetPath, index) => {
            mapping.set(assetPath, index)
        })
        
        return mapping
    }
}

 