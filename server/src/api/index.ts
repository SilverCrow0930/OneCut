import { Router } from 'express'
import authRouter from './auth'
import projectsRouter from './projects'
import assetsRouter from './assets'

const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/projects', projectsRouter)
apiRouter.use('/assets', assetsRouter)

export default apiRouter