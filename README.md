# Family Timeline – MVP

Private family photo timeline with gallery, tags, and video generation.

## Tech Stack

- **Next.js 14+** (App Router, TypeScript)
- **Tailwind CSS**
- **Prisma** + **Turso** (libSQL / SQLite-compatible)
- **Cloudinary** (image storage & transforms)
- **Vercel** (deploy)

## Local Setup

```bash
# 1. Clone & install
git clone <repo-url> && cd family-timeline
npm install

# 2. Environment variables
cp .env.example .env.local
# Edit .env.local with your values (see below)

# 3. Database – choose one:

# Option A: Local SQLite (quick start)
npx prisma db push

# Option B: Turso (production-like)
# Install Turso CLI: https://docs.turso.tech/cli/installation
turso db create family-timeline
turso db show family-timeline --url   # → paste into TURSO_DATABASE_URL
turso db tokens create family-timeline # → paste into TURSO_AUTH_TOKEN
npx prisma db push

# 4. Run
npm run dev
# Open http://localhost:3000
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FAMILY_PASSWORD` | Single shared password for family access |
| `TURSO_DATABASE_URL` | Turso database URL (omit for local SQLite) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

## Auth

Simple password gate — one shared password set via `FAMILY_PASSWORD` env var.  
Middleware checks a `family_auth` cookie on every request; unauthenticated users are redirected to `/login`.

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Set all env vars in Vercel dashboard
4. Deploy ✅
