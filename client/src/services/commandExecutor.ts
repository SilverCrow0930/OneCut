import { v4 as uuid } from 'uuid'
import { Command, Clip, Track, TrackType, ClipType } from '@/types/editor'

// AI Command Types - Extended to support all Lemona tools
export interface AICommand {
  type: 'ADD_TEXT' | 'ADD_CLIP' | 'REMOVE_CLIP' | 'UPDATE_CLIP' | 'TRIM_CLIP' | 'ADD_TRANSITION' | 
        'ADJUST_VOLUME' | 'CHANGE_SPEED' | 'ADD_VOICEOVER' | 'ADD_CAPTIONS' | 'ADD_STICKER' |
        'GENERATE_AI_CONTENT' | 'AUTO_CUT' | 'DOWNLOAD_ASSET' | 'APPLY_STYLE' | 'SPLIT_CLIP' |
        'ADD_MUSIC' | 'ADD_IMAGE' | 'ADD_VIDEO' | 'ENHANCE_AUDIO' | 'APPLY_FILTER'
  payload: any
}

export interface ExecutionResult {
  success: boolean
  message: string
  commands?: Command[]
  error?: string
}

export interface CommandValidation {
  isValid: boolean
  errors: string[]
}

export class CommandExecutor {
  private projectId: string
  private executeCommand: (cmd: Command) => void
  private tracks: Track[]
  private clips: Clip[]

  constructor(
    projectId: string, 
    executeCommand: (cmd: Command) => void,
    tracks: Track[],
    clips: Clip[]
  ) {
    this.projectId = projectId
    this.executeCommand = executeCommand
    this.tracks = tracks
    this.clips = clips
  }

  // Parse AI response and extract commands
  parseAIResponse(response: string): AICommand[] {
    try {
      // Look for JSON arrays in the response
      const jsonMatch = response.match(/\[[\s\S]*?\]/g)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // Look for single JSON objects
      const singleJsonMatch = response.match(/\{[\s\S]*?\}/g)
      if (singleJsonMatch) {
        const parsed = JSON.parse(singleJsonMatch[0])
        return Array.isArray(parsed) ? parsed : [parsed]
      }

      return []
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      return []
    }
  }

