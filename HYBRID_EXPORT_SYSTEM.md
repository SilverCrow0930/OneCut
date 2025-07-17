# Hybrid Video Export System Implementation

## Overview
This system combines FFmpeg for media processing with Puppeteer for HTML/CSS rendering to ensure perfect editor-to-export fidelity.

## Architecture

### 1. Element Classification System
```javascript
// server/src/services/exportClassifier.ts
export interface ExportElement {
  id: string
  type: 'video' | 'audio' | 'image' | 'text' | 'caption' | 'sticker'
  complexity: 'simple' | 'complex'
  renderMethod: 'ffmpeg' | 'browser'
  timing: { start: number, end: number }
  properties: any
}

export function classifyElements(clips: TimelineClip[]): ExportElement[] {
  return clips.map(clip => ({
    id: clip.id,
    type: clip.type,
    complexity: determineComplexity(clip),
    renderMethod: determineRenderMethod(clip),
    timing: { start: clip.timelineStartMs, end: clip.timelineEndMs },
    properties: clip.properties
  }))
}

function determineComplexity(clip: TimelineClip): 'simple' | 'complex' {
  switch (clip.type) {
    case 'video':
    case 'audio':
      return 'simple' // FFmpeg handles these well
    case 'image':
      return clip.properties?.crop || clip.properties?.transforms ? 'complex' : 'simple'
    case 'text':
    case 'caption':
      return 'complex' // Always need browser for proper styling
    case 'sticker':
      return 'complex' // Animated positioning needs browser
    default:
      return 'simple'
  }
}
```

### 2. Browser-Based Frame Renderer
```javascript
// server/src/services/browserRenderer.ts
import puppeteer from 'puppeteer'

export class BrowserFrameRenderer {
  private browser: puppeteer.Browser
  private page: puppeteer.Page

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    this.page = await this.browser.newPage()
    await this.page.setViewport({ width: 1920, height: 1080 })
  }

  async renderFrameSequence(
    elements: ExportElement[],
    duration: number,
    fps: number = 30
  ): Promise<string[]> {
    const frames: string[] = []
    const frameCount = Math.ceil(duration * fps / 1000)
    
    // Create HTML template with video dimensions
    const htmlTemplate = this.createHtmlTemplate(elements)
    await this.page.setContent(htmlTemplate)
    
    for (let frame = 0; frame < frameCount; frame++) {
      const currentTimeMs = (frame / fps) * 1000
      
      // Update elements visibility/properties for current time
      await this.updateElementsForTime(currentTimeMs, elements)
      
      // Capture frame
      const screenshot = await this.page.screenshot({
        type: 'png',
        path: `temp/frame_${frame.toString().padStart(6, '0')}.png`
      })
      
      frames.push(`temp/frame_${frame.toString().padStart(6, '0')}.png`)
    }
    
    return frames
  }

  private createHtmlTemplate(elements: ExportElement[]): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              width: 1920px;
              height: 1080px;
              background: black;
              overflow: hidden;
              font-family: Arial, sans-serif;
            }
            .element {
              position: absolute;
              transition: none;
            }
            .text-element {
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              word-wrap: break-word;
            }
            .caption-element {
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 8px 16px;
              border-radius: 4px;
              font-weight: bold;
            }
            .sticker-element {
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
            }
          </style>
        </head>
        <body>
          ${elements.map(el => this.createElementHtml(el)).join('')}
          <script>
            window.updateElement = function(id, properties) {
              const element = document.getElementById(id)
              if (element) {
                Object.assign(element.style, properties)
              }
            }
          </script>
        </body>
      </html>
    `
  }

  private async updateElementsForTime(timeMs: number, elements: ExportElement[]) {
    for (const element of elements) {
      const isVisible = timeMs >= element.timing.start && timeMs <= element.timing.end
      const opacity = isVisible ? 1 : 0
      
      await this.page.evaluate((id, opacity) => {
        const el = document.getElementById(id)
        if (el) el.style.opacity = opacity.toString()
      }, element.id, opacity)
      
      // Apply transitions if needed
      if (element.properties?.transitionIn || element.properties?.transitionOut) {
        await this.applyTransitions(element, timeMs)
      }
    }
  }
}
```

### 3. Enhanced FFmpeg Compositor
```javascript
// server/src/services/hybridCompositor.ts
export class HybridCompositor {
  async compositeVideo(
    simpleElements: ExportElement[],
    browserFrames: string[],
    outputSettings: any
  ): Promise<string> {
    const ffmpegCommand = ffmpeg()
    
    // Add background video/audio tracks
    this.addMediaTracks(ffmpegCommand, simpleElements)
    
    // Add browser-rendered overlay
    if (browserFrames.length > 0) {
      ffmpegCommand.input(`temp/frame_%06d.png`)
        .inputFPS(30)
    }
    
    // Build complex filter graph
    const filterGraph = this.buildHybridFilterGraph(simpleElements, browserFrames.length > 0)
    
    return new Promise((resolve, reject) => {
      ffmpegCommand
        .complexFilter(filterGraph)
        .outputOptions([
          '-map [final_video]',
          '-map [final_audio]',
          '-c:v libx264',
          '-c:a aac',
          '-preset medium',
          '-crf 23',
          '-pix_fmt yuv420p'
        ])
        .output('output.mp4')
        .on('end', () => resolve('output.mp4'))
        .on('error', reject)
        .run()
    })
  }
  
