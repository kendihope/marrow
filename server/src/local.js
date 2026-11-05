import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import app from './server.js'
import { initializeDatabase } from './database.js'

const port = Number(process.env.PORT || 3001)
const clientBuild = path.resolve(fileURLToPath(new URL('../../client/dist', import.meta.url)))

app.use(express.static(clientBuild))
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' })
  res.sendFile(path.join(clientBuild, 'index.html'), (error) => { if (error) next(error) })
})
app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

const start = async () => {
  await initializeDatabase()
  app.listen(port, '0.0.0.0', () => console.log(`Marrow server listening on port ${port}`))
}

start().catch((error) => {
  console.error('Could not start the server:', error.message)
  process.exit(1)
})
