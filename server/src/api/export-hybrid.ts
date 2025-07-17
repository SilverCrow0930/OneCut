import { BrowserRenderer, StyledElement } from '../services/browserRenderer.js'
import { ElementClassifier, classifyElements } from '../services/elementClassifier.js'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'

// Import the types from the existing export.ts file
interface TimelineElement {
  id: string
  type: 'video' | 'image' | 'audio' | 'text' | 'caption' | 'gif' | 'sticker'
  timelineStartMs: number
  timelineEndMs: number
  sourceStartMs?: number
  sourceEndMs?: number
  speed?: number
  opacity?: number
  volume?: number
  properties?: any
  text?: string
  assetId?: string
  transitionIn?: any
  transitionOut?: any
  fontSize?: number
  fontColor?: string
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  position?: { x: number, y: number }
}

interface TimelineTrack {
  id: string
  index: number
  type: string
}

// Enhanced version of your ProfessionalVideoExporter
export class HybridVideoExporter {
  private elements: TimelineElement[]
  private tracks: TimelineTrack[]
  private totalDurationMs: number
  private outputSettings: { width: number, height: number, fps: number }
  private downloadedAssets: Map<string, string>
  private jobId: string
  private tempDir: string

  constructor(elements: TimelineElement[], tracks: TimelineTrack[], outputSettings: any, downloadedAssets: Map<string, string>, jobId: string, tempDir: string) {
    this.elements = elements.sort((a, b) => a.timelineStartMs - b.timelineStartMs)
    this.tracks = tracks.sort((a, b) => a.index - b.index)
    this.totalDurationMs = Math.max(
      elements.length > 0 ? Math.max(...elements.map(e => e.timelineEndMs)) : 1000,
      1000
    )
    this.outputSettings = outputSettings
    this.downloadedAssets = downloadedAssets
    this.jobId = jobId
    this.tempDir = tempDir
  }

