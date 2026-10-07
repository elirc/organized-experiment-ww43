This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## About this repository

This is "Collab Notes" (`src/app/layout.tsx:20`): a collaborative notes app with cookie-backed sessions, per-note sharing (`OWNER` / `EDITOR` / `VIEWER`), version history with optimistic concurrency, archive/restore, and an admin-only audit log. The stack is Next.js 16.2.4 App Router, React 19, React Query, Prisma 6 on PostgreSQL, Zod 4, and Vitest (`package.json:15-41`).

Project documentation lives in `docs/`:

- [docs/architecture/README.md](docs/architecture/README.md) is the overview: folders, layers, the full route inventory, runtime configuration.
- [docs/architecture/auth-and-permissions.md](docs/architecture/auth-and-permissions.md) has the route gate table, the session lifecycle, the capability matrix, and the numbered findings.
- [docs/architecture/domain-model.md](docs/architecture/domain-model.md) and [docs/architecture/request-lifecycle.md](docs/architecture/request-lifecycle.md) cover the schema and every request path.
- [docs/learning/](docs/learning/) holds the guided reading path, flow traces, testing rationale, and exercises.

### Local setup (what the code actually needs)

1. A PostgreSQL database and a `DATABASE_URL` environment variable. Prisma reads it directly in `prisma/schema.prisma:17`. The default URL in `src/lib/env.ts:14` is **not** passed to `PrismaClient` (`src/lib/db/prisma.ts:18-20`), so it does not help Prisma find a database.
2. `npm install`, then `npm run prisma:generate` (`package.json:12`).
3. Create the tables. There is no `prisma/migrations/` folder in this repo, so `prisma migrate deploy` has nothing to apply. Use `npx prisma db push` (or create a first migration with `npx prisma migrate dev`).
4. `npm run prisma:seed` (`package.json:13`) runs `prisma/seed.ts` with `tsx`. There is no `prisma.seed` key in `package.json`, so `npx prisma db seed` will not find the seed script.
5. Set `SESSION_SECRET` (16+ characters) for anything beyond local use. Otherwise the default `dev-session-secret-change-me` is used (`src/lib/env.ts:15-18`).
6. `npm run dev`, then sign in with a seeded account. The login form lists them (`src/features/auth/components/login-form.tsx:17-21`): `admin@notes.local / AdminPass123!`, `owner@notes.local / OwnerPass123!`, `editor@notes.local / EditorPass123!`.

There is no sign-up route. Users exist only if the seed (or a manual insert) creates them.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

**Correction:** the home page is `src/app/page.tsx` (this project uses a `src/` directory). It redirects signed-in users to `/notes` (`src/app/page.tsx:9-13`).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

**Correction:** this project loads Manrope and IBM Plex Mono through `next/font/google`, not Geist (`src/app/layout.tsx:2`, `src/app/layout.tsx:8-17`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
