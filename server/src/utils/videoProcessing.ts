import ffmpeg from 'fluent-ffmpeg'
import { Storage } from '@google-cloud/storage'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'

const mkdir = promisify(fs.mkdir)
const unlink = promisify(fs.unlink)

interface ClipData {
    id: string
    title: string
    start_time: number
    end_time: number
    viral_score: number
    description: string
}

interface ProcessedClip extends ClipData {
    duration: number
    thumbnail: string
    downloadUrl: string
    previewUrl: string
}

export class VideoProcessor {
    private storage: Storage
    private bucket: any

    constructor() {
        this.storage = new Storage()
        this.bucket = this.storage.bucket('lemona-edit-assets')
    }

    async processClips(
        sourceFileUri: string,
        clips: ClipData[],
        projectId: string,
        videoFormat: 'short_vertical' | 'long_horizontal' = 'short_vertical',
        onProgress?: (current: number, total: number, clipTitle: string) => void,
        outputMode: 'individual' | 'stitched' = 'individual'
    ): Promise<ProcessedClip[]> {
        const tempDir = path.join('/tmp', `quickclips_${projectId}`)
        await mkdir(tempDir, { recursive: true })

        try {
            // Download source video to temp directory
            const sourceObjectKey = sourceFileUri.replace('gs://lemona-edit-assets/', '')
            const sourceFile = this.bucket.file(sourceObjectKey)
            const tempSourcePath = path.join(tempDir, 'source.mp4')
            
            await sourceFile.download({ destination: tempSourcePath })
            console.log(`Downloaded source video to: ${tempSourcePath}`)

            const processedClips: ProcessedClip[] = []

            if (outputMode === 'stitched') {
                // Create one stitched video from all segments
                return await this.createStitchedVideo(
                    tempSourcePath,
                    clips,
                    projectId,
                    videoFormat,
                    tempDir,
                    onProgress
                )
            }

            // Process each clip individually
            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i]
                const clipFileName = `clip_${i + 1}_${Date.now()}.mp4`
                const thumbnailFileName = `thumb_${i + 1}_${Date.now()}.jpg`
                const clipPath = path.join(tempDir, clipFileName)
                const thumbnailPath = path.join(tempDir, thumbnailFileName)

                // Call progress callback if provided
                if (onProgress) {
                    onProgress(i, clips.length, clip.title)
                }

                try {
                    // Extract video clip
                    await this.extractClip(
                        tempSourcePath,
                        clipPath,
                        clip.start_time,
                        clip.end_time,
                        videoFormat
                    )

                    // Generate thumbnail
                    await this.generateThumbnail(
                        tempSourcePath,
                        thumbnailPath,
                        clip.start_time + (clip.end_time - clip.start_time) / 2 // Middle of clip
                    )

                    // Upload clip and thumbnail to GCS
                    const clipGcsPath = `projects/${projectId}/clips/${clipFileName}`
                    const thumbnailGcsPath = `projects/${projectId}/thumbnails/${thumbnailFileName}`

                    await Promise.all([
                        this.bucket.upload(clipPath, { destination: clipGcsPath }),
                        this.bucket.upload(thumbnailPath, { destination: thumbnailGcsPath })
                    ])

                    // Generate signed URLs
                    const [clipDownloadUrl] = await this.bucket
                        .file(clipGcsPath)
                        .getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                        })

