import puppeteer, { Browser, Page } from 'puppeteer'
import fs from 'fs/promises'
import path from 'path'

// Extend window interface for our custom functions
declare global {
  interface Window {
    updateElement: (id: any, styles: any) => void
    setElementVisibility: (id: any, visible: any) => void
    applyTransition: (id: any, transitionStyles: any) => void
  }
}

export interface StyledElement {
  id: string
  type: 'text' | 'caption' | 'sticker'
  timelineStartMs: number
  timelineEndMs: number
  properties: any
  text?: string
}

export class BrowserRenderer {
  private browser: Browser | null = null
  private page: Page | null = null
  private tempDir: string
  private jobId: string

  constructor(tempDir: string, jobId: string) {
    this.tempDir = tempDir
    this.jobId = jobId
  }

  async initialize(width: number, height: number): Promise<void> {
    console.log(`[BrowserRenderer ${this.jobId}] Initializing browser (${width}x${height})`)
    
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--disable-gpu-sandbox'
      ]
    })

    this.page = await this.browser.newPage()
    await this.page.setViewport({ 
      width, 
      height, 
      deviceScaleFactor: 1 
    })
    
    // Load Google Fonts that match your editor
    await this.page.evaluateOnNewDocument(() => {
      const link = document.createElement('link')
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Roboto:wght@400;500;700;900&family=Open+Sans:wght@400;600;700;800&family=Poppins:wght@400;500;600;700;800;900&display=swap'
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    })

    console.log(`[BrowserRenderer ${this.jobId}] Browser initialized successfully`)
  }

  async renderOverlayFrames(
    styledElements: StyledElement[],
    totalDurationMs: number,
    fps: number = 30
  ): Promise<string | null> {
    if (!this.page || styledElements.length === 0) {
      return null
    }

    console.log(`[BrowserRenderer ${this.jobId}] Rendering ${styledElements.length} styled elements over ${totalDurationMs}ms`)

    const frameCount = Math.ceil((totalDurationMs / 1000) * fps)
    const overlayDir = path.join(this.tempDir, `overlay_${this.jobId}`)
    await fs.mkdir(overlayDir, { recursive: true })

    // Create HTML template that matches your ClipLayer.tsx
    const htmlContent = this.createHtmlTemplate(styledElements)
    await this.page.setContent(htmlContent, { waitUntil: 'networkidle0' })

    console.log(`[BrowserRenderer ${this.jobId}] HTML template loaded, rendering ${frameCount} frames`)

    // Render each frame
    for (let frame = 0; frame < frameCount; frame++) {
      const currentTimeMs = (frame / fps) * 1000
      
      // Update element visibility and effects for current time
      await this.updateElementsForTime(styledElements, currentTimeMs)
      
      // Capture frame with transparent background
      const framePath = path.join(overlayDir, `frame_${frame.toString().padStart(6, '0')}.png`) as `${string}.png`
      await this.page.screenshot({
        path: framePath,
        type: 'png',
        omitBackground: true // Critical: transparent background for overlay
      })

      // Log progress every 10% or every 30 frames
      if (frame % Math.max(1, Math.floor(frameCount / 10)) === 0 || frame % 30 === 0) {
        const progress = Math.round((frame / frameCount) * 100)
        console.log(`[BrowserRenderer ${this.jobId}] Frame ${frame}/${frameCount} (${progress}%)`)
      }
    }

    console.log(`[BrowserRenderer ${this.jobId}] Successfully rendered ${frameCount} overlay frames`)
    return overlayDir
  }

  private createHtmlTemplate(elements: StyledElement[]): string {
    const elementHtml = elements.map(element => this.createElementHtml(element)).join('')
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              width: 100vw;
              height: 100vh;
              overflow: hidden;
              background: transparent;
              font-family: 'Inter', 'Roboto', sans-serif;
              font-display: swap;
            }
            
            .element {
              position: absolute;
              transition: none;
              opacity: 0;
              pointer-events: none;
            }
            
            .text-element {
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              word-wrap: break-word;
              line-height: 1.4;
              padding: 0.5rem;
              white-space: pre-wrap;
              word-break: break-word;
              overflow: hidden;
            }
            
            .caption-element {
              display: flex;
              align-items: center;
              justify-content: center;
              text-align: center;
              background: rgba(0, 0, 0, 0.8);
              color: white;
              padding: 8px 16px;
              border-radius: 4px;
              font-weight: bold;
              line-height: 1.4;
              white-space: pre-wrap;
              word-break: break-word;
            }
            
            .sticker-element {
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
            }
            
            /* Placement styles matching your ClipLayer.tsx */
            .placement-top {
              top: 15% !important;
              transform: translateY(0%) !important;
            }
            
            .placement-bottom {
              bottom: 15% !important;
              transform: translateY(0%) !important;
            }
            
            .placement-middle {
              top: 50% !important;
              transform: translateY(-50%) !important;
            }
          </style>
        </head>
        <body>
          ${elementHtml}
          <script>
            window.updateElement = function(id, styles) {
              const element = document.getElementById(id)
              if (element) {
                Object.assign(element.style, styles)
              }
            }
            
            window.setElementVisibility = function(id, visible) {
              const element = document.getElementById(id)
              if (element) {
                element.style.opacity = visible ? '1' : '0'
              }
            }
            
            window.applyTransition = function(id, transitionStyles) {
              const element = document.getElementById(id)
              if (element) {
                Object.assign(element.style, transitionStyles)
              }
            }
          </script>
        </body>
      </html>
    `
  }

  private createElementHtml(element: StyledElement): string {
    const { id, type, properties, text } = element
    const style = this.buildElementStyle(element)
    const classes = this.buildElementClasses(element)
    
    switch (type) {
      case 'text':
        return `
          <div id="${id}" class="element text-element ${classes}" style="${style}">
            ${this.escapeHtml(text || 'Text')}
          </div>
        `
      
      case 'caption':
        return `
          <div id="${id}" class="element caption-element ${classes}" style="${style}">
            ${this.renderCaptionContent(text || 'Caption')}
          </div>
        `
      
      case 'sticker':
        const stickerUrl = properties?.externalAsset?.url || ''
        return `
          <div id="${id}" class="element sticker-element ${classes}" style="${style}; background-image: url('${stickerUrl}');">
          </div>
        `
      
      default:
        return ''
    }
  }

  private buildElementStyle(element: StyledElement): string {
    const { properties, type } = element
    const styles = []

    // Position and size - matching your ClipLayer.tsx crop logic
    if (properties?.crop) {
      styles.push(`left: ${properties.crop.left}px`)
      styles.push(`top: ${properties.crop.top}px`)
      styles.push(`width: ${properties.crop.width}px`)
      styles.push(`height: ${properties.crop.height}px`)
    } else {
      // Default sizes matching ClipLayer.tsx defaults
      if (type === 'text' || type === 'caption') {
        styles.push('width: 300px')
        styles.push('height: 80px')
      } else if (type === 'sticker') {
        styles.push('width: 200px')
        styles.push('height: 200px')
      }
    }

    // Text styling - exactly matching your ClipLayer.tsx properties
    if (properties?.style) {
      const style = properties.style
      
      if (style.fontSize) {
        const fontSize = typeof style.fontSize === 'number' ? style.fontSize + 'px' : style.fontSize
        styles.push(`font-size: ${fontSize}`)
      }
      
      if (style.color || style.fontColor) {
        styles.push(`color: ${style.color || style.fontColor}`)
      }
      
      if (style.fontFamily) {
        styles.push(`font-family: '${style.fontFamily}', sans-serif`)
      }
      
      if (style.fontWeight) {
        styles.push(`font-weight: ${style.fontWeight}`)
      }
      
      if (style.fontStyle) {
        styles.push(`font-style: ${style.fontStyle}`)
      }
      
      if (style.backgroundColor) {
        styles.push(`background-color: ${style.backgroundColor}`)
      }
      
      if (style.textAlign) {
        styles.push(`text-align: ${style.textAlign}`)
        if (style.textAlign === 'center') {
          styles.push('justify-content: center')
        } else if (style.textAlign === 'left') {
          styles.push('justify-content: flex-start')
        } else if (style.textAlign === 'right') {
          styles.push('justify-content: flex-end')
        }
      }
      
      if (style.borderRadius) {
        styles.push(`border-radius: ${style.borderRadius}px`)
      }
      
      if (style.padding) {
        styles.push(`padding: ${style.padding}px`)
      }
      
      if (style.boxShadow) {
        styles.push(`box-shadow: ${style.boxShadow}`)
      }

      if (style.textShadow) {
        styles.push(`text-shadow: ${style.textShadow}`)
      }

      if (style.border) {
        styles.push(`border: ${style.border}`)
      }
    }

    return styles.join('; ')
  }

  private buildElementClasses(element: StyledElement): string {
    const classes = []
    
    // Add placement class for text/captions
    if (element.type === 'text' || element.type === 'caption') {
      const placement = element.properties?.placement || 'middle'
      classes.push(`placement-${placement}`)
    }
    
    return classes.join(' ')
  }

  private renderCaptionContent(text: string): string {
    // Handle colored captions exactly like your ClipLayer.tsx
    if (text.includes('<span color=')) {
      const parts = text.split(/(<span color="[^"]*">.*?<\/span>)/g)
      return parts.map(part => {
        const spanMatch = part.match(/<span color="([^"]*)">(.*?)<\/span>/)
        if (spanMatch) {
          const [, color, highlightedText] = spanMatch
          return `<span style="color: ${color}; font-weight: bold;">${this.escapeHtml(highlightedText)}</span>`
        }
        return this.escapeHtml(part)
      }).join('')
    }
    return this.escapeHtml(text)
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private async updateElementsForTime(elements: StyledElement[], currentTimeMs: number): Promise<void> {
    if (!this.page) return

    for (const element of elements) {
      const isVisible = currentTimeMs >= element.timelineStartMs && currentTimeMs <= element.timelineEndMs
      
      // Set basic visibility
      await this.page.evaluate((id, visible) => {
        window.setElementVisibility(id, visible)
      }, element.id, isVisible)

      // Apply transitions if element is visible
      if (isVisible) {
        await this.applyTransitionsForTime(element, currentTimeMs)
      }
    }
  }

  private async applyTransitionsForTime(element: StyledElement, currentTimeMs: number): Promise<void> {
    if (!this.page) return

    const { timelineStartMs, timelineEndMs, properties } = element
    const transitionStyles: any = {}
    
    // Handle transition in
    if (properties?.transitionIn) {
      const transitionDuration = properties.transitionIn.duration || 1000
      if (currentTimeMs <= timelineStartMs + transitionDuration) {
        const progress = Math.min(1, (currentTimeMs - timelineStartMs) / transitionDuration)
        Object.assign(transitionStyles, this.getTransitionStyles(properties.transitionIn, progress, false))
      }
    }
    
    // Handle transition out
    if (properties?.transitionOut) {
      const transitionDuration = properties.transitionOut.duration || 1000
      const transitionStartTime = timelineEndMs - transitionDuration
      if (currentTimeMs >= transitionStartTime) {
        const progress = Math.min(1, (currentTimeMs - transitionStartTime) / transitionDuration)
        Object.assign(transitionStyles, this.getTransitionStyles(properties.transitionOut, progress, true))
      }
    }

    // Apply transition styles if any
    if (Object.keys(transitionStyles).length > 0) {
      await this.page.evaluate((id, styles) => {
        window.applyTransition(id, styles)
      }, element.id, transitionStyles)
    }
  }

  private getTransitionStyles(transition: any, progress: number, isOut: boolean): any {
    const { type } = transition
    const styles: any = {}

    switch (type) {
      case 'fade':
      case 'dissolve':
        styles.opacity = isOut ? (1 - progress) : progress
        break
      
      case 'slide':
        const translateX = isOut ? progress * 100 : (1 - progress) * 100
        styles.transform = `translateX(${-translateX}px)`
        break
      
      case 'zoom':
        const scale = isOut ? 1 - progress * 0.5 : 0.5 + progress * 0.5
        styles.transform = `scale(${scale})`
        styles.opacity = isOut ? (1 - progress) : progress
        break

      case 'wipe':
        const clipPercent = isOut ? (1 - progress) * 100 : progress * 100
        styles.clipPath = `inset(0 ${100 - clipPercent}% 0 0)`
        break

      case 'iris':
        const circleRadius = isOut ? (1 - progress) * 150 : progress * 150
        styles.clipPath = `circle(${circleRadius}% at center)`
        break
    }

    return styles
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close()
      this.page = null
    }
    
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    
    console.log(`[BrowserRenderer ${this.jobId}] Cleaned up browser resources`)
  }
} 