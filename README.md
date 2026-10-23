# Marrow Street Books

A React and Tailwind shop with an Express and PostgreSQL API.

## Project map

- `client/` is the React/Vite storefront and its styles.
- `server/src/server.js` is the Express API and serves the built client in production.
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

The Vite development server forwards `/api` requests to Express at port 3001. In production Express serves both the React build and API from one origin, so the sign-in session cookie works with the storefront.

## API routes

- `GET /api/books` returns books and staff notes from Postgres as JSON.
- `GET /api/events` returns shop events.
- `GET /api/auth/session`, `POST /api/auth/signup`, `POST /api/auth/login`, and `POST /api/auth/logout` manage account sessions.
- `POST /api/newsletter` saves an email address.
- `POST /api/orders` stores an authenticated customer’s order request and its line items. It does not collect payment.

## Deployment

`render.yaml` describes a Render web service. Connect this repository to Render, provide `DATABASE_URL` from Supabase, and deploy. The Render service builds the Vite client and Express serves it at the same public URL as the API. Render generates `SESSION_SECRET` for the deployed service. Keep the local `.env` out of Git and add secrets through the deployment dashboard.
