import { listPublished } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PublishedPage() {
  const rows = await listPublished();

  return (
    <div>
      <h1>Published log</h1>
      <p className="hint">{rows.length} published — every row here is one write the Publish action already makes.</p>
      <table>
        <thead>
          <tr>
            <th>Client</th>
            <th>Published</th>
            <th>By</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.client_name}</td>
              <td>{r.publishedAt ? new Date(r.publishedAt).toLocaleString() : "—"}</td>
              <td>{r.publishedBy}</td>
              <td>
                <a href={`/case-study/${r.slug}`} target="_blank" rel="noopener noreferrer">
                  View live ↗
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
