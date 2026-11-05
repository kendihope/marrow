import { initializeDatabase, pool, seedDatabase } from './database.js'

try {
  await initializeDatabase()
  await seedDatabase()
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products')
  console.log(`Database ready. ${rows[0].count} books are in the catalog.`)
} catch (error) {
  console.error('Could not initialize the database:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
