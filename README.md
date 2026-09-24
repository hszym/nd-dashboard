# ND Group — Case Dashboard

Personal tracking dashboard: one row per case (name, sector, stage, amounts,
deadline), and a 7-item document checklist per case (Case Review, 2-pager,
Executive Summary, Deck, Term Sheet, Intro Email, Follow-up Email) with a
status (Manquant / En cours / Fait) and an optional link to the file.

Stack: Next.js (App Router) + Tailwind CSS, backed by Supabase (Postgres).

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The Supabase connection is already configured in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://usbofewlmzolyzipyfxo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_TDRdpTrje3zGuvcK_X4O7w_mLmTwdCI
```

This points at the `nd-group-dashboard` Supabase project (in your personal
org). Both `cases` and `documents` tables already exist there.

## Deploying (Vercel)

1. Push this folder to a GitHub repo (or `vercel deploy` directly from here
   with the Vercel CLI: `npx vercel`).
2. In the Vercel project settings, add the same two environment variables
   shown above.
3. Deploy. No other config needed — it's a standard Next.js app.

## ⚠️ Security — read before deploying publicly

Row Level Security (RLS) is currently **disabled** on both `cases` and
`documents`. That means the publishable key embedded in this app (visible to
anyone who opens the deployed site and inspects network requests) can
currently read *and write* every row in both tables — there is no per-user
restriction.

This is fine as long as:
- the app stays private (not shared as a public link), and/or
- you're the only one with the URL.

Before this becomes the shared, colleague-facing dashboard, you'll want to
turn RLS on and add policies (e.g. "authenticated users can read, only you
can write", once there's a login). The enabling statement is:

```sql
ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;
```

Don't run this alone, though — without any policies it will lock the app
out of its own data (nobody, including the anon key, will be able to read or
write anything). It needs to be paired with at least one policy. Happy to
build that out together once we get to the shared-dashboard phase and know
the access model (e.g. Supabase Auth with your team's emails).

## Project structure

- `src/lib/supabase.ts` — Supabase client + shared TypeScript types
  (`Case`, `CaseDocument`, `DOCUMENT_TYPES`, etc.)
- `src/app/page.tsx` — cases list (stage, document progress, amount
  remaining, deadline)
- `src/app/cases/new/page.tsx` — new case form; creates the case row and
  seeds all 7 document rows as "Manquant"
- `src/app/cases/[slug]/page.tsx` — case detail: editable metadata, brand
  colors, and the document checklist (status + link per document)
