# DebtTrack

Track money you lend and owe — with interest, due dates, and email reminders.

**Stack:** Next.js 15 · PostgreSQL (Neon) · Prisma · NextAuth v5 · Tailwind · Recharts · Nodemailer

---

## Quick Start (Local)

### 1. Clone & install

```bash
git clone https://github.com/yourname/debttrack.git
cd debttrack
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` — see each section below for how to get each value.

### 3. Set up the database

```bash
npm run db:push
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables Guide

### `DATABASE_URL` — Neon PostgreSQL (free)

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project → DebtTrack
3. Copy the **Connection string** (starts with `postgresql://`)
4. Paste as `DATABASE_URL`

### `NEXTAUTH_SECRET`

Generate a secure random secret:

```bash
openssl rand -base64 32
```

### `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable **Google+ API** (or People API)
4. Go to **APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (local)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
7. Copy Client ID and Client Secret

### `GMAIL_USER` + `GMAIL_APP_PASSWORD` — Gmail SMTP

> **Important:** You need a Gmail account with 2-Step Verification enabled.

1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already
3. Go to **App passwords** (search for it in the Google Account search bar)
4. Select app: **Mail** → Select device: **Other** → name it "DebtTrack"
5. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)
6. Set `GMAIL_USER` = your Gmail address
7. Set `GMAIL_APP_PASSWORD` = the 16-char app password

### `CRON_SECRET`

Any random string — used to secure the cron endpoint:

```bash
openssl rand -base64 24
```

---

## Deploy to Vercel (Free)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourname/debttrack.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework: **Next.js** (auto-detected)

### Step 3: Add environment variables

In Vercel dashboard → **Settings → Environment Variables**, add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `NEXTAUTH_URL` | `https://your-project.vercel.app` |
| `NEXTAUTH_SECRET` | Your generated secret |
| `GOOGLE_CLIENT_ID` | From Google Console |
| `GOOGLE_CLIENT_SECRET` | From Google Console |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Your Gmail App Password |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` |
| `CRON_SECRET` | Your random secret |

### Step 4: Deploy

Click **Deploy**. Vercel will run `prisma generate && next build` automatically.

### Step 5: Update Google OAuth redirect URI

Go back to Google Console → Credentials → your OAuth app → add:

```
https://your-project.vercel.app/api/auth/callback/google
```

### Step 6: Verify cron job

Vercel dashboard → **Settings → Cron Jobs** — you should see `/api/cron/overdue` scheduled daily at 8am UTC.

---

## Project Structure

```
debttrack/
├── prisma/schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/               # Login, register pages
│   │   ├── (dashboard)/          # All protected pages
│   │   │   ├── page.tsx          # Dashboard overview
│   │   │   ├── transactions/     # List + detail pages
│   │   │   └── notifications/    # Notification center
│   │   └── api/                  # All API routes
│   │       ├── auth/             # NextAuth handlers
│   │       ├── register/         # User registration
│   │       ├── transactions/     # CRUD + filters
│   │       ├── notifications/    # In-app notifications
│   │       ├── dashboard/        # Stats + chart data
│   │       └── cron/overdue/     # Scheduled job
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   └── TransactionForm.tsx   # Add/edit modal
│   ├── lib/
│   │   ├── prisma.ts             # DB client singleton
│   │   ├── auth.ts               # NextAuth config
│   │   ├── utils.ts              # Helpers
│   │   └── mailer.ts             # Email templates
│   └── types/                    # TypeScript types
├── vercel.json                   # Cron schedule
└── .env.example                  # Environment template
```

---

## Features

- **Auth:** Email/password registration + Google OAuth
- **Dashboard:** Stats cards, activity chart, recent transactions
- **Transactions:** Full CRUD, filters (type/status/date/search), sorting, pagination
- **Interest:** Percent or flat fee, auto-computed total
- **Status tracking:** UNPAID → OVERDUE (auto) → PAID
- **Notifications:** In-app panel + email reminders via Gmail
- **Cron:** Daily check marks overdue, sends email alerts for payments due within 3 days
- **CSV export:** Download all filtered transactions
- **Free tier:** Neon (0.5GB) + Vercel (hobby) + Gmail SMTP (500/day)

---

## Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:push      # Apply schema to database
npm run db:studio    # Open Prisma Studio (DB GUI)
```

---

## Free Tier Limits

| Service | Free Limit | DebtTrack Usage |
|---------|-----------|----------------|
| Neon DB | 0.5 GB storage | ~500k transactions |
| Vercel | 100 GB bandwidth | Very comfortable |
| Gmail SMTP | 500 emails/day | More than enough |
| Vercel Cron | 2 cron jobs | Using 1 |