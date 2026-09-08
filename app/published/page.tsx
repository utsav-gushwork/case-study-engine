import { listPublished } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PublishedPage() {
  const rows = await listPublished();

  return (
    <div>
      <h1 style={{ fontSize: 30 }}>Published case studies</h1>
      <p className="hint" style={{ marginTop: 8, marginBottom: 24 }}>
        {rows.length} published — every row here is one write the Publish action already makes.
      </p>

      <div className="gw-card published-page-list" style={{ padding: 8 }}>
        {rows.length === 0 && (
          <p className="hint" style={{ padding: 20 }}>
            Nothing published yet.
          </p>
        )}
        {rows.map((r) => {
          const domain = r.client_website ? r.client_website.replace(/^https?:\/\//, "").replace(/\/$/, "") : r.slug;
          return (
            <div key={r.id} className="published-page-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <b style={{ fontSize: 15 }}>{r.client_name}</b>
                  <span className="gw-chip gw-chip-live">Live</span>
                </div>
                <div className="published-row-domain">{domain}</div>
                <div className="published-row-meta">
                  Published on {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  {r.publishedAt && `, ${new Date(r.publishedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`} by {r.publishedBy || "—"}
                </div>
              </div>
              <a href={`/case-study/${r.slug}`} target="_blank" rel="noopener noreferrer">
                View live ↗
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
