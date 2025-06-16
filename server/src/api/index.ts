import { Router } from 'express'
import authRouter from './auth.js'
import projectsRouter from './projects.js'
import assetsRouter from './assets.js'
import timelineRouter from './timeline.js'
import transcriptionRouter from './transcription.js'
import falAiRouter from './ai.js'
import voiceoverRouter from './voiceover.js'
import exportRouter from './export.js'
import quickclipsRouter from './quickclips.js'

const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/timeline', timelineRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/assets', assetsRouter)
apiRouter.use('/transcription', transcriptionRouter)
apiRouter.use('/ai', falAiRouter)
apiRouter.use('/voiceover', voiceoverRouter)
apiRouter.use('/export', exportRouter)
apiRouter.use('/quickclips', quickclipsRouter)

export default apiRouter