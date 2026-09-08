# Case Study Gen Studio

Bulk case-study generator, primarily for AEs: turn a CSV row (or a labelled doc) into a full,
on-brand case-study page — one or a hundred at a time — preview it, then publish live with one
click. No Anthropic API in the core pipeline; content arrives fully written, the app only
parses and places it.

(Named "Case Study Engine" in earlier commits — renamed to match Utsav's Figma hifi design.)

- **Product requirements:** https://claude.ai/code/artifact/f212ea71-6a10-42af-b5e9-b817cf06c525
- **Wireframe:** https://claude.ai/code/artifact/a31d294a-e3b3-4bb0-9745-aa0cecb21293
- **Live:** https://case-study-engine-gw-design.vercel.app
- **Underlying page template:** `skills/gushwork-web/templates/case-study/` in
  [gushwork-design/gushwork-design](https://github.com/gushwork-design/gushwork-design)

## Status

All the functionality is real and wired up — CSV parsing, doc fetching, generation, the
`/case-study/[slug]` and `/preview/[id]` renderers, publish, the published log. The tool's own
UI now follows Utsav's Figma hifi design (`GW-Case-Studies`, node `1706:15889`): a Home screen
(upload + recent published), a `/generate` review screen (row list with regenerate/approve, a
live preview pane with a Prev/Next pager and a mobile/desktop viewport toggle, and a fixed
"Download HTML or Publish live" bar), a restyled `/published` log, and a restyled `/sign-in`.
Built against the Gushwork design system tokens (`colors_and_type.css`) and the
`sales-dashboard` skill template's card/chip/topbar patterns — plain CSS classes in
`app/globals.css`, not the skill's own React/`.dc.html` components, since this is a real Next.js
app. The generated case-study pages themselves use the same real design tokens already
established in the gushwork-web template — that output is the actual deliverable.

"Approve" (per row) is local staging only, no server call — the fixed bottom bar is what
actually downloads or publishes, once at least one row is approved.

**The tool is fully usable right now, no manual steps left.** Every route works unauthenticated:

- ~~Connect this repo to the Vercel project~~ — done.
- ~~Connect an Upstash store, flip `USE_KV`~~ — done; `lib/db.ts` reads/writes real data.
- ~~An Unsplash access key~~ — done; hero photos are live, with the required attribution credit.
- **The Google sign-in gate is phase 2, on purpose** — Utsav's call: ship the tool first, add
  login later. `lib/auth.ts`'s `AUTH_ENABLED` flag is `false`; `middleware.ts` waves every route
  through, and published rows are attributed as `"unattributed"` instead of a signed-in email.
  All the OAuth code is already built and wired (Google provider, `@gushwork.ai`-only domain
  check, `/sign-in` page) — starting phase 2 is one flag flip plus the steps below, not a rebuild:
  console.cloud.google.com → APIs & Services → Credentials → Create OAuth client ID (Web
  application) → redirect URI `https://<domain>/api/auth/callback/google` → set
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in Vercel → flip `AUTH_ENABLED` to `true`.

See `.env.example` for the full list of environment variables.

## Local development

```bash
npm install
cp .env.example .env.local   # Google/NextAuth vars can wait for phase 2
npm run dev
```

## Why a separate repo and Vercel project

Kept fully isolated from every other Gushwork project on purpose: its own repo, its own Vercel
project (team `gw-design`), and its own database once connected. A change here can never break
the design-system plugin or the main site, and a bug in either of those can never take this
down. See the PRD's "Production build" section for the full reasoning.
