import { Router } from 'express'
import authRouter from './auth'
import projectsRouter from './projects'
import assetsRouter from './assets'
import timelineRouter from './timeline'
import transcriptionRouter from './transcription'
import aiRouter from './ai'

const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/timeline', timelineRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/assets', assetsRouter)
apiRouter.use('/transcription', transcriptionRouter)
apiRouter.use('/ai', aiRouter)

export default apiRouter