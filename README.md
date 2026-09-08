# Case Study Engine

Bulk case-study generator, primarily for AEs: turn a CSV row (or a labelled doc) into a full,
on-brand case-study page — one or a hundred at a time — preview it, then publish live with one
click. No Anthropic API in the core pipeline; content arrives fully written, the app only
parses and places it.

- **Product requirements:** https://claude.ai/code/artifact/f212ea71-6a10-42af-b5e9-b817cf06c525
- **Wireframe:** https://claude.ai/code/artifact/a31d294a-e3b3-4bb0-9745-aa0cecb21293
- **Live:** https://case-study-engine-gw-design.vercel.app
- **Underlying page template:** `skills/gushwork-web/templates/case-study/` in
  [gushwork-design/gushwork-design](https://github.com/gushwork-design/gushwork-design)

## Status

All the functionality is real and wired up — CSV parsing, doc fetching, generation, the
`/case-study/[slug]` and `/preview/[id]` renderers, Google sign-in, publish, the published log.
The tool's own UI (upload/review screens) is deliberately unstyled — a Figma hifi pass is
coming, no point designing it twice. The generated case-study pages themselves use the real
design tokens already established in the gushwork-web template — that output is the actual
deliverable, so it isn't part of the "low-fi for now" call.

**Four manual steps this app can't do for itself** (no API access to provision or connect any
of these):

1. **Connect this repo to the Vercel project.** The project already existed (a placeholder
   deployed manually, before this code existed) by the time this repo was ready, and Vercel
   won't auto-reconnect an existing unlinked project to a repo of the same name — it has to be
   done once from the dashboard: this project → Settings → Git → Connect Repository →
   `utsav-gushwork/case-study-engine`. Every push auto-deploys after that.

2. **A Google OAuth client**, for the sign-in gate that also makes attribution possible (who
   created/published each case study). console.cloud.google.com → APIs & Services →
   Credentials → Create OAuth client ID (Web application) → redirect URI
   `https://<domain>/api/auth/callback/google`. Sign-in is restricted to `@gushwork.ai` accounts
   by default (`lib/auth.ts`'s `ALLOWED_DOMAIN`) — change it if that's not the right gate.
3. **A real database.** Ships with an in-memory store (`lib/db.ts`) that works for local `next
   dev` but does not survive across Vercel's serverless invocations. Connect a store —
   dashboard → this project → Storage → Create Database → KV — then flip `USE_KV` to `true` in
   `lib/db.ts` (`@vercel/kv` is already a dependency). Every route already goes through that
   file's interface; only the backing store needs this step.
4. **An Unsplash access key** (unsplash.com/developers, free, 50 req/hour) for the hero-photo
   search. Optional — generation falls back to the icon treatment with no key set.

See `.env.example` for the full list of environment variables.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in what you have; Google + KV can wait, Unsplash is optional
npm run dev
```

## Why a separate repo and Vercel project

Kept fully isolated from every other Gushwork project on purpose: its own repo, its own Vercel
project (team `gw-design`), and its own database once connected. A change here can never break
the design-system plugin or the main site, and a bug in either of those can never take this
down. See the PRD's "Production build" section for the full reasoning.
