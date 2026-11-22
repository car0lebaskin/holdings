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


## Reliability upgrade staging (2026-11-22)

The `holdings-v2` draft PR contains additional features on top of the last deployed preview. GitHub Actions runs `npm run build` on this branch. The latest Vercel publish is **blocked by the daily free-plan deployment quota** (HTTP 402); do not assume branch changes are live at the preview URL.

- **Encrypted local export:** Full host-owned database tables and referenced signature/avatar images are serialized and encrypted with AES-256-GCM derived from a user passphrase using PBKDF2. Users can verify/decrypt a saved backup locally. Automated external backups and importing/restoring into Supabase are not yet implemented. Never store the passphrase alongside the file.
- **Offline pending signed records:** Rebuys and cash-outs persist to IndexedDB **before** the interface acknowledges them. They are not counted in confirmed totals until the server verifies the write. Stable operation IDs make retries idempotent. Pending entries can be retried or explicitly discarded. Offline opening of the app, offline creation/seating, and cross-device recovery of unconfirmed local entries are not supported; browser storage can still be evicted.
- **Audit:** The backend provides a reasoned correction RPC and append-only correction records; profile renames are logged. Old preview's direct void action remains temporarily permitted, with automatic "legacy correction" audit, until the new UI is deployed. Historical names remain unchanged.
- **Guest links:** Expiring/revocable per-player links return only one player's records; old full-table invites remain available. A bearer link does not prove a guest's identity.
- **Final settlement:** A high-resolution, Wise-styled PNG can be shared or downloaded after a game closes with a reconciled ledger. Existing text export is retained.

The original `main` app and Google Sheet have not been modified. This branch has no release approval; no Apple/Google store workflow is in scope.

### Release blockers

1. Vercel preview must be deployed from an independently tested commit once allowed by hosting limits.
2. Physical Android/iPhone end-to-end tests: signed forms, IndexedDB interruption and replay, backup download/decrypt, scoped guest links and native image sharing.
3. Test full recovery and periodic independent backup delivery before calling the data protection system complete.
4. Security review of the anonymous read RPC, link expiry and rate limiting; Supabase security advisors still report privileged callable functions and leaked-password protection settings.
5. Reconcile and migrate historical Google Sheets records before any production cutover.
