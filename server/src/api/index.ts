import { Router } from 'express'
import authRouter from './auth.js'
import projectsRouter from './projects.js'
import assetsRouter from './assets.js'
import timelineRouter from './timeline.js'
import transcriptionRouter from './transcription.js'
import aiRouter from './ai.js'
import voiceoverRouter from './voiceover.js'
import exportRouter from './export.js'
import quickclipsRouter from './quickclips.js'
import creditsRouter from './credits.js'
import subscriptionsRouter from './subscriptions.js'

const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/timeline', timelineRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/assets', assetsRouter)
apiRouter.use('/transcription', transcriptionRouter)
apiRouter.use('/ai', aiRouter)
apiRouter.use('/voiceover', voiceoverRouter)
apiRouter.use('/export', exportRouter)
apiRouter.use('/quickclips', quickclipsRouter)
apiRouter.use('/credits', creditsRouter)
apiRouter.use('/subscriptions', subscriptionsRouter)

export default apiRouter