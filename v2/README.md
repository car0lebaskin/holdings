# Holdings v2 — isolated preview

A mobile-first rebuild preserving Holdings' Wise-inspired visual design. This directory is **not** the production app. Production remains the root-level `index.html` and existing Apps Script deployment.

## Configuration

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (a publishable key, never a service-role key). For local development copy `.env.example` to `.env.local`.

Run `npm install && npm run dev`. Production build: `npm run build`.

## Migration status

Supabase schema: games, persistent profiles, seats, ledger, private owner RLS, read-only invitation snapshot, avatar storage. The existing Google Sheet has **not** been modified or imported. Importing records requires mapping legacy IDs, preserving signatures and reconciling all totals before cutover.

## Permission model

Hosts authenticate with Supabase Auth. RLS enforces host ownership. The public guest RPC accepts a high-entropy invite token and returns a read-only snapshot, without signatures. Guests cannot mutate tables. The RPC is intentionally available to anonymous clients and needs abuse/rate-limit hardening before general public launch.

## Features in preview

View/create tables, create reusable player profiles, seat players, record buy-ins/cash-outs, view ledger totals, camera/gallery avatar upload, read-only share links, mobile swipe between tabs, native-style sheets and optimistic UI feedback.

## Before release

Implement reversible audit operations with safeguards, stronger database-side transaction validation, encrypted signature storage and signed access, invite rate limiting/revocation, offline operation replay, realtime subscriptions, automated tests, auth email redirect configuration, and end-to-end regression validation against exported Google Sheet data. No store submission has been started.
