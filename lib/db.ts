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
//   1. Vercel dashboard → this project → Storage → Create Database → KV.
//   2. Connect it to this project (injects KV_REST_API_URL / _TOKEN).
//   3. `npm i @vercel/kv`, then flip USE_KV below to `true`.
//
// Everything else — routes, parsing, generation, the publish flow — is real
// and already wired to this interface; only the backing store needs that
// one dashboard step, since this tool can't create a KV/Postgres store for you.

import type { CaseStudyRow, PublishStatus, StoredCaseStudy } from "./schema";

const USE_KV = false; // flip once a KV store is connected (see above)

export interface PublishedEntry {
  id: string;
  client_name: string;
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

// ---- @vercel/kv implementation (ready to enable — see USE_KV above) ----
function kvStore(): Store {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { kv } = require("@vercel/kv");
  const KEY_PREFIX = "case_study:";
  const INDEX_KEY = "case_study_ids";
  return {
    async get(id) {
      return (await kv.get(KEY_PREFIX + id)) ?? null;
    },
    async set(id, row) {
      await kv.set(KEY_PREFIX + id, row);
      await kv.sadd(INDEX_KEY, id);
    },
    async list() {
      const ids: string[] = await kv.smembers(INDEX_KEY);
      const rows = await Promise.all(ids.map((id) => kv.get(KEY_PREFIX + id)));
      return rows.filter(Boolean) as StoredCaseStudy[];
    },
    async delete(id) {
      await kv.del(KEY_PREFIX + id);
      await kv.srem(INDEX_KEY, id);
    },
  };
}

const store: Store = USE_KV ? kvStore() : memory;

// ---- public API used by routes/pages ----

export async function saveDraft(
  id: string,
  row: CaseStudyRow,
  status: PublishStatus,
  createdBy?: string,
): Promise<StoredCaseStudy> {
  const existing = await store.get(id);
  const stored: StoredCaseStudy = {
    ...row,
    id,
    status,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    createdBy: existing?.createdBy ?? createdBy,
    publishedAt: existing?.publishedAt,
    publishedBy: existing?.publishedBy,
    photoUrl: existing?.photoUrl,
    photoCredit: existing?.photoCredit,
  };
  await store.set(id, stored);
  return stored;
}

export async function getCaseStudy(id: string): Promise<StoredCaseStudy | null> {
  return store.get(id);
}

export async function publish(
  id: string,
  opts: { publishedBy: string; photoUrl?: string; photoCredit?: { name: string; profileUrl: string } | null },
): Promise<StoredCaseStudy | null> {
  const row = await store.get(id);
  if (!row) return null;
  const updated: StoredCaseStudy = {
    ...row,
    status: "published",
    publishedAt: new Date().toISOString(),
    publishedBy: opts.publishedBy,
    photoUrl: opts.photoUrl ?? row.photoUrl,
    photoCredit: opts.photoCredit ?? row.photoCredit,
  };
  await store.set(id, updated);
  return updated;
}

/** Reads a published case study by its slug, for the /case-study/[slug] route. */
export async function getPublished(slug: string): Promise<StoredCaseStudy | null> {
  const all = await store.list();
  return all.find((r) => r.case_slug === slug && r.status === "published") ?? null;
}

/** The published log — newest first. */
export async function listPublished(): Promise<PublishedEntry[]> {
  const all = await store.list();
  return all
    .filter((r) => r.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .map((r) => ({
      id: r.id,
      client_name: r.client_name,
      publishedAt: r.publishedAt ?? "",
      publishedBy: r.publishedBy ?? "",
      slug: r.case_slug,
    }));
}
