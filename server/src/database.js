import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { products, events } from './seed-data.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
dotenv.config({ path: path.join(projectRoot, '.env') })

const { Pool } = pg
export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function initializeDatabase() {
  const schemaPath = path.join(projectRoot, 'server', 'db', 'schema.sql')
  const schema = await fs.readFile(schemaPath, 'utf8')
  await pool.query(schema)

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM products')
  if (rows[0].count === 0) await seedDatabase()
}

export async function seedDatabase() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const [index, product] of products.entries()) {
      const categoryOrder = product.category === 'fiction' ? 1 : product.category === 'nonfiction' ? 2 : 3
      await client.query(`
        INSERT INTO products
          (title, author, price_cents, category, image_url, image_alt, cover_style,
           staff_note, staff_by, is_new_arrival, category_order, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (title) DO UPDATE SET
          author = EXCLUDED.author, price_cents = EXCLUDED.price_cents,
          category = EXCLUDED.category, image_url = EXCLUDED.image_url,
          image_alt = EXCLUDED.image_alt, cover_style = EXCLUDED.cover_style,
          staff_note = EXCLUDED.staff_note, staff_by = EXCLUDED.staff_by,
          is_new_arrival = EXCLUDED.is_new_arrival,
          category_order = EXCLUDED.category_order, sort_order = EXCLUDED.sort_order
      `, [product.title, product.author, product.priceCents, product.category,
        product.imageUrl || null, product.imageAlt || null, product.coverStyle || null,
        product.staffNote || null, product.staffBy || null, Boolean(product.isNewArrival),
        categoryOrder, index + 1])
    }
    for (const event of events) {
      await client.query(`
        INSERT INTO events (title, subject, description, starts_at, time_label)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (title) DO UPDATE SET subject = EXCLUDED.subject,
          description = EXCLUDED.description, starts_at = EXCLUDED.starts_at,
          time_label = EXCLUDED.time_label
      `, [event.title, event.subject, event.description, event.startsAt, event.timeLabel])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
