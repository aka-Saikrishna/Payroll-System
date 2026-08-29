# Deploying VEEKAY Payroll System

Recommended free stack: **Vercel** (app) + **Neon** (PostgreSQL).

---

## Why this stack

The app needs the **Node.js runtime** — 9 API routes declare `export const runtime = "nodejs"`
because they use `exceljs` (Excel import/export/register) and Prisma. It also hashes
passwords with bcrypt on login.

**Cloudflare Workers/Pages is not a good fit here:**

| Blocker | Detail |
| --- | --- |
| CPU limit | Workers free tier allows ~10 ms CPU/request. bcrypt at cost factor 10 uses 50–100 ms. Login would fail. |
| Bundle size | Workers cap at 3 MB compressed. `exceljs` alone exceeds this. |
| Prisma | Doesn't run on Workers natively — needs Prisma Accelerate or driver adapters + Hyperdrive (extra cost/rework). |

Cloudflare is excellent for static sites and edge APIs; this app is neither.

---

## ⚠️ Read before deploying commercially

1. **Vercel's Hobby (free) plan is for non-commercial use only.** This is a real payroll
   system processing a real company's salary data, which falls outside those terms. For
   production business use you need **Vercel Pro (~$20/month)**, or self-host (see
   alternatives below). The free tier is fine for evaluation/demo.

2. **This app stores personal data** — employee names, salaries, advances. On any hosting:
   - Set a strong `JWT_SECRET` (never the dev default).
   - Ensure the database enforces SSL (`sslmode=require`).
   - Change the seeded `admin@veekay.com / Admin@123` password immediately.

---

## Step 1 — Create the database (Neon)

1. Sign up at <https://neon.tech> → create a project (region closest to your users).
2. From the dashboard, copy **two** connection strings:
   - **Pooled** — host contains `-pooler`. This is `DATABASE_URL`.
   - **Direct** — no `-pooler`. This is `DIRECT_URL`.
3. Append pooling flags to the pooled one:

```
?sslmode=require&pgbouncer=true&connection_limit=1
```

Pooling is **required**: each serverless invocation opens its own connection, and
without pgBouncer you will exhaust Postgres connections quickly.

**Free tier:** 0.5 GB storage; compute auto-suspends after ~5 min idle, so the first
request after a quiet period takes ~1 s to wake. Fine for monthly payroll.

---

## Step 2 — Deploy to Vercel

1. Push this repo to GitHub.
2. <https://vercel.com> → **New Project** → import the repo. Framework auto-detects as Next.js.
3. Add environment variables (Settings → Environment Variables):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** URL + pgbouncer flags |
| `DIRECT_URL` | Neon **direct** URL |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | `8h` |

`NODE_ENV` is set automatically — don't add it.

4. Deploy. The build script already runs `prisma generate && next build`, and
   `postinstall` regenerates the client so Vercel's dependency cache can't serve a
   stale Prisma client.

---

## Step 3 — Run migrations

Migrations are **not** run automatically. From your machine, pointed at production:

```bash
DATABASE_URL="<neon-pooled-url>" DIRECT_URL="<neon-direct-url>" npx prisma migrate deploy
```

To create the first admin user, either run the seed (⚠️ **`prisma/seed.ts` deletes all
employees** — only safe on an empty database):

```bash
DATABASE_URL="<neon-pooled-url>" DIRECT_URL="<neon-direct-url>" npx prisma db seed
```

…or insert one admin manually and add employees through the UI / Excel import.

**Change the admin password immediately after seeding.**

---

## Free alternatives

| Option | Notes |
| --- | --- |
| **Neon** | Recommended. Real pooling, doesn't sleep permanently. |
| **Supabase** | 500 MB free, but **pauses the project after 7 days of inactivity** and needs manual restore — risky for payroll you only touch monthly. |
| **Vercel Postgres** | Neon under the hood; simpler setup, counts against Vercel limits. |
| ~~Render free Postgres~~ | Database is **deleted after 90 days**. Do not use. |
| ~~Railway~~ | No meaningful free tier anymore. |

**Fully self-hosted (avoids the commercial-use issue):** any ~$5/month VPS
(Hetzner, DigitalOcean) running `docker compose` with the app + Postgres. More setup,
full control, no plan restrictions, and your salary data stays on infrastructure you own.

---

## Post-deploy checklist

- [ ] `JWT_SECRET` is a fresh random value, not the dev default
- [ ] Seeded admin password changed
- [ ] `prisma migrate deploy` has run
- [ ] Login works; Salary Sheet generates
- [ ] Excel export downloads (verifies the Node runtime routes work)
- [ ] Print preview renders and prints A4 landscape
- [ ] Database backups configured (Neon: Settings → Backups)
