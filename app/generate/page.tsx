"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredCaseStudy } from "@/lib/schema";

function domainOf(row: Pick<StoredCaseStudy, "client_website">): string {
  if (!row.client_website) return "";
  return row.client_website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function statusChip(row: StoredCaseStudy, processing: boolean, approved: boolean) {
  if (approved) return <span className="gw-chip gw-chip-approved">Approved</span>;
  if (processing) return <span className="gw-chip gw-chip-processing">Processing</span>;
  if (row.status === "needs_review") return <span className="gw-chip gw-chip-review">Needs review</span>;
  return <span className="gw-chip gw-chip-ready">Ready</span>;
}

export default function GeneratePage() {
  const [rows, setRows] = useState<StoredCaseStudy[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [busyBar, setBusyBar] = useState<"download" | "publish" | null>(null);
  const [frameVersion, setFrameVersion] = useState(0);
  const photoPage = useRef<Map<string, number>>(new Map());

  const fetchPhoto = useCallback(async (row: StoredCaseStudy) => {
    setProcessingIds((prev) => new Set(prev).add(row.id));
    try {
      const page = photoPage.current.get(row.id) ?? 1;
      const res = await fetch("/api/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: row.industry, page }),
      });
      const data = await res.json();
      const photo = data?.photo;
      await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          row,
          action: "draft",
          photo: photo
            ? { url: photo.url, credit: photo.credit, downloadLocation: photo.downloadLocation }
            : undefined,
        }),
      });
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, photoUrl: photo?.url ?? r.photoUrl, photoCredit: photo?.credit ?? r.photoCredit } : r)),
      );
      setFrameVersion((v) => v + 1);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    fetch("/api/rows")
      .then((r) => r.json())
      .then((d) => {
        const loadedRows: StoredCaseStudy[] = d.rows ?? [];
        setRows(loadedRows);
        setActiveId((cur) => cur ?? loadedRows[0]?.id ?? null);
        setLoaded(true);
        for (const row of loadedRows) {
          if (!row.photoUrl) fetchPhoto(row);
        }
      });
    // Runs once on mount — fetchPhoto is stable (no external deps) so this
    // intentionally doesn't re-run per row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = useCallback(
    (row: StoredCaseStudy) => {
      const next = (photoPage.current.get(row.id) ?? 1) + 1;
      photoPage.current.set(row.id, next > 10 ? 1 : next);
      fetchPhoto(row);
    },
    [fetchPhoto],
  );

  const toggleApprove = useCallback((id: string) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const activeIndex = rows.findIndex((r) => r.id === activeId);
  const active = rows[activeIndex];

  const goTo = useCallback(
    (delta: number) => {
      if (activeIndex < 0) return;
      const next = rows[activeIndex + delta];
      if (next) setActiveId(next.id);
    },
    [activeIndex, rows],
  );

  const downloadHTML = useCallback(async () => {
    setBusyBar("download");
    try {
      const ids = Array.from(approvedIds);
      for (let i = 0; i < ids.length; i++) {
        const row = rows.find((r) => r.id === ids[i]);
        if (!row) continue;
        const res = await fetch(`/preview/${row.id}`);
        const html = await res.text();
        const blob = new Blob([html], { type: "text/html" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${row.case_slug || row.id}.html`;
        a.click();
        if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setBusyBar(null);
    }
  }, [approvedIds, rows]);

  const publishApproved = useCallback(async () => {
    setBusyBar("publish");
    try {
      for (const id of Array.from(approvedIds)) {
        const row = rows.find((r) => r.id === id);
        if (!row) continue;
        await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, row, action: "publish" }),
        });
      }
      const remaining = rows.filter((r) => !approvedIds.has(r.id));
      setRows(remaining);
      setApprovedIds(new Set());
      setActiveId((cur) => (remaining.some((r) => r.id === cur) ? cur : remaining[0]?.id ?? null));
    } finally {
      setBusyBar(null);
    }
  }, [approvedIds, rows]);

  if (loaded && rows.length === 0) {
    return (
      <div>
        <h1 style={{ fontSize: 26 }}>Nothing to review</h1>
        <p className="hint" style={{ marginTop: 8 }}>
          Upload a CSV or Google Doc from the home screen to generate case studies.
        </p>
        <a href="/" className="gw-btn gw-btn-black" style={{ textDecoration: "none", marginTop: 20 }}>
          ← Back to Home
        </a>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: approvedIds.size > 0 ? 70 : 0 }}>
      <div className="generate-layout">
        <div>
          <p className="rows-head">{rows.length} rows</p>
          <div className="row-list">
            {rows.map((row, i) => {
              const processing = processingIds.has(row.id);
              const approved = approvedIds.has(row.id);
              const canApprove = row.status === "ready" && !processing;
              return (
                <div
                  key={row.id}
                  className={`row-card${row.id === activeId ? " is-active" : ""}`}
                  onClick={() => setActiveId(row.id)}
                >
                  <div className="row-card-top">
                    <b>{row.client_name || "Untitled"}</b>
                    <span className="row-card-index">{i + 1}/{rows.length}</span>
                  </div>
                  <div className="row-card-domain">{domainOf(row)}</div>
                  <div className="row-card-actions" onClick={(e) => e.stopPropagation()}>
                    {statusChip(row, processing, approved)}
                    <button
                      className="gw-icon-btn"
                      aria-label="Regenerate hero photo"
                      disabled={processing}
                      onClick={() => regenerate(row)}
                    >
                      <i className="ph ph-arrows-clockwise" />
                    </button>
                    <button
                      className="gw-btn gw-btn-sm gw-btn-black"
                      disabled={!canApprove && !approved}
                      onClick={() => toggleApprove(row.id)}
                    >
                      {approved ? "Unapprove" : "Approve"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="gw-card preview-pane">
          <div className="preview-toolbar">
            <span className="preview-toolbar-label">
              Preview <b>{active?.client_name || "—"}</b>
            </span>
            <div className="pager">
              <button onClick={() => goTo(-1)} disabled={activeIndex <= 0}>
                <i className="ph ph-arrow-left" /> Previous
              </button>
              <span className="pager-count">
                {rows.length ? activeIndex + 1 : 0}/{rows.length}
              </span>
              <button onClick={() => goTo(1)} disabled={activeIndex < 0 || activeIndex >= rows.length - 1}>
                Next <i className="ph ph-arrow-right" />
              </button>
            </div>
            <div className="viewport-toggle">
              <button
                className={`gw-icon-btn${viewport === "mobile" ? " is-active" : ""}`}
                aria-label="Preview mobile width"
                onClick={() => setViewport("mobile")}
              >
                <i className="ph ph-device-mobile" />
              </button>
              <button
                className={`gw-icon-btn${viewport === "desktop" ? " is-active" : ""}`}
                aria-label="Preview desktop width"
                onClick={() => setViewport("desktop")}
              >
                <i className="ph ph-desktop" />
              </button>
            </div>
          </div>
          <div className={`preview-frame-wrap${viewport === "mobile" ? " is-mobile" : ""}`}>
            {active ? (
              <iframe key={`${active.id}-${frameVersion}`} src={`/preview/${active.id}`} title="Preview" />
            ) : (
              <p className="preview-empty">Select a row to preview.</p>
            )}
          </div>
        </div>
      </div>

      {approvedIds.size > 0 && (
        <div className="publish-bar">
          <span className="publish-bar-count">
            <b>{approvedIds.size}</b> of {rows.length} Case Studies approved
          </span>
          <div className="publish-bar-actions">
            <button className="gw-btn gw-btn-white" onClick={downloadHTML} disabled={busyBar !== null}>
              <i className="ph ph-download-simple" /> {busyBar === "download" ? "Downloading…" : "Download HTML"}
            </button>
            <button className="gw-btn gw-btn-black" onClick={publishApproved} disabled={busyBar !== null}>
              <i className="ph-bold ph-broadcast" /> {busyBar === "publish" ? "Publishing…" : "Publish live"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
