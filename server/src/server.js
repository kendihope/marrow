import express from 'express'
import crypto from 'node:crypto'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { pool } from './database.js'

const app = express()
const isProduction = process.env.NODE_ENV === 'production'
const PgSession = connectPgSimple(session)

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL. Add your Supabase connection string to the project root .env file.')
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters. Add a random secret to the project root .env file.')
}

if (isProduction) app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'style-src': ["'self'", "'unsafe-inline'"] } } }))
app.use(express.json({ limit: '32kb' }))
app.use(session({
  name: 'marrow.sid',
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 1000 * 60 * 60 * 24 * 7 },
}))

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })
const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase())
const passwordSchema = z.string().min(8).max(72)
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email }
}

function setSessionUser(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error)
      req.session.user = publicUser(user)
      req.session.save((saveError) => saveError ? reject(saveError) : resolve())
    })
  })
}

function requireUser(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in to continue.' })
  next()
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok', database: 'connected' })
}))

app.get('/api/books', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT id, title, author, price_cents, category, image_url, image_alt, cover_style,
           staff_note, staff_by, is_new_arrival
    FROM products
    WHERE active = TRUE
    ORDER BY category_order, sort_order, id
  `)
  res.json(rows.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    price: book.price_cents / 100,
    category: book.category,
    image: book.image_url,
    alt: book.image_alt,
    cover: book.cover_style,
    note: book.staff_note,
    by: book.staff_by,
    isNewArrival: book.is_new_arrival,
  })))
}))

app.get('/api/events', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT id, title, subject, description, time_label,
           to_char(starts_at, 'YYYY-MM-DD"T"HH24:MI') AS date_time,
           to_char(starts_at, 'Mon') AS month,
           to_char(starts_at, 'DD') AS day
    FROM events WHERE active = TRUE AND starts_at >= NOW() ORDER BY starts_at
  `)
  res.json(rows.map((event) => ({
    id: event.id,
    title: event.title,
    subject: event.subject,
    description: event.description,
    dateTime: event.date_time,
    time: event.time_label,
    month: event.month,
    day: String(Number(event.day)),
  })))
}))

app.get('/api/auth/session', (req, res) => {
  res.json({ user: req.session.user || null })
})

app.post('/api/auth/signup', authLimiter, asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(1).max(80),
    email: emailSchema,
    password: passwordSchema,
  }).safeParse(req.body)
  if (!input.success) return res.status(400).json({ error: input.error.issues[0]?.message || 'Check the signup details.' })
  const { name, email, password } = input.data
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash],
    )
    await setSessionUser(req, rows[0])
    res.status(201).json({ user: publicUser(rows[0]) })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' })
    throw error
  }
}))

app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const input = z.object({ email: emailSchema, password: passwordSchema }).safeParse(req.body)
  if (!input.success) return res.status(400).json({ error: input.error.issues[0]?.message || 'Check your login details.' })
  const { rows } = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [input.data.email])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(input.data.password, user.password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  await setSessionUser(req, user)
  res.json({ user: publicUser(user) })
}))

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error)
    res.clearCookie('marrow.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction })
    res.status(204).end()
  })
})

