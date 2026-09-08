# Case Study Engine

Bulk case-study generator, primarily for AEs: turn a CSV row (or a labelled doc) into a full,
on-brand case-study page — one or a hundred at a time — preview it, then publish live with one
click. No Anthropic API in the core pipeline; content arrives fully written, the app only
parses and places it. Full detail in the docs below.

**Status:** repo and Vercel project reserved. No application code yet — this is the separate,
dedicated home for it, deliberately apart from the `gushwork-design` plugin repo (which owns
the underlying page *template* this app fills in, not the app itself).

- **Product requirements:** https://claude.ai/code/artifact/f212ea71-6a10-42af-b5e9-b817cf06c525
- **Wireframe (structure, no visual design yet):** https://claude.ai/code/artifact/a31d294a-e3b3-4bb0-9745-aa0cecb21293
- **Live placeholder:** https://case-study-engine-gw-design.vercel.app
- **Underlying page template:** `skills/gushwork-web/templates/case-study/` in
  [gushwork-design/gushwork-design](https://github.com/gushwork-design/gushwork-design)

## Why a separate repo and Vercel project

Kept fully isolated from every other Gushwork project on purpose: its own repo, its own Vercel
project (team `gw-design`), and — once built — its own database. A change here can never break
the design-system plugin or the main site, and a bug in either of those can never take this
down. See the PRD's "Production build" section for the full reasoning.
