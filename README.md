# Marrow Street Books

A React and Tailwind shop with an Express and PostgreSQL API.

## Project map

- `client/` is the React/Vite storefront and its styles.
- `server/src/server.js` defines the Express API routes.
- `server/src/local.js` starts Express locally and serves the built client for the Render deployment.
- `server/netlify/functions/api.js` adapts the same Express API to a Netlify Function.
- `server/db/schema.sql` creates the database tables.
- `server/src/seed-data.js` is the readable catalog and event seed data.
- `server/src/seed.js` creates the schema and inserts or updates the starter catalog.

The database tables are `users`, `products`, `events`, `newsletter_subscribers`, `orders`, and `order_items`. The session library creates `user_sessions`. Orders belong to a signed-in user, and order items keep the database price used at checkout. Payment state and IntaSend invoice references are stored on each order. Newsletter addresses are unique so repeat signups do not create duplicates.

## Local setup

1. Create a Supabase project. In its dashboard, choose **Connect → Session pooler** and copy the PostgreSQL connection string. Replace the password placeholder with the database password; URL-encode reserved password characters.
2. Copy `.env.example` to the root `.env` file. Add the Supabase connection string to `DATABASE_URL`, keep a random `SESSION_SECRET` of at least 32 characters, and add your IntaSend sandbox publishable and secret keys plus a private webhook challenge. Keep `.env` private; Git ignores it. Never commit or share the IntaSend secret key.
3. From a terminal in `server/`, run `npm install`, then `npm run seed`. The server also creates missing tables and seeds an empty catalog when it starts.
4. Start the API in one terminal from `server/` with `npm run dev`.
5. Start the storefront in a second terminal from `client/` with `npm install` then `npm run dev`.

The Vite development server forwards `/api` requests to Express at port 3001. On Netlify, `netlify.toml` publishes the Vite build and rewrites `/api/*` requests to the Express function on the same origin, so the sign-in session cookie works with the storefront. The Render setup remains available as an alternative in `render.yaml`.

## Authentication and customer accounts

Marrow Street Books uses a server-managed, cookie-based account system. Authentication is handled by the Express API; the React storefront never receives or stores password hashes or session secrets.

### Customer flow

- **Create an account:** customers provide a name, email address, and password (8–72 characters). The API normalizes email addresses and hashes passwords with `bcryptjs` at cost factor 12 before storing them in the `users` table.
- **Sign in:** the API looks up the normalized email, compares the submitted password with the stored bcrypt hash, and creates a fresh session after successful authentication.
- **Stay signed in:** the session identifier is held in an HTTP-only cookie named `marrow.sid`. Session data is stored server-side in PostgreSQL using `connect-pg-simple` and the `user_sessions` table. The cookie uses `SameSite=Lax`, a seven-day maximum age, and the `Secure` flag in production.
- **Check the current session:** the storefront calls `GET /api/auth/session` to restore the signed-in customer after a page reload.
- **Sign out:** `POST /api/auth/logout` destroys the server-side session and clears the session cookie.

### Authentication API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/auth/session` | Return the current customer, or `null` when signed out. |
| POST | `/api/auth/signup` | Validate details, create the account, and sign the customer in. |
| POST | `/api/auth/login` | Verify credentials and start a new session. |
| POST | `/api/auth/logout` | Destroy the current session. |

Signup and login are rate-limited to 20 requests per 15-minute window per client. Passwords are never stored in plain text. The server regenerates the session on successful signup or login to reduce session-fixation risk.

### Protected customer actions

- `POST /api/orders` requires a signed-in customer. The order is associated with the authenticated user ID from the server session, not a user ID supplied by the browser.
- `GET /api/orders/:id` only returns an order when it belongs to the signed-in customer.
- Product prices and totals are read and calculated on the server from the database; client-submitted prices are not trusted.

### Authentication configuration and current scope

Set `DATABASE_URL` and a strong, random `SESSION_SECRET` (at least 32 characters) in the deployment environment. Keep the session secret out of source control. On Netlify, the API rewrite keeps the storefront and API on the same site origin so the session cookie can be used by both.

The current account implementation includes email/password signup, sign-in, sign-out, and persistent sessions. Password reset, email verification, social sign-in, and role-based administration are not currently implemented.

## API routes

- `GET /api/books` returns books and staff notes from Postgres as JSON.
- `GET /api/events` returns shop events.
- `GET /api/auth/session`, `POST /api/auth/signup`, `POST /api/auth/login`, and `POST /api/auth/logout` manage account sessions.
- `POST /api/newsletter` saves an email address.
- `POST /api/orders` creates an authenticated pending order using product prices from Postgres, then creates an IntaSend USD hosted checkout and returns its redirect URL.
- `GET /api/orders/:id` returns the signed-in customer's order and payment status.
- `POST /api/intasend/webhook` validates the configured challenge and confirms completed invoices with IntaSend before marking an order paid.

## Deployment

### Netlify

Connect this repository to Netlify and select the `react-tailwind` branch. The root `netlify.toml` contains the build command, `client/dist` publish directory, function directory, and API rewrite. In Netlify's environment variable settings, add `DATABASE_URL` from Supabase, a random `SESSION_SECRET` of at least 32 characters, and `NODE_ENV=production`. The Supabase schema and starter data must be created with `npm run seed` from `server/` before the first deploy. For an existing deployed database, run `server/db/migrations/001_intasend_payments.sql` once in the Supabase SQL Editor before testing payments; the Netlify function does not run the local database initializer. Add `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `INTASEND_PUBLIC_KEY`, `INTASEND_SECRET_KEY`, and `INTASEND_WEBHOOK_CHALLENGE` to Netlify's environment variables. Set `SITE_URL` only if Netlify's built-in `URL` value is unavailable. Configure an IntaSend webhook with endpoint `https://YOUR-SITE/api/intasend/webhook`, use the same challenge value as `INTASEND_WEBHOOK_CHALLENGE`, and subscribe to `collection_event`. Keep all secrets in Netlify's dashboard, never in Git.

`render.yaml` remains available if you prefer a single Render web service instead.


## IntaSend sandbox checkout

The storefront redirects customers to IntaSend hosted checkout in USD. The checkout page displays the payment methods enabled for the merchant account and currency; the backend does not trust the return redirect. Only a verified `COMPLETE` invoice with the matching order reference, USD currency, and exact amount changes an order to `paid`. Failed or cancelled invoices do not mark an order as paid.

For local testing, set `SITE_URL` to the Vite storefront origin (normally `http://localhost:5173`) and configure the IntaSend webhook to reach your public HTTPS development URL. For deployment, use the Netlify site URL. Run a sandbox payment and confirm the webhook updates the order before switching to live keys.