app.post('/api/newsletter', asyncRoute(async (req, res) => {
  const input = z.object({ email: emailSchema }).safeParse(req.body)
  if (!input.success) return res.status(400).json({ error: 'Enter a valid email address.' })
  await pool.query('INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [input.data.email])
  res.status(201).json({ message: 'Your signup has been saved.' })
}))


function safeStringEqual(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function getIntaSendInvoice(invoiceId) {
  const secretKey = process.env.INTASEND_SECRET_KEY
  if (!secretKey) throw new Error('IntaSend secret key is not configured.')
  const response = await fetch('https://api.intasend.com/api/v1/payment/status/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || data.detail || 'Could not verify the IntaSend payment.')
  return data.invoice || data
}

app.post('/api/intasend/webhook', asyncRoute(async (req, res) => {
  const challenge = process.env.INTASEND_WEBHOOK_CHALLENGE
  if (!challenge) return res.status(503).json({ error: 'Payment webhook is not configured.' })
  const event = req.body || {}
  if (!safeStringEqual(event.challenge, challenge)) return res.sendStatus(401)
  if (event.topic !== 'collection_event') return res.sendStatus(200)
  if (!event.invoice_id || !event.api_ref) return res.sendStatus(400)

  const { rows } = await pool.query(
    'SELECT id, total_cents, status, intasend_invoice_id FROM orders WHERE intasend_api_ref = $1',
    [event.api_ref],
  )
  const order = rows[0]
  if (!order) return res.sendStatus(200)

  if (event.state === 'COMPLETE') {
    const invoice = await getIntaSendInvoice(event.invoice_id)
    const amountText = String(invoice.value ?? '')
    const amountMatch = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amountText)
    const paidCents = amountMatch
      ? Number(amountMatch[1]) * 100 + Number((amountMatch[2] || '').padEnd(2, '0'))
      : NaN
    const isVerified = invoice.state === 'COMPLETE'
      && String(invoice.invoice_id) === String(event.invoice_id)
      && invoice.api_ref === event.api_ref
      && String(invoice.currency).toUpperCase() === 'USD'
      && Number.isSafeInteger(paidCents)
      && paidCents === order.total_cents

    if (!isVerified) {
      console.error('IntaSend payment did not match order', order.id)
      return res.sendStatus(400)
    }

    await pool.query(
      `UPDATE orders
       SET status = 'paid', intasend_invoice_id = $1, paid_at = COALESCE(paid_at, NOW())
       WHERE id = $2 AND (intasend_invoice_id IS NULL OR intasend_invoice_id = $1)`,
      [event.invoice_id, order.id],
    )
  } else if (['FAILED', 'CANCELED'].includes(event.state)) {
    await pool.query(
      `UPDATE orders SET status = 'payment_failed'
       WHERE id = $1 AND status <> 'paid'`,
      [order.id],
    )
  }

  res.sendStatus(200)
}))

app.post('/api/orders', requireUser, asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    note: z.string().trim().max(1000).optional().default(''),
    items: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(10) })).min(1).max(30),
  }).safeParse(req.body)
  if (!input.success) return res.status(400).json({ error: input.error.issues[0]?.message || 'Check the order details.' })

  const publicKey = process.env.INTASEND_PUBLIC_KEY || process.env.INTASEND_PUBLISHABLE_KEY
  const secretKey = process.env.INTASEND_SECRET_KEY
  if (!publicKey || !secretKey) {
    return res.status(503).json({ error: 'Card checkout is not configured yet. Please try again later.' })
  }

  const client = await pool.connect()
  let order
  try {
    await client.query('BEGIN')
    const productIds = [...new Set(input.data.items.map((item) => item.productId))]
    const { rows: products } = await client.query(
      'SELECT id, title, price_cents FROM products WHERE id = ANY($1::integer[]) AND active = TRUE FOR SHARE',
      [productIds],
    )
    if (products.length !== productIds.length) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'One or more books are no longer available.' })
    }
    const productMap = new Map(products.map((product) => [product.id, product]))
    const items = input.data.items.map((item) => ({ ...item, product: productMap.get(item.productId) }))
    const totalCents = items.reduce((total, item) => total + item.product.price_cents * item.quantity, 0)
    const { rows: orders } = await client.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, note, total_cents, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id, status, total_cents`,
      [req.session.user.id, input.data.name, input.data.email, input.data.note, totalCents],
    )
    order = orders[0]
    const apiRef = `marrow-order-${order.id}`
    await client.query('UPDATE orders SET intasend_api_ref = $1 WHERE id = $2', [apiRef, order.id])
    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)',
        [order.id, item.productId, item.quantity, item.product.price_cents],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  const siteUrl = process.env.URL || process.env.SITE_URL || req.get('origin')
  if (!siteUrl) {
    await pool.query("UPDATE orders SET status = 'payment_failed' WHERE id = $1", [order.id])
    return res.status(503).json({ error: 'The shop return URL is not configured.' })
  }

  const apiRef = `marrow-order-${order.id}`
  const customerNames = input.data.name.trim().split(/\s+/)
  const firstName = customerNames.shift() || 'Customer'
  const lastName = customerNames.join(' ') || ' '
  const checkoutResponse = await fetch('https://api.intasend.com/api/v1/checkout/', {
    method: 'POST',
    headers: {
      'X-IntaSend-Public-API-Key': publicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: order.total_cents / 100,
      currency: 'USD',
      email: input.data.email,
      first_name: firstName,
      last_name: lastName,
      api_ref: apiRef,
      unique_api_ref: true,
      redirect_url: `${siteUrl.replace(/\\/$/, '')}/?payment=return&order=${order.id}`,
      host: siteUrl,
    }),
  })
  const checkout = await checkoutResponse.json().catch(() => ({}))
  if (!checkoutResponse.ok || !checkout.url || !checkout.id) {
    await pool.query("UPDATE orders SET status = 'payment_failed' WHERE id = $1 AND status <> 'paid'", [order.id])
    console.error('IntaSend checkout creation failed:', checkout.message || checkout.detail || checkoutResponse.status)
    return res.status(502).json({ error: checkout.message || checkout.detail || 'We could not start card checkout. Please try again.' })
  }

  await pool.query(
    'UPDATE orders SET intasend_invoice_id = $1 WHERE id = $2',
    [checkout.id, order.id],
  )
  res.status(201).json({
    order: { id: order.id, status: 'pending', total: order.total_cents / 100 },
    checkoutUrl: checkout.url,
  })
}))

app.get('/api/orders/:id', requireUser, asyncRoute(async (req, res) => {
  const orderId = Number(req.params.id)
  if (!Number.isSafeInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'Invalid order reference.' })
  const { rows } = await pool.query(
    'SELECT id, status, total_cents, paid_at FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, req.session.user.id],
  )
  if (!rows[0]) return res.status(404).json({ error: 'Order not found.' })
  res.json({ order: { id: rows[0].id, status: rows[0].status, total: rows[0].total_cents / 100, paidAt: rows[0].paid_at } })
}))


app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' })
  next()
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

export default app
