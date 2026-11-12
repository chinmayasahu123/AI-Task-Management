import { Router } from 'express'
import { pool } from '../db.js'
import { requireAuth } from '../auth/sessions.js'

const router = Router()
router.use(requireAuth)

router.get('/assignees', async (request, response) => {
  const [users] = await pool.query('SELECT id, name FROM users ORDER BY name')
  response.json({ users })
})

export default router