                    const [thumbnailUrl] = await this.bucket
                        .file(thumbnailGcsPath)
                        .getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                        })

                    processedClips.push({
                        ...clip,
                        duration: clip.end_time - clip.start_time,
                        thumbnail: thumbnailUrl,
                        downloadUrl: clipDownloadUrl,
                        previewUrl: clipDownloadUrl // Same as download for now
                    })

                    console.log(`✓ Processed clip ${i + 1}/${clips.length}: ${clip.title}`)

                } catch (clipError) {
                    console.error(`Failed to process clip ${i + 1}:`, clipError)
                    // Continue with other clips even if one fails
                }
            }

            return processedClips

        } finally {
            // Cleanup temp directory
            try {
                await this.cleanupTempDir(tempDir)
            } catch (cleanupError) {
                console.error('Failed to cleanup temp directory:', cleanupError)
            }
        }
    }

    private async extractClip(
        sourcePath: string,
        outputPath: string,
        startTime: number,
        endTime: number,
        videoFormat: 'short_vertical' | 'long_horizontal'
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const duration = endTime - startTime
            
            let command = ffmpeg(sourcePath)
                .seekInput(startTime)
                .duration(duration)
                .output(outputPath)

            // Apply format-specific settings
            if (videoFormat === 'short_vertical') {
                // Optimize for vertical mobile viewing
                command = command
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .size('1080x1920') // 9:16 aspect ratio
                    .aspect('9:16')
                    .videoBitrate('2500k')
                    .audioBitrate('128k')
                    .fps(30)
            } else {
                // Optimize for horizontal viewing
                command = command
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .size('1920x1080') // 16:9 aspect ratio
                    .aspect('16:9')
                    .videoBitrate('3500k')
                    .audioBitrate('128k')
                    .fps(30)
            }

            command
                .on('end', () => {
                    console.log(`✓ Extracted clip: ${outputPath}`)
                    resolve()
                })
                .on('error', (err) => {
                    console.error(`✗ Failed to extract clip: ${err.message}`)
                    reject(err)
                })
                .run()
        })
    }

    private async generateThumbnail(
        sourcePath: string,
        outputPath: string,
        timeInSeconds: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(sourcePath)
                .seekInput(timeInSeconds)
                .frames(1)
                .size('320x180')
                .output(outputPath)
                .on('end', () => {
                    console.log(`✓ Generated thumbnail: ${outputPath}`)
                    resolve()
                })
                .on('error', (err) => {
                    console.error(`✗ Failed to generate thumbnail: ${err.message}`)
                    reject(err)
                })
                .run()
        })
    }

    private async cleanupTempDir(tempDir: string): Promise<void> {
        const files = fs.readdirSync(tempDir)
        await Promise.all(
            files.map(file => unlink(path.join(tempDir, file)))
        )
        fs.rmdirSync(tempDir)
        console.log(`✓ Cleaned up temp directory: ${tempDir}`)
    }

    private async createStitchedVideo(
        sourcePath: string,
        clips: ClipData[],
        projectId: string,
        videoFormat: 'short_vertical' | 'long_horizontal',
        tempDir: string,
        onProgress?: (current: number, total: number, clipTitle: string) => void
    ): Promise<ProcessedClip[]> {
        const stitchedFileName = `stitched_${Date.now()}.mp4`
        const thumbnailFileName = `stitched_thumb_${Date.now()}.jpg`
        const stitchedPath = path.join(tempDir, stitchedFileName)
        const thumbnailPath = path.join(tempDir, thumbnailFileName)

        if (onProgress) {
            onProgress(0, 1, 'Creating highlight reel...')
        }

        try {
            // Create a filter complex for stitching clips
            await this.stitchClips(sourcePath, stitchedPath, clips, videoFormat)

            // Generate thumbnail from the middle of the first clip
            const firstClip = clips[0]
            const thumbnailTime = firstClip.start_time + (firstClip.end_time - firstClip.start_time) / 2
            await this.generateThumbnail(sourcePath, thumbnailPath, thumbnailTime)

            // Upload stitched video and thumbnail to GCS
            const stitchedGcsPath = `projects/${projectId}/stitched/${stitchedFileName}`
            const thumbnailGcsPath = `projects/${projectId}/thumbnails/${thumbnailFileName}`

            await Promise.all([
                this.bucket.upload(stitchedPath, { destination: stitchedGcsPath }),
                this.bucket.upload(thumbnailPath, { destination: thumbnailGcsPath })
            ])

            // Generate signed URLs
            const [stitchedDownloadUrl] = await this.bucket
                .file(stitchedGcsPath)
                .getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                })

            const [thumbnailUrl] = await this.bucket
                .file(thumbnailGcsPath)
                .getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
                })

            // Calculate total duration
            const totalDuration = clips.reduce((sum, clip) => sum + (clip.end_time - clip.start_time), 0)

            // Return as a single clip representing the stitched video
            return [{
                id: `stitched_${Date.now()}`,
                title: 'Highlight Reel',
                duration: totalDuration,
                start_time: 0,
                end_time: totalDuration,
                viral_score: clips.reduce((sum, clip) => sum + clip.viral_score, 0) / clips.length,
                description: `Stitched highlight reel containing ${clips.length} segments`,
                thumbnail: thumbnailUrl,
                downloadUrl: stitchedDownloadUrl,
                previewUrl: stitchedDownloadUrl
            }]

        } catch (error) {
            console.error('Failed to create stitched video:', error)
            throw error
        }
    }

    private async stitchClips(
        sourcePath: string,
        outputPath: string,
        clips: ClipData[],
        videoFormat: 'short_vertical' | 'long_horizontal'
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const filterComplex = clips.map((clip, index) => {
                const duration = clip.end_time - clip.start_time
                return `[0:v]trim=start=${clip.start_time}:duration=${duration},setpts=PTS-STARTPTS[v${index}]; [0:a]atrim=start=${clip.start_time}:duration=${duration},asetpts=PTS-STARTPTS[a${index}]`
            }).join('; ')

            const concatFilter = clips.map((_, index) => `[v${index}][a${index}]`).join('') + `concat=n=${clips.length}:v=1:a=1[outv][outa]`
            const fullFilter = `${filterComplex}; ${concatFilter}`

            let command = ffmpeg(sourcePath)
                .complexFilter(fullFilter)
                .outputOptions(['-map', '[outv]', '-map', '[outa]'])
                .output(outputPath)

            // Apply format-specific settings
            if (videoFormat === 'short_vertical') {
                command = command
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .size('1080x1920')
                    .aspect('9:16')
                    .videoBitrate('2500k')
                    .audioBitrate('128k')
                    .fps(30)
            } else {
                command = command
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .size('1920x1080')
                    .aspect('16:9')
                    .videoBitrate('3500k')
                    .audioBitrate('128k')
                    .fps(30)
            }

            command
                .on('end', () => {
                    console.log(`✓ Created stitched video: ${outputPath}`)
                    resolve()
                })
                .on('error', (err) => {
                    console.error(`✗ Failed to create stitched video: ${err.message}`)
                    reject(err)
                })
                .run()
        })
    }
} 