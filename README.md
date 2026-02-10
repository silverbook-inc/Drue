# Drue

Drue is a TODO orchestration app. It helps you meet your tasks where they already live, starting with email.

## Tech stack

- Frontend: React + Vite + TypeScript
- Backend API: Express + TypeScript
- Auth: Supabase Auth with Google OAuth
- Repo shape: npm workspaces monorepo

## Project structure

- `apps/web`: landing page, login, auth callback, placeholder dashboard
- `apps/api`: API server with health check and protected sample endpoint

## 1) Create Supabase project and Google auth

1. Create a Supabase project.
2. In Supabase: `Authentication -> Providers -> Google` and enable Google provider.
3. In Google Cloud Console:
- Create OAuth client credentials.
- Add authorized redirect URI: `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
4. In Supabase redirect URL config:
- Add `http://localhost:5173/auth/callback`
- Add your production callback URL later.

Reference docs:

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/quickstarts/react

## 2) Configure environment variables

### `apps/web/.env`

```bash
VITE_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
VITE_API_URL=http://localhost:3001
```

### `apps/api/.env`

```bash
PORT=3001
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
SUPABASE_JWT_ISSUER=https://<YOUR_PROJECT_REF>.supabase.co/auth/v1
```

## 3) Install and run

```bash
npm install
npm run dev
```

Web app: `http://localhost:5173`

API health check: `http://localhost:3001/health`

## Brand direction (v1 proposal)

- Name tone: simple, operational, calm
- Palette:
- `#0B1020` (ink)
- `#EEF3F8` (mist)
- `#3A7AFE` (signal)
- `#19A76B` (status)
- Typography: `Space Grotesk` for display, `Instrument Sans` for body

