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

The database tables are `users`, `products`, `events`, `newsletter_subscribers`, `orders`, and `order_items`. The session library creates `user_sessions`. Orders belong to a signed-in user, and order items keep the price that was requested. Newsletter addresses are unique so repeat signups do not create duplicates.

## Local setup

1. Create a Supabase project. In its dashboard, choose **Connect → Session pooler** and copy the PostgreSQL connection string. Replace the password placeholder with the database password; URL-encode reserved password characters.
2. Add the Supabase connection string to `DATABASE_URL` in the existing root `.env` file. Keep `.env` private; Git ignores it. This local checkout already has a random `SESSION_SECRET`. On a fresh clone, copy `.env.example` to `.env` and replace its example values before starting the API.
3. From a terminal in `server/`, run `npm install`, then `npm run seed`. The server also creates missing tables and seeds an empty catalog when it starts.
4. Start the API in one terminal from `server/` with `npm run dev`.
5. Start the storefront in a second terminal from `client/` with `npm install` then `npm run dev`.

The Vite development server forwards `/api` requests to Express at port 3001. On Netlify, `netlify.toml` publishes the Vite build and rewrites `/api/*` requests to the Express function on the same origin, so the sign-in session cookie works with the storefront. The Render setup remains available as an alternative in `render.yaml`.

## API routes

- `GET /api/books` returns books and staff notes from Postgres as JSON.
- `GET /api/events` returns shop events.
- `GET /api/auth/session`, `POST /api/auth/signup`, `POST /api/auth/login`, and `POST /api/auth/logout` manage account sessions.
- `POST /api/newsletter` saves an email address.
- `POST /api/orders` stores an authenticated customer’s order request and its line items. It does not collect payment.

## Deployment

### Netlify

Connect this repository to Netlify and select the `react-tailwind` branch. The root `netlify.toml` contains the build command, `client/dist` publish directory, function directory, and API rewrite. In Netlify's environment variable settings, add `DATABASE_URL` from Supabase, a random `SESSION_SECRET` of at least 32 characters, and `NODE_ENV=production`. The Supabase schema and starter data must be created with `npm run seed` from `server/` before the first deploy. Keep these secrets in Netlify's dashboard, never in Git.

`render.yaml` remains available if you prefer a single Render web service instead.
