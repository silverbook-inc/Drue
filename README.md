# Drue

Drue helps you organize tasks across the places where work already happens, starting with email.

## What is in this repo

- `apps/web`: React + Vite frontend (`/`, `/login`, `/auth/callback`, `/dashboard`)
- `apps/api`: Express TypeScript API (`/health`, protected `/me`)
- Monorepo using npm workspaces

## Tech stack

- Frontend: React, Vite, TypeScript
- Backend: Express, TypeScript
- Auth: Supabase Auth with Google OAuth (PKCE)

## Prerequisites

- Node 22 (`nvm use 22`)
- npm
- Supabase project
- Google Cloud OAuth credentials

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create env files from examples:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

3. Fill in the env values (see below).

4. Start both apps:

```bash
npm run dev
```

5. Open:

- Web: `http://localhost:5173`
- API health: `http://localhost:3001/health`

## Environment variables

### `apps/web/.env`

```bash
VITE_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY>
VITE_API_URL=http://localhost:3001
```

### `apps/api/.env`

```bash
PORT=3001
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
SUPABASE_JWT_ISSUER=https://<YOUR_PROJECT_REF>.supabase.co/auth/v1
GMAIL_TOKEN_FILE=.local/gmail_tokens.txt
```

## Supabase + Google auth setup

1. In Supabase, enable Google provider:

- `Authentication -> Providers -> Google`
- Paste your Google `Client ID` and `Client Secret`

2. In Google Cloud OAuth client:

- Authorized JavaScript origin: `http://localhost:5173`
- Authorized redirect URI: `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`

3. In Supabase URL settings:

- `Authentication -> URL Configuration`
- `Site URL`: `http://localhost:5173`
- Add redirect URL: `http://localhost:5173/auth/callback`

4. For automatic Gmail token capture at login:

- Add Gmail readonly scope in your app OAuth setup.
- Drue requests this scope during Google login and stores refresh tokens in a local file during this temporary phase.
- File format: `email:token` (one per line), default path `apps/api/.local/gmail_tokens.txt`.

## Useful scripts

- `npm run dev`: run web + API together
- `ngrok http 3001`for the pubsub gmail integration, you might have to change the push address in the subscription to make this work.
- `npm run dev:web`: run only frontend
- `npm run dev:api`: run only API
- `npm run build`: build web + API
- `npm run lint`: lint web + API

## Troubleshooting

- OAuth callback errors:
- Check all callback/origin URLs match exactly (`localhost` vs `127.0.0.1`).
- Confirm Google provider is enabled in Supabase and credentials are valid.
- Login blocked in Google:
- If OAuth consent screen is in Testing mode, add your account as a test user.

## Brand direction (v1)

- Tone: simple, operational, calm
- Colors: `#0B1020` (ink), `#EEF3F8` (mist), `#3A7AFE` (signal), `#19A76B` (status)
- Typography: `Space Grotesk` (display), `Instrument Sans` (body)
