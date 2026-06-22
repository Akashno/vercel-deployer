# SaaS Plan — Vercel Deployment Viewer

## The Problem
Vercel requires a paid seat for every team member who needs to see deployment logs. PMs, designers, clients, and QA don't need full Vercel access — they just need visibility.

## The Product
A self-hosted SaaS where an owner connects their Vercel account via API key, then invites anyone to view deployments for specific projects — no Vercel account required for invitees.

---

## Data Model (Supabase Postgres)

```
users                     (Supabase Auth built-in)
  └── id, email

accounts
  └── user_id (owner)
  └── vercel_api_key      (encrypted — Supabase Vault or AES at app layer)
  └── vercel_team_id

projects
  └── id
  └── owner_id
  └── vercel_project_id
  └── name
  └── slug

project_members
  └── project_id
  └── user_id
  └── role                (owner | viewer)
  └── invite_token
  └── invite_email
  └── accepted_at
```

---

## User Flows

### Onboarding (owner)
1. Signs up via Supabase Auth
2. Enters Vercel API key on onboarding screen
3. Key stored encrypted in `accounts` table
4. Server calls Vercel API → lists their projects → populates `projects` table

### Inviting users
1. Owner invites an email to a specific project
2. Creates a `project_members` row with a pending invite token
3. Invited user receives email (via Resend / Sendgrid / Supabase email triggers)
4. They click the link → sign up → invite accepted → `accepted_at` set

### Invited user viewing deployments
1. Logs in via Supabase Auth
2. Server checks `project_members` → returns only their accessible projects
3. When fetching deployments, server looks up the **owner's** Vercel API key for that project
4. Vercel API call happens server-side — invited user never touches the API key

---

## Row Level Security (RLS)

```sql
-- Users can only see projects they are a member of
CREATE POLICY "project_members_own" ON project_members
  FOR SELECT USING (user_id = auth.uid());

-- API keys are only readable server-side via service role key
-- No SELECT policy on accounts for anon/authenticated roles
```

---

## What Changes from Current Codebase

| Current | New |
|---|---|
| `.env` username/password auth | Supabase Auth (email/password or OAuth) |
| `.env` `PROJECT_TOKEN` hardcoded | Fetched from DB per request based on logged-in user's project |
| Single project | Multi-project pulled from DB |
| No user management | `project_members` table + invite flow |

## Stack
- **Auth**: `@nuxtjs/supabase` (Supabase Auth)
- **DB**: Supabase Postgres + RLS
- **Secret storage**: App-layer AES-256-GCM encryption (see below)
- **Email**: Resend or Sendgrid for invite emails
- **Vercel API calls**: Stay server-side in Nitro (no change to proxy pattern)

---

## API Key Encryption

### The risk without encryption
The Vercel API key sits in Supabase. A misconfigured RLS policy, a DB breach, or a Supabase-side compromise would expose keys that have broad permissions on the owner's Vercel account (not just read — they can deploy and delete too).

### Chosen approach: App-layer AES-256-GCM

Encrypt the API key in the Nitro server **before** writing to Supabase. Decrypt on read. The encryption key lives only in your environment variables — Supabase stores ciphertext only.

```ts
// encrypt before storing in DB
const encrypted = await encryptApiKey(vercelApiKey, process.env.ENCRYPTION_KEY)
// store `encrypted` in accounts.vercel_api_key

// decrypt before making Vercel API call
const vercelApiKey = await decryptApiKey(encrypted, process.env.ENCRYPTION_KEY)
```

Uses `crypto.subtle` (Web Crypto API) — already used in this codebase for HMAC auth (`server/utils/auth.ts`).

### Why not Supabase Vault?
Supabase Vault encrypts at rest via `pgsodium` but Supabase manages the encryption key too. A full Supabase breach still exposes keys. App-layer encryption means only your server (via `ENCRYPTION_KEY` env var) can decrypt.

### Encryption option comparison

| Option | Supabase sees plaintext? | Complexity |
|---|---|---|
| No encryption | Yes | None |
| Supabase Vault | No (but they hold the key) | Low |
| App-layer AES-256-GCM | No | Low |
| Envelope encryption (per-user keys) | No | High |

**App-layer AES-256-GCM is the right call for this stage.**

### What encryption does NOT solve
- A bug in your server code that logs or returns the decrypted key
- Your `ENCRYPTION_KEY` env var being stolen from your hosting provider
- Vercel API rate limits (all users share the owner's key quota)

---

## Known Risks & Limitations

### Security
- Vercel API keys have broad permissions (deploy, delete, read) — not scoped to read-only. If a key leaks despite encryption, the blast radius is the owner's full Vercel account.
- RLS is powerful but easy to misconfigure silently — a wrong policy shows no error, just leaks data. Needs careful testing.
- Must use Supabase **service role key** server-side only for reading encrypted API keys. Never expose it to the client.

### Vercel API
- **Rate limits**: All invited users share the owner's single API key quota. High concurrent usage can get throttled with no easy workaround.
- **No real-time log streaming**: Vercel streams build logs live. This app fetches them as a snapshot. True live logs would require SSE or WebSockets — more complex to build.
- **Vercel ToS**: Using the Vercel API to proxy data in a commercial product is a grey area worth reviewing before investing heavily.

### Product / UX
- If the owner deletes their account or rotates their Vercel API key, all invited users immediately lose access — no graceful degradation.
- The invite flow has edge cases: token expiry, re-invite, user already has an account vs. doesn't, email delivery failures.
- Single owner per account — no transferring project ownership.