  // Validate AI command
  validateCommand(command: AICommand): CommandValidation {
    const errors: string[] = []

    if (!command.type) {
      errors.push('Command type is required')
    }

    if (!command.payload) {
      errors.push('Command payload is required')
    }

    switch (command.type) {
      case 'ADD_TEXT':
        if (!command.payload.content) {
          errors.push('Text content is required')
        }
        if (command.payload.timelineStartMs < 0) {
          errors.push('Timeline start must be positive')
        }
        if (command.payload.timelineEndMs <= command.payload.timelineStartMs) {
          errors.push('Timeline end must be after start')
        }
        break

      case 'TRIM_CLIP':
      case 'SPLIT_CLIP':
        if (!command.payload.clipId) {
          errors.push('Clip ID is required')
        }
        break

      case 'ADJUST_VOLUME':
        if (!command.payload.clipId) {
          errors.push('Clip ID is required for volume adjustment')
        }
        if (command.payload.volume < 0 || command.payload.volume > 2) {
          errors.push('Volume must be between 0 and 2')
        }
        break

      case 'ADD_VOICEOVER':
        if (!command.payload.script) {
          errors.push('Script text is required for voiceover')
        }
        break

      case 'ADD_CAPTIONS':
        if (!command.payload.style && !command.payload.autoGenerate) {
          errors.push('Caption style or auto-generate flag is required')
        }
        break

      case 'ADD_STICKER':
        if (!command.payload.stickerQuery && !command.payload.stickerUrl) {
          errors.push('Sticker query or URL is required')
        }
        break

      case 'GENERATE_AI_CONTENT':
        if (!command.payload.prompt) {
          errors.push('Prompt is required for AI content generation')
        }
        if (!command.payload.contentType) {
          errors.push('Content type (image/video/music) is required')
        }
        break

      case 'ADD_TRANSITION':
        if (!command.payload.transitionType) {
          errors.push('Transition type is required')
        }
        break
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Convert AI command to editor command(s)
  mapToEditorCommands(aiCommand: AICommand): Command[] {
    switch (aiCommand.type) {
      case 'ADD_TEXT':
        return this.createAddTextCommands(aiCommand.payload)
      
      case 'TRIM_CLIP':
        return this.createTrimClipCommands(aiCommand.payload)
      
      case 'ADJUST_VOLUME':
        return this.createVolumeAdjustCommands(aiCommand.payload)
      
      case 'CHANGE_SPEED':
        return this.createSpeedChangeCommands(aiCommand.payload)
      
      case 'REMOVE_CLIP':
        return this.createRemoveClipCommands(aiCommand.payload)

      case 'ADD_TRANSITION':
        return this.createAddTransitionCommands(aiCommand.payload)

      case 'SPLIT_CLIP':
        return this.createSplitClipCommands(aiCommand.payload)

      case 'ADD_STICKER':
        return this.createAddStickerCommands(aiCommand.payload)

      case 'ADD_VOICEOVER':
        return this.createAddVoiceoverCommands(aiCommand.payload)

      case 'ADD_CAPTIONS':
        return this.createAddCaptionsCommands(aiCommand.payload)

      case 'APPLY_STYLE':
        return this.createApplyStyleCommands(aiCommand.payload)

      case 'ADD_MUSIC':
        return this.createAddMusicCommands(aiCommand.payload)

      case 'ADD_IMAGE':
        return this.createAddImageCommands(aiCommand.payload)

      case 'ADD_VIDEO':
        return this.createAddVideoCommands(aiCommand.payload)

      case 'GENERATE_AI_CONTENT':
        return this.createGenerateAIContentCommands(aiCommand.payload)

      default:
        throw new Error(`Unsupported command type: ${aiCommand.type}`)
    }
  }

  // Create commands for adding text
  private createAddTextCommands(payload: any): Command[] {
    const {
      content,
      timelineStartMs = 0,
      timelineEndMs = 5000,
      style = 'default',
      trackIndex = 0,
      position = 'center',
      fontSize = 20,
      fontFamily = 'Arial',
      color = '#FFFFFF',
      backgroundColor = 'rgba(0,0,0,0.8)',
      textAlign = 'center'
    } = payload

    // Find or create text track
    let textTrack = this.tracks.find(t => t.type === 'text' && t.index === trackIndex)
    const commands: Command[] = []

    if (!textTrack) {
      // Create new text track
      textTrack = {
        id: uuid(),
        projectId: this.projectId,
        index: trackIndex,
        type: 'text' as TrackType,
        createdAt: new Date().toISOString(),
      }

      // Shift existing tracks if needed
      const tracksToShift = this.tracks.filter(t => t.index >= trackIndex)
      commands.push(
        ...tracksToShift.map(track => ({
          type: 'UPDATE_TRACK' as const,
          payload: {
            before: track,
            after: { ...track, index: track.index + 1 }
          }
        }))
      )

      commands.push({
        type: 'ADD_TRACK',
        payload: { track: textTrack }
      })
    }

    // Create text clip with enhanced styling
    const textClip: Clip = {
      id: uuid(),
      trackId: textTrack.id,
      type: 'text' as ClipType,
      sourceStartMs: 0,
      sourceEndMs: timelineEndMs - timelineStartMs,
      timelineStartMs,
      timelineEndMs,
      assetDurationMs: timelineEndMs - timelineStartMs,
      volume: 1,
      speed: 1,
      properties: {
        text: content,
        style: this.getTextStyle(style, {
          fontSize,
          fontFamily,
          color,
          backgroundColor,
          textAlign,
          position
        })
      },
      createdAt: new Date().toISOString(),
    }

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: textClip }
    })

