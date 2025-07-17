import { StyledElement } from './browserRenderer.js'

// Types matching your existing system - updated to include all properties
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

export interface ElementClassification {
  styledElements: StyledElement[]
  mediaElements: TimelineElement[]
  hasStyledElements: boolean
  hasMediaElements: boolean
}

export class ElementClassifier {
  static classify(elements: TimelineElement[]): ElementClassification {
    const styledElements: StyledElement[] = []
    const mediaElements: TimelineElement[] = []

    console.log(`[ElementClassifier] Classifying ${elements.length} elements`)

    for (const element of elements) {
      if (ElementClassifier.needsBrowserRendering(element)) {
        // Convert to styled element
        if (element.type === 'text' || element.type === 'caption' || element.type === 'sticker') {
          styledElements.push({
            id: element.id,
            type: element.type,
            timelineStartMs: element.timelineStartMs,
            timelineEndMs: element.timelineEndMs,
            properties: element.properties || {},
            text: element.text
          })
          console.log(`[ElementClassifier] -> STYLED: ${element.type} "${element.text?.substring(0, 30) || element.id}"`)
        }
      } else {
        mediaElements.push(element)
        console.log(`[ElementClassifier] -> MEDIA: ${element.type} (asset: ${element.assetId?.substring(0, 8) || 'none'})`)
      }
    }

    const classification = {
      styledElements,
      mediaElements,
      hasStyledElements: styledElements.length > 0,
      hasMediaElements: mediaElements.length > 0
    }

    console.log(`[ElementClassifier] Result: ${styledElements.length} styled, ${mediaElements.length} media elements`)
    
    return classification
  }

  private static needsBrowserRendering(element: TimelineElement): boolean {
    // Rule 1: Always use browser for text and captions
    // This ensures perfect font rendering and styling
    if (element.type === 'text' || element.type === 'caption') {
      return true
    }

    // Rule 2: Use browser for stickers/animated content
    if (element.type === 'sticker') {
      return true
    }

    // Rule 3: Check for external sticker assets (from Giphy, etc.)
    if (element.properties?.externalAsset?.originalData?.isSticker) {
      return true
    }

    // Rule 4: Use browser for any element with complex CSS styling
    if (element.properties?.style) {
      const style = element.properties.style
      
      // Complex styling that FFmpeg can't handle well
      if (style.boxShadow || 
          style.textShadow ||
          style.borderRadius ||
          style.background ||
          style.fontFamily ||
          style.gradient ||
          style.transform) {
        return true
      }
    }

    // Rule 5: Use browser for elements with transitions/animations
    if (element.properties?.transitionIn || element.properties?.transitionOut) {
      return true
    }

    // Rule 6: Use browser for complex positioning/cropping
    if (element.properties?.crop && (
      element.properties.crop.borderRadius ||
      element.properties.mediaScale !== 1 ||
      element.properties.rotation
    )) {
      return true
    }

    // Rule 7: Everything else uses FFmpeg (video, audio, simple images)
    return false
  }

  // Helper method to determine if we should use hybrid rendering at all
  static shouldUseHybridRendering(elements: TimelineElement[]): boolean {
    return elements.some(element => ElementClassifier.needsBrowserRendering(element))
  }

  // Get statistics for logging
  static getStats(classification: ElementClassification): string {
    const { styledElements, mediaElements } = classification
    
    const typeStats = {
      text: styledElements.filter(e => e.type === 'text').length,
      caption: styledElements.filter(e => e.type === 'caption').length,
      sticker: styledElements.filter(e => e.type === 'sticker').length,
      video: mediaElements.filter(e => e.type === 'video').length,
      audio: mediaElements.filter(e => e.type === 'audio').length,
      image: mediaElements.filter(e => e.type === 'image').length
    }

    const parts = []
    if (typeStats.text > 0) parts.push(`${typeStats.text} text`)
    if (typeStats.caption > 0) parts.push(`${typeStats.caption} caption`)
    if (typeStats.sticker > 0) parts.push(`${typeStats.sticker} sticker`)
    if (typeStats.video > 0) parts.push(`${typeStats.video} video`)
    if (typeStats.audio > 0) parts.push(`${typeStats.audio} audio`)
    if (typeStats.image > 0) parts.push(`${typeStats.image} image`)

    return parts.join(', ')
  }
}

// Export the function for backward compatibility
export function classifyElements(elements: TimelineElement[]): ElementClassification {
  return ElementClassifier.classify(elements)
} 