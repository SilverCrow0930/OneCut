import { Router } from 'express'
import authRouter from './auth'
import projectsRouter from './projects'

const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/projects', projectsRouter)

export default apiRouter