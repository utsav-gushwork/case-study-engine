// Storage abstraction — every route below (fetch-doc, publish, published log,
// the [slug] page) goes through this file, never touches a backend directly.
//
// ⚠ HONEST GAP, read before deploying: this ships with an in-memory store.
// It works end-to-end for local `next dev` and for exercising every route,
// but an in-memory Map does NOT survive across serverless invocations on
// Vercel — every request can hit a cold instance with an empty store. This
// tool has no way to provision a managed database on your behalf (no
// Vercel Storage API access), so the one remaining manual step is yours:
//
//   1. Vercel dashboard → this project → Storage → Browse Storage →
//      Marketplace Database Providers → Upstash (Vercel retired its own
//      native "KV" product in favor of this marketplace; Upstash is the
//      same Redis-backed tech the old Vercel KV ran on).
//   2. Connect it to this project — injects either UPSTASH_REDIS_REST_URL/
//      _TOKEN or KV_REST_API_URL/_TOKEN depending on how the integration
//      names things; the code below checks both, so either works.
//   3. Flip USE_KV below to `true` (@upstash/redis is already a dependency).
//
// Everything else — routes, parsing, generation, the publish flow — is real
// and already wired to this interface; only the backing store needs that
// one dashboard step, since this tool can't create a database for you.

import type { CaseStudyRow, PublishStatus, StoredCaseStudy } from "./schema";

const USE_KV = true; // Upstash connected 8 Sep 2026, prefix KV_REST_API

export interface PublishedEntry {
  id: string;
  client_name: string;
  client_website: string;
  publishedAt: string;
  publishedBy: string;
  slug: string;
}

interface Store {
  get(id: string): Promise<StoredCaseStudy | null>;
  set(id: string, row: StoredCaseStudy): Promise<void>;
  list(): Promise<StoredCaseStudy[]>;
  delete(id: string): Promise<void>;
}

// ---- in-memory implementation (default; see the gap notice above) ----
const memoryStore = new Map<string, StoredCaseStudy>();

const memory: Store = {
  async get(id) {
    return memoryStore.get(id) ?? null;
  },
  async set(id, row) {
    memoryStore.set(id, row);
  },
  async list() {
    return Array.from(memoryStore.values());
  },
  async delete(id) {
    memoryStore.delete(id);
  },
};

// ---- Upstash Redis implementation (ready to enable — see USE_KV above) ----
// Reads either env-var naming the Vercel↔Upstash marketplace integration
// might inject — see the gap notice above for why there are two.
function kvStore(): Store {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Redis } = require("@upstash/redis");
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "USE_KV is true but no Upstash/KV env vars were found — connect the store first (see lib/db.ts).",
    );
  }
  const redis = new Redis({ url, token });
  const KEY_PREFIX = "case_study:";
  const INDEX_KEY = "case_study_ids";
  return {
    async get(id) {
      return (await redis.get(KEY_PREFIX + id)) ?? null;
    },
    async set(id, row) {
      await redis.set(KEY_PREFIX + id, row);
      await redis.sadd(INDEX_KEY, id);
    },
    async list() {
      const ids: string[] = await redis.smembers(INDEX_KEY);
      const rows = await Promise.all(ids.map((id) => redis.get(KEY_PREFIX + id)));
      return rows.filter(Boolean) as StoredCaseStudy[];
    },
    async delete(id) {
      await redis.del(KEY_PREFIX + id);
      await redis.srem(INDEX_KEY, id);
    },
  };
}

// Lazy — constructed on first actual use, not at module load. Next.js's
// build-time "collect page data" pass imports this module before real env
// vars are necessarily in scope; an eager `kvStore()` call here broke the
// build for exactly that reason.
let _store: Store | null = null;
function getStore(): Store {
  if (!_store) _store = USE_KV ? kvStore() : memory;
  return _store;
}

// ---- public API used by routes/pages ----

export async function saveDraft(
  id: string,
  row: CaseStudyRow,
  status: PublishStatus,
  createdBy?: string,
  photo?: { url?: string; credit?: { name: string; profileUrl: string } | null; downloadLocation?: string },
): Promise<StoredCaseStudy> {
  const existing = await getStore().get(id);
  const stored: StoredCaseStudy = {
    ...row,
    id,
    status,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    createdBy: existing?.createdBy ?? createdBy,
    publishedAt: existing?.publishedAt,
    publishedBy: existing?.publishedBy,
    photoUrl: photo?.url ?? existing?.photoUrl,
    photoCredit: photo ? photo.credit : existing?.photoCredit,
    photoDownloadLocation: photo?.downloadLocation ?? existing?.photoDownloadLocation,
  };
  await getStore().set(id, stored);
  return stored;
}

export async function getCaseStudy(id: string): Promise<StoredCaseStudy | null> {
  return getStore().get(id);
}

/** Discards a draft — a master doc can hand back dozens of rows at once,
 *  and not every one is worth keeping in the review queue. Never used on a
 *  published row (the /generate screen only lists non-published rows). */
export async function discardDraft(id: string): Promise<void> {
  await getStore().delete(id);
}

export async function publish(
  id: string,
  opts: { publishedBy: string; photoUrl?: string; photoCredit?: { name: string; profileUrl: string } | null },
): Promise<StoredCaseStudy | null> {
  const row = await getStore().get(id);
  if (!row) return null;
  const updated: StoredCaseStudy = {
    ...row,
    status: "published",
    publishedAt: new Date().toISOString(),
    publishedBy: opts.publishedBy,
    photoUrl: opts.photoUrl ?? row.photoUrl,
    photoCredit: opts.photoCredit ?? row.photoCredit,
  };
  await getStore().set(id, updated);
  return updated;
}

/** Reads a published case study by its slug, for the /case-study/[slug] route. */
export async function getPublished(slug: string): Promise<StoredCaseStudy | null> {
  const all = await getStore().list();
  return all.find((r) => r.case_slug === slug && r.status === "published") ?? null;
}

/** Every row not yet published — the /generate screen's row list, newest first. */
export async function listDrafts(): Promise<StoredCaseStudy[]> {
  const all = await getStore().list();
  return all
    .filter((r) => r.status !== "published")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The published log — newest first. */
export async function listPublished(): Promise<PublishedEntry[]> {
  const all = await getStore().list();
  return all
    .filter((r) => r.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .map((r) => ({
      id: r.id,
      client_name: r.client_name,
      client_website: r.client_website,
      publishedAt: r.publishedAt ?? "",
      publishedBy: r.publishedBy ?? "",
      slug: r.case_slug,
    }));
}
