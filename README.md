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

**One manual step left** (three more this app couldn't do for itself are already done):

- ~~Connect this repo to the Vercel project~~ — done.
- ~~Connect an Upstash store, flip `USE_KV`~~ — done; `lib/db.ts` now reads/writes real data.
- ~~An Unsplash access key~~ — done; hero photos are live, with the required attribution credit.
- **A Google OAuth client** is what's left — for the sign-in gate that also makes attribution
  possible (who created/published each case study). console.cloud.google.com → APIs & Services
  → Credentials → Create OAuth client ID (Web application) → redirect URI
  `https://<domain>/api/auth/callback/google`. Sign-in is restricted to `@gushwork.ai` accounts
  by default (`lib/auth.ts`'s `ALLOWED_DOMAIN`) — change it if that's not the right gate.

See `.env.example` for the full list of environment variables.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in what you have; Google can wait
npm run dev
```

## Why a separate repo and Vercel project

Kept fully isolated from every other Gushwork project on purpose: its own repo, its own Vercel
project (team `gw-design`), and its own database once connected. A change here can never break
the design-system plugin or the main site, and a bug in either of those can never take this
down. See the PRD's "Production build" section for the full reasoning.