    return commands
  }

  // Create commands for trimming clips
  private createTrimClipCommands(payload: any): Command[] {
    const { clipId, startMs, endMs } = payload
    
    const clip = this.clips.find(c => c.id === clipId)
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`)
    }

    const updatedClip = {
      ...clip,
      timelineStartMs: startMs ?? clip.timelineStartMs,
      timelineEndMs: endMs ?? clip.timelineEndMs
    }

    return [{
      type: 'UPDATE_CLIP',
      payload: {
        before: clip,
        after: updatedClip
      }
    }]
  }

  // Create commands for volume adjustment
  private createVolumeAdjustCommands(payload: any): Command[] {
    const { clipId, volume } = payload
    
    const clip = this.clips.find(c => c.id === clipId)
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`)
    }

    const updatedClip = {
      ...clip,
      volume: volume
    }

    return [{
      type: 'UPDATE_CLIP',
      payload: {
        before: clip,
        after: updatedClip
      }
    }]
  }

  // Create commands for speed change
  private createSpeedChangeCommands(payload: any): Command[] {
    const { clipId, speed } = payload
    
    const clip = this.clips.find(c => c.id === clipId)
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`)
    }

    const updatedClip = {
      ...clip,
      speed: speed
    }

    return [{
      type: 'UPDATE_CLIP',
      payload: {
        before: clip,
        after: updatedClip
      }
    }]
  }

  // Create commands for removing clips
  private createRemoveClipCommands(payload: any): Command[] {
    const { clipId } = payload
    
    const clip = this.clips.find(c => c.id === clipId)
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`)
    }

    return [{
      type: 'REMOVE_CLIP',
      payload: { clip }
    }]
  }

  // Create commands for adding transitions
  private createAddTransitionCommands(payload: any): Command[] {
    const { 
      clipId, 
      transitionType = 'fade', 
      duration = 1000, 
      position = 'in' // 'in', 'out', or 'between'
    } = payload

    const clip = this.clips.find(c => c.id === clipId)
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`)
    }

    const transitionDuration = Math.min(duration, (clip.timelineEndMs - clip.timelineStartMs) / 3)

    let updatedClip
    if (position === 'in') {
      updatedClip = {
        ...clip,
        properties: {
          ...clip.properties,
          transitionIn: {
            type: transitionType,
            duration: transitionDuration,
            endMs: clip.timelineStartMs + transitionDuration
          }
        }
      }
    } else {
      updatedClip = {
        ...clip,
        properties: {
          ...clip.properties,
          transitionOut: {
            type: transitionType,
            duration: transitionDuration,
            startMs: clip.timelineEndMs - transitionDuration
          }
        }
      }
    }

    return [{
      type: 'UPDATE_CLIP',
      payload: {
        before: clip,
        after: updatedClip
      }
    }]
  }

  // Create commands for splitting clips
  private createSplitClipCommands(payload: any): Command[] {
    const { clipId, splitTimeMs } = payload
    
    const clip = this.clips.find(c => c.id === clipId)
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`)
    }

    const splitTime = splitTimeMs || (clip.timelineStartMs + clip.timelineEndMs) / 2

    // Create the first part of the split clip
    const firstClip = {
      ...clip,
      timelineEndMs: splitTime,
      sourceEndMs: clip.sourceStartMs + (splitTime - clip.timelineStartMs)
    }

    // Create the second part of the split clip
    const secondClip = {
      ...clip,
      id: uuid(),
      timelineStartMs: splitTime,
      sourceStartMs: clip.sourceStartMs + (splitTime - clip.timelineStartMs)
    }

    return [
      {
        type: 'UPDATE_CLIP',
        payload: {
          before: clip,
          after: firstClip
        }
      },
      {
        type: 'ADD_CLIP',
        payload: {
          clip: secondClip
        }
      }
    ]
  }

  // Create commands for adding stickers
  private createAddStickerCommands(payload: any): Command[] {
    const {
      stickerQuery,
      stickerUrl,
      timelineStartMs = 0,
      timelineEndMs = 3000,
      trackIndex = 1,
      scale = 1,
      position = { x: 0, y: 0 }
    } = payload

    // Find or create video track for stickers (images go on video tracks in Lemona)
    let stickerTrack = this.tracks.find(t => t.type === 'video' && t.index === trackIndex)
    const commands: Command[] = []

    if (!stickerTrack) {
      stickerTrack = {
        id: uuid(),
        projectId: this.projectId,
        index: trackIndex,
        type: 'video' as TrackType,
        createdAt: new Date().toISOString(),
      }

      commands.push({
        type: 'ADD_TRACK',
        payload: { track: stickerTrack }
      })
    }

    // Create sticker clip (placeholder - actual implementation would need asset management)
    const stickerClip: Clip = {
      id: uuid(),
      trackId: stickerTrack.id,
      type: 'image' as ClipType,
      sourceStartMs: 0,
      sourceEndMs: timelineEndMs - timelineStartMs,
      timelineStartMs,
      timelineEndMs,
      assetDurationMs: timelineEndMs - timelineStartMs,
      volume: 1,
      speed: 1,
      properties: {
        isSticker: true,
        stickerQuery,
        stickerUrl,
        scale,
        position,
        crop: {
          width: 100,
          height: 100,
          left: 0,
          top: 0
        }
      },
      createdAt: new Date().toISOString(),
    }

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: stickerClip }
    })

    return commands
  }

  // Create commands for adding voiceover
  private createAddVoiceoverCommands(payload: any): Command[] {
    const {
      script,
      voice = 'default',
      speed = 1.0,
      timelineStartMs = 0,
      trackIndex = 0
    } = payload

    // Estimate duration based on script length (rough calculation)
    const estimatedDuration = Math.round(Math.max(3, script.split(' ').length * 0.6 / speed) * 1000)
    const timelineEndMs = timelineStartMs + estimatedDuration

    // Find or create audio track for voiceover
    let audioTrack = this.tracks.find(t => t.type === 'audio' && t.index === trackIndex)
    const commands: Command[] = []

    if (!audioTrack) {
      audioTrack = {
        id: uuid(),
        projectId: this.projectId,
        index: trackIndex,
        type: 'audio' as TrackType,
        createdAt: new Date().toISOString(),
      }

      commands.push({
        type: 'ADD_TRACK',
        payload: { track: audioTrack }
      })
    }

    // Create voiceover clip (placeholder - actual implementation would need API call)
    const voiceoverClip: Clip = {
      id: uuid(),
      trackId: audioTrack.id,
      type: 'audio' as ClipType,
      sourceStartMs: 0,
      sourceEndMs: estimatedDuration,
      timelineStartMs,
      timelineEndMs,
      assetDurationMs: estimatedDuration,
      volume: 1,
      speed,
      properties: {
        isVoiceover: true,
        script,
        voice,
        name: `Voiceover: ${script.substring(0, 30)}...`
      },
      createdAt: new Date().toISOString(),
    }

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: voiceoverClip }
    })

    return commands
  }

  // Create commands for adding captions
  private createAddCaptionsCommands(payload: any): Command[] {
    const {
      style = 'default',
      autoGenerate = true,
      segments = [],
      trackIndex = 2
    } = payload

    // Find or create text track for captions
    let captionTrack = this.tracks.find(t => t.type === 'text' && t.index === trackIndex)
    const commands: Command[] = []

    if (!captionTrack) {
      captionTrack = {
        id: uuid(),
        projectId: this.projectId,
        index: trackIndex,
        type: 'text' as TrackType,
        createdAt: new Date().toISOString(),
      }

      commands.push({
        type: 'ADD_TRACK',
        payload: { track: captionTrack }
      })
    }

    // Create caption clips for each segment
    if (segments.length > 0) {
      segments.forEach((segment: any) => {
        const captionClip: Clip = {
          id: uuid(),
          trackId: captionTrack!.id,
          type: 'text' as ClipType,
          sourceStartMs: 0,
          sourceEndMs: segment.endMs - segment.startMs,
          timelineStartMs: segment.startMs,
          timelineEndMs: segment.endMs,
          assetDurationMs: segment.endMs - segment.startMs,
          volume: 1,
          speed: 1,
          properties: {
            text: segment.text,
            isCaption: true,
            style: this.getCaptionStyle(style)
          },
          createdAt: new Date().toISOString(),
        }

        commands.push({
          type: 'ADD_CLIP',
          payload: { clip: captionClip }
        })
      })
    }

    return commands
  }

  // Create commands for applying styles
  private createApplyStyleCommands(payload: any): Command[] {
    const { clipId, styleType, styleProperties } = payload
    
    const clip = this.clips.find(c => c.id === clipId)
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`)
    }

    const updatedClip = {
      ...clip,
      properties: {
        ...clip.properties,
        style: styleProperties,
        styleType
      }
    }

    return [{
      type: 'UPDATE_CLIP',
      payload: {
        before: clip,
        after: updatedClip
      }
    }]
  }

  // Create commands for adding music
  private createAddMusicCommands(payload: any): Command[] {
    const {
      musicType = 'background',
      genre = 'ambient',
      duration = 30000,
      volume = 0.3,
      timelineStartMs = 0,
      trackIndex = 3
    } = payload

    // Find or create audio track for music
    let musicTrack = this.tracks.find(t => t.type === 'audio' && t.index === trackIndex)
    const commands: Command[] = []

    if (!musicTrack) {
      musicTrack = {
        id: uuid(),
        projectId: this.projectId,
        index: trackIndex,
        type: 'audio' as TrackType,
        createdAt: new Date().toISOString(),
      }

      commands.push({
        type: 'ADD_TRACK',
        payload: { track: musicTrack }
      })
    }

    const musicClip: Clip = {
      id: uuid(),
      trackId: musicTrack.id,
      type: 'audio' as ClipType,
      sourceStartMs: 0,
      sourceEndMs: duration,
      timelineStartMs,
      timelineEndMs: timelineStartMs + duration,
      assetDurationMs: duration,
      volume,
      speed: 1,
      properties: {
        isMusic: true,
        musicType,
        genre,
        name: `${genre} music`
      },
      createdAt: new Date().toISOString(),
    }

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: musicClip }
    })

    return commands
  }

  // Create commands for adding images
  private createAddImageCommands(payload: any): Command[] {
    const {
      imageQuery,
      imageUrl,
      duration = 5000,
      timelineStartMs = 0,
      trackIndex = 1,
      scale = 1,
      position = { x: 0, y: 0 }
    } = payload

    // Validate inputs
    if (!imageQuery && !imageUrl) {
      throw new Error('Either imageQuery or imageUrl must be provided for image generation')
    }

    // Find or create video track for images (images go on video tracks in Lemona)
    let imageTrack = this.tracks.find(t => t.type === 'video' && t.index === trackIndex)
    const commands: Command[] = []

    if (!imageTrack) {
      imageTrack = {
        id: uuid(),
        projectId: this.projectId,
        index: trackIndex,
        type: 'video' as TrackType,
        createdAt: new Date().toISOString(),
      }

      commands.push({
        type: 'ADD_TRACK',
        payload: { track: imageTrack }
      })
    }

    // For AI-generated content without URL, create placeholder with clear indication
    const finalImageUrl = imageUrl || `placeholder://ai-generated-image/${uuid()}`
    const displayName = imageQuery ? `AI Image: ${imageQuery}` : 'Generated Image'

    const imageClip: Clip = {
      id: uuid(),
      trackId: imageTrack.id,
      type: 'image' as ClipType,
      sourceStartMs: 0,
      sourceEndMs: duration,
      timelineStartMs,
      timelineEndMs: timelineStartMs + duration,
      assetDurationMs: duration,
      volume: 1,
      speed: 1,
      properties: {
        imageQuery,
        imageUrl: finalImageUrl,
        scale,
        position,
        crop: {
          width: 320,
          height: 180,
          left: 0,
          top: 0
        },
        isAIGenerated: !imageUrl, // Flag to indicate this is AI-generated content
        displayName
      },
      createdAt: new Date().toISOString(),
    }

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: imageClip }
    })

    return commands
  }

  // Create commands for adding video
  private createAddVideoCommands(payload: any): Command[] {
    const {
      videoQuery,
      videoUrl,
      duration = 10000,
      timelineStartMs = 0,
      trackIndex = 0,
      volume = 1
    } = payload

    // Validate inputs
    if (!videoQuery && !videoUrl) {
      throw new Error('Either videoQuery or videoUrl must be provided for video generation')
    }

    // Find or create video track
    let videoTrack = this.tracks.find(t => t.type === 'video' && t.index === trackIndex)
    const commands: Command[] = []

    if (!videoTrack) {
      videoTrack = {
        id: uuid(),
        projectId: this.projectId,
        index: trackIndex,
        type: 'video' as TrackType,
        createdAt: new Date().toISOString(),
      }

      commands.push({
        type: 'ADD_TRACK',
        payload: { track: videoTrack }
      })
    }

    // For AI-generated content without URL, create placeholder with clear indication
    const finalVideoUrl = videoUrl || `placeholder://ai-generated-video/${uuid()}`
    const displayName = videoQuery ? `AI Video: ${videoQuery}` : 'Generated Video'

    const videoClip: Clip = {
      id: uuid(),
      trackId: videoTrack.id,
      type: 'video' as ClipType,
      sourceStartMs: 0,
      sourceEndMs: duration,
      timelineStartMs,
      timelineEndMs: timelineStartMs + duration,
      assetDurationMs: duration,
      volume,
      speed: 1,
      properties: {
        videoQuery,
        videoUrl: finalVideoUrl,
        name: displayName,
        isAIGenerated: !videoUrl, // Flag to indicate this is AI-generated content
        displayName
      },
      createdAt: new Date().toISOString(),
    }

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: videoClip }
    })

    return commands
  }

  // Create commands for generating AI content
  private createGenerateAIContentCommands(payload: any): Command[] {
    const {
      prompt,
      contentType, // 'image', 'video', 'music'
      duration = 5000,
      timelineStartMs = 0,
      trackIndex = 1,
      style = 'default',
      quality = 'normal'
    } = payload

    // For now, create placeholder clips that would be replaced by actual AI generation
    // In a real implementation, this would trigger the AI generation API
    
    if (contentType === 'image') {
      return this.createAddImageCommands({
        imageQuery: prompt,
        duration,
        timelineStartMs,
        trackIndex
      })
    } else if (contentType === 'video') {
      return this.createAddVideoCommands({
        videoQuery: prompt,
        duration,
        timelineStartMs,
        trackIndex
      })
    } else if (contentType === 'music') {
      return this.createAddMusicCommands({
        genre: style,
        duration,
        timelineStartMs,
        trackIndex: trackIndex + 1 // Music usually goes on a separate audio track
      })
    }

    throw new Error(`Unsupported AI content type: ${contentType}`)
  }

  // Get text style based on style name
  private getTextStyle(styleName: string, styleProperties: any) {
    const styles: Record<string, any> = {
      default: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
      },
      bold: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        textShadow: '3px 3px 6px rgba(0,0,0,0.9)'
      },
      elegant: {
        fontSize: 22,
        fontWeight: '300',
        color: '#f0f0f0',
        textAlign: 'center',
        fontFamily: 'serif',
        textShadow: '1px 1px 3px rgba(0,0,0,0.7)'
      },
      neon: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#00ffff',
        textAlign: 'center',
        textShadow: '0 0 10px #00ffff, 0 0 20px #00ffff'
      }
    }

    return {
      ...styles[styleName] || styles.default,
      ...styleProperties
    }
  }

  // Get caption style based on style name
  private getCaptionStyle(styleName: string) {
    const styles: Record<string, any> = {
      default: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 18,
        fontWeight: 600,
        color: '#FFFFFF',
        textAlign: 'center',
        WebkitTextStroke: '1px #000000',
        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
      },
      'short-form': {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: 36,
        fontWeight: 900,
        color: '#FFFFFF',
        textAlign: 'center',
        WebkitTextStroke: '3px #000000',
        textShadow: '3px 3px 6px #000000',
        textTransform: 'uppercase'
      },
      professional: {
        fontFamily: 'Roboto, Arial, sans-serif',
        fontSize: 17,
        fontWeight: 500,
        color: '#FFFFFF',
        textAlign: 'left',
        background: 'rgba(0,0,0,0.9)',
        borderRadius: '0',
        padding: '4px 10px'
      },
      minimal: {
        fontFamily: 'Roboto, Helvetica, sans-serif',
        fontSize: 17,
        fontWeight: 400,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        textShadow: 'none'
      }
    }

    return styles[styleName] || styles.default
  }

  // Execute AI commands
  async executeAICommands(commands: AICommand[]): Promise<ExecutionResult> {
    try {
      const allEditorCommands: Command[] = []
      const executionMessages: string[] = []

      for (const aiCommand of commands) {
        // Validate command
        const validation = this.validateCommand(aiCommand)
        if (!validation.isValid) {
          return {
            success: false,
            error: `Invalid command: ${validation.errors.join(', ')}`,
            message: 'Command validation failed'
          }
        }

        // Convert to editor commands
        const editorCommands = this.mapToEditorCommands(aiCommand)
        allEditorCommands.push(...editorCommands)
        
        // Generate success message
        executionMessages.push(this.getSuccessMessage(aiCommand))
      }

      // Execute all commands in a batch
      if (allEditorCommands.length > 0) {
        this.executeCommand({
          type: 'BATCH',
          payload: { commands: allEditorCommands }
        })
      }

      return {
        success: true,
        message: executionMessages.join('\n'),
        commands: allEditorCommands
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to execute commands'
      }
    }
  }

  // Generate success message for command
  private getSuccessMessage(command: AICommand): string {
    switch (command.type) {
      case 'ADD_TEXT':
        return `✅ Added text "${command.payload.content}" from ${command.payload.timelineStartMs/1000}s to ${command.payload.timelineEndMs/1000}s`
      case 'TRIM_CLIP':
        return `✅ Trimmed clip`
      case 'ADJUST_VOLUME':
        return `✅ Adjusted volume to ${Math.round(command.payload.volume * 100)}%`
      case 'CHANGE_SPEED':
        return `✅ Changed speed to ${command.payload.speed}x`
      case 'REMOVE_CLIP':
        return `✅ Removed clip`
      case 'ADD_TRANSITION':
        return `✅ Added transition`
      case 'SPLIT_CLIP':
        return `✅ Split clip`
      case 'ADD_STICKER':
        return `✅ Added sticker`
      case 'ADD_VOICEOVER':
        return `✅ Added voiceover`
      case 'ADD_CAPTIONS':
        return `✅ Added captions`
      case 'APPLY_STYLE':
        return `✅ Applied style`
      case 'ADD_MUSIC':
        return `✅ Added music`
      case 'ADD_IMAGE':
        return `✅ Added image`
      case 'ADD_VIDEO':
        return `✅ Added video`
      case 'GENERATE_AI_CONTENT':
        return `✅ Generated AI content: ${command.payload.contentType}`
      default:
        return `✅ Executed ${command.type}`
    }
  }
}

// Helper function to create executor instance
export function createCommandExecutor(
  projectId: string,
  executeCommand: (cmd: Command) => void,
  tracks: Track[],
  clips: Clip[]
): CommandExecutor {
  return new CommandExecutor(projectId, executeCommand, tracks, clips)
}