  private buildHybridFilterGraph(elements: ExportElement[], hasBrowserOverlay: boolean): string {
    const filters = []
    
    // Process video tracks
    const videoTracks = elements.filter(e => e.type === 'video')
    let videoStream = this.buildVideoComposition(videoTracks, filters)
    
    // Overlay browser-rendered elements
    if (hasBrowserOverlay) {
      filters.push(`[${videoStream}][browser_overlay]overlay=0:0[final_video]`)
    } else {
      filters.push(`[${videoStream}]copy[final_video]`)
    }
    
    // Process audio tracks
    const audioTracks = elements.filter(e => e.type === 'audio')
    this.buildAudioComposition(audioTracks, filters)
    
    return filters.join(';')
  }
}
```

### 4. Export Job Manager
```javascript
// server/src/services/hybridExportManager.ts
export class HybridExportManager {
  async processExport(
    jobId: string,
    clips: TimelineClip[],
    exportSettings: any
  ): Promise<void> {
    const job = exportJobs.get(jobId)
    if (!job) return
    
    try {
      // Phase 1: Classify elements (5%)
      job.progress = 5
      const elements = classifyElements(clips)
      const simpleElements = elements.filter(e => e.renderMethod === 'ffmpeg')
      const complexElements = elements.filter(e => e.renderMethod === 'browser')
      
      // Phase 2: Download assets (10-30%)
      job.progress = 10
      await this.downloadAssets(elements, job)
      
      // Phase 3: Render complex elements with browser (30-60%)
      job.progress = 30
      let browserFrames: string[] = []
      if (complexElements.length > 0) {
        const renderer = new BrowserFrameRenderer()
        await renderer.initialize()
        browserFrames = await renderer.renderFrameSequence(
          complexElements,
          this.calculateDuration(elements),
          exportSettings.fps || 30
        )
        await renderer.cleanup()
      }
      
      // Phase 4: Composite with FFmpeg (60-90%)
      job.progress = 60
      const compositor = new HybridCompositor()
      const outputPath = await compositor.compositeVideo(
        simpleElements,
        browserFrames,
        exportSettings
      )
      
      // Phase 5: Upload and cleanup (90-100%)
      job.progress = 90
      await this.uploadAndCleanup(outputPath, browserFrames, job)
      
    } catch (error) {
      job.status = 'failed'
      job.error = error.message
    }
  }
}
```

### 5. Integration with Existing System
```javascript
// server/src/api/export.ts - Update existing endpoint
router.post('/start', validateExportRequest, async (req, res) => {
  // ... existing validation ...
  
  const jobId = uuid()
  const job: ExportJob = {
    id: jobId,
    status: 'queued',
    progress: 0,
    createdAt: new Date(),
    exportType: 'hybrid' // New export type
  }
  
  exportJobs.set(jobId, job)
  
  // Use hybrid export manager
  const hybridManager = new HybridExportManager()
  hybridManager.processExport(jobId, clips, tracks, exportSettings)
    .catch(err => {
      console.error(`[Export ${jobId}] Hybrid export failed:`, err)
      const job = exportJobs.get(jobId)
      if (job) {
        job.status = 'failed'
        job.error = err.message
      }
    })
  
  res.json({ success: true, jobId })
})
```

## Benefits of This Approach

1. **Perfect Fidelity**: Browser rendering ensures exact match with editor display
2. **Performance**: FFmpeg handles heavy media processing efficiently
3. **Scalability**: Can process multiple exports in parallel
4. **Flexibility**: Easy to add new styled elements
5. **Reliability**: Robust error handling and fallbacks

## Resource Requirements

- **Server**: 4+ CPU cores, 8GB+ RAM per concurrent export
- **Storage**: Temporary space for frame sequences
- **Dependencies**: Puppeteer, FFmpeg, sufficient fonts installed
- **Network**: Fast asset downloading capability

## Implementation Timeline

1. **Week 1**: Element classification system
2. **Week 2**: Browser frame renderer
3. **Week 3**: Hybrid compositor integration
4. **Week 4**: Testing and optimization
5. **Week 5**: Production deployment

## Performance Optimizations

- **Frame Caching**: Cache rendered frames for similar elements
- **Parallel Processing**: Render different time segments in parallel
- **Smart Cropping**: Only render visible portions of elements
- **Format Optimization**: Use efficient image formats for frame sequences
- **Memory Management**: Stream processing to avoid memory issues 