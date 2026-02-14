# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm start            # Start production server
npm run db:generate  # Generate Prisma client (run after schema changes)
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio (DB explorer)
```

No test or lint commands are configured.

## Architecture

**Family Timeline** — a private family photo timeline app with Hebrew (RTL) UI. Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma ORM, Cloudinary for image storage.

### Data Layer

- **ORM:** Prisma with SQLite locally (`prisma/dev.db`), Turso (libSQL) in production
- **DB client:** `lib/db.ts` — factory that uses Turso adapter when `TURSO_DATABASE_URL` is set, otherwise local SQLite
- **Schema:** `prisma/schema.prisma` — four models: `Photo`, `Tag`, `PhotoTag` (many-to-many join), `VideoJob`
- **Cloudinary config:** `lib/cloudinary.ts`

### Auth

Single shared password gate. `middleware.ts` checks `family_auth` cookie on all routes except `/login`, `/api/login`, `/api/health`. Password stored in `FAMILY_PASSWORD` env var. Cookie expires in 30 days.

### API Routes (`app/api/`)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/photos` | GET, POST | Cursor-based paginated list; create photo record |
| `/api/photos/[id]` | PATCH, DELETE | Update metadata or delete photo |
| `/api/videos` | POST | Create video generation job |
| `/api/videos/[id]` | GET | Poll video job status |
| `/api/cloudinary/sign` | GET, POST | Health check; generate upload signature |
| `/api/login` | POST | Authenticate with password |
| `/api/logout` | POST | Clear auth cookie |
| `/api/health` | GET | DB connectivity check |

### Pages

- `/` — Main timeline gallery with month grouping, grid view, search, lightbox with keyboard navigation
- `/login` — Password form
- `/upload` — Currently a copy of home page (not yet implemented as upload UI)
- `/videos` — Video creator with date range selection, job polling, status display

### Key Patterns

- All pages use `"use client"` (Client Components)
- Photos use cursor-based pagination (`cursor` + `limit` query params)
- Image upload flow: client gets Cloudinary signature → uploads directly to Cloudinary → creates photo record via API
- Video jobs: create pending job → poll for status changes (pending → processing → done/failed)
- All UI text is in Hebrew; dates formatted with `he-IL` locale

### Environment Variables

See `.env.example`. When `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set, the app uses Turso; otherwise falls back to local SQLite.