  async exportVideo(outputPath: string): Promise<void> {
    console.log(`[HybridExporter ${this.jobId}] Starting hybrid export`)

    // Step 1: Classify elements
    const { styledElements, mediaElements } = this.classifyElements()
    
    // Step 2: Render styled elements with browser if any exist
    let overlayFramesDir: string | null = null
    if (styledElements.length > 0) {
      overlayFramesDir = await this.renderStyledElements(styledElements)
    }

    // Step 3: Build FFmpeg command with hybrid inputs
    const ffmpegCommand = ffmpeg()
    await this.addInputAssets(ffmpegCommand, mediaElements)
    
    // Add overlay frames as input if we have them
    if (overlayFramesDir) {
      ffmpegCommand.input(path.join(overlayFramesDir, 'frame_%06d.png'))
        .inputFPS(this.outputSettings.fps)
    }

    // Step 4: Build hybrid filter graph
    const filterGraph = await this.buildHybridFilterGraph(mediaElements, !!overlayFramesDir)
    
    console.log(`[HybridExporter ${this.jobId}] Filter graph: ${filterGraph}`)

    // Step 5: Execute FFmpeg
    return new Promise((resolve, reject) => {
      ffmpegCommand
        .addOption('-filter_complex', filterGraph)
        .addOption('-map', '[final_video]')
        .addOption('-map', '[final_audio]')
        .addOption('-c:v', 'libx264')
        .addOption('-c:a', 'aac')
        .addOption('-preset', 'medium')
        .addOption('-crf', '23')
        .addOption('-pix_fmt', 'yuv420p')
        .addOption('-movflags', '+faststart')
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`[HybridExporter ${this.jobId}] FFmpeg started`)
        })
        .on('progress', (progress) => {
          const percent = Math.round(progress.percent || 0)
          console.log(`[HybridExporter ${this.jobId}] Progress: ${percent}%`)
        })
        .on('end', () => {
          console.log(`[HybridExporter ${this.jobId}] Export completed`)
          resolve()
        })
        .on('error', (err) => {
          console.error(`[HybridExporter ${this.jobId}] FFmpeg error:`, err)
          reject(err)
        })
        .run()
    })
  }

  private classifyElements(): { styledElements: StyledElement[], mediaElements: TimelineElement[] } {
    const styledElements: StyledElement[] = []
    const mediaElements: TimelineElement[] = []

    for (const element of this.elements) {
      if (this.needsBrowserRendering(element)) {
        styledElements.push({
          id: element.id,
          type: element.type as 'text' | 'caption' | 'sticker',
          timelineStartMs: element.timelineStartMs,
          timelineEndMs: element.timelineEndMs,
          properties: element.properties,
          text: element.text
        })
      } else {
        mediaElements.push(element)
      }
    }

    console.log(`[HybridExporter ${this.jobId}] Classified: ${styledElements.length} styled, ${mediaElements.length} media elements`)
    return { styledElements, mediaElements }
  }

  private needsBrowserRendering(element: TimelineElement): boolean {
    // Always use browser for text and captions for perfect styling
    if (element.type === 'text' || element.type === 'caption') {
      return true
    }

    // Use browser for stickers/animated content
    if (element.type === 'sticker' || element.properties?.externalAsset?.originalData?.isSticker) {
      return true
    }

    // Use browser for any element with complex styling
    if (element.properties?.style && (
      element.properties.style.boxShadow ||
      element.properties.style.borderRadius ||
      element.properties.style.background ||
      element.properties.style.fontFamily
    )) {
      return true
    }

    // Use browser for elements with transitions
    if (element.properties?.transitionIn || element.properties?.transitionOut) {
      return true
    }

    return false
  }

  private async renderStyledElements(styledElements: StyledElement[]): Promise<string | null> {
            const renderer = new BrowserRenderer(this.tempDir, this.jobId)
    
    try {
      await renderer.initialize(this.outputSettings.width, this.outputSettings.height)
      
      const overlayFramesDir = await renderer.renderOverlayFrames(
        styledElements,
        this.totalDurationMs,
        this.outputSettings.fps
      )
      
      return overlayFramesDir
    } finally {
      await renderer.cleanup()
    }
  }

  private async addInputAssets(command: ffmpeg.FfmpegCommand, mediaElements: TimelineElement[]): Promise<void> {
    // Add media assets (same as your existing logic)
    const mediaElementsWithAssets = mediaElements.filter(e => 
      ['video', 'audio', 'image', 'gif'].includes(e.type) && e.assetId && this.downloadedAssets.has(e.assetId)
    )

    const uniqueAssets = [...new Set(mediaElementsWithAssets.map(e => this.downloadedAssets.get(e.assetId!)!))]
    
    console.log(`[HybridExporter ${this.jobId}] Adding ${uniqueAssets.length} media assets`)
    uniqueAssets.forEach((assetPath, index) => {
      command.input(assetPath)
    })

    // Add black background
    const backgroundIndex = uniqueAssets.length
    command.input(`color=c=black:s=${this.outputSettings.width}x${this.outputSettings.height}:r=${this.outputSettings.fps}`)
           .inputFormat('lavfi')
           .duration(this.totalDurationMs / 1000)
  }

  private async buildHybridFilterGraph(mediaElements: TimelineElement[], hasOverlay: boolean): Promise<string> {
    const filters: string[] = []
    const inputMapping = this.createInputMapping(mediaElements)
    
    const timelineDurationSec = this.totalDurationMs / 1000
    const backgroundIndex = inputMapping.size

    // Create background
    filters.push(`[${backgroundIndex}:v]trim=duration=${timelineDurationSec},setpts=PTS-STARTPTS,format=yuv420p[master_timeline]`)

    // Process video elements (reuse your existing logic)
    const videoTracks = this.buildVideoTracks(filters, inputMapping, mediaElements, timelineDurationSec)
    
    // Process audio elements (reuse your existing logic) 
    const audioTracks = this.buildAudioTracks(filters, inputMapping, mediaElements, timelineDurationSec)

    // Composite video tracks
    let currentVideo = this.compositeVideoTracks(filters, videoTracks, 'master_timeline')

    // Add browser-rendered overlay if we have styled elements
    if (hasOverlay) {
      const overlayIndex = inputMapping.size + 1 // Background + 1
      filters.push(`[${currentVideo}][${overlayIndex}:v]overlay=0:0:format=auto,format=yuv420p[final_video]`)
      console.log(`[HybridExporter ${this.jobId}] Added browser overlay on top of video composition`)
    } else {
      filters.push(`[${currentVideo}]copy[final_video]`)
    }

    // Mix audio tracks (reuse your existing logic)
    this.mixAudioTracks(filters, audioTracks, timelineDurationSec)

    return filters.join(';')
  }

  // Include your existing helper methods here with modifications for mediaElements parameter
  private createInputMapping(mediaElements: TimelineElement[]): Map<string, number> {
    const uniqueAssets = [...new Set(
      mediaElements
        .filter(e => e.assetId && this.downloadedAssets.has(e.assetId))
        .map(e => this.downloadedAssets.get(e.assetId!)!)
    )]
    
    const mapping = new Map<string, number>()
    uniqueAssets.forEach((assetPath, index) => {
      mapping.set(assetPath, index)
    })
    
    return mapping
  }

  // Copy your existing buildVideoTracks, buildAudioTracks, compositeVideoTracks, mixAudioTracks methods here
  // with modifications to work with mediaElements instead of all elements
  
  private buildVideoTracks(filters: string[], inputMapping: Map<string, number>, mediaElements: TimelineElement[], timelineDuration: number): Array<{label: string, startTime: number, endTime: number}> {
    // Your existing buildVideoTracks logic, but using mediaElements instead of this.elements
    // This removes text/caption processing since they're handled by browser now
    const videoTracks: Array<{label: string, startTime: number, endTime: number}> = []
    
    const videoElements = mediaElements
      .filter(e => ['video', 'image', 'gif'].includes(e.type) && e.assetId && this.downloadedAssets.has(e.assetId))
      .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

    // ... rest of your existing buildVideoTracks logic
    return videoTracks
  }

  private buildAudioTracks(filters: string[], inputMapping: Map<string, number>, mediaElements: TimelineElement[], timelineDuration: number): Array<{label: string, startTime: number, endTime: number}> {
    // Your existing buildAudioTracks logic using mediaElements
    return []
  }

  private compositeVideoTracks(filters: string[], videoTracks: Array<{label: string, startTime: number, endTime: number}>, baseTrack: string): string {
    // Your existing compositeVideoTracks logic
    return 'video_composite'
  }

  private mixAudioTracks(filters: string[], audioTracks: Array<{label: string, startTime: number, endTime: number}>, timelineDuration: number): void {
    // Your existing mixAudioTracks logic
  }
} 