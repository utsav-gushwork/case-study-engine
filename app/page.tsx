"use client";

import { useState, useCallback } from "react";
import { parseCSV, rowsToObjects, toCSV, SEED_ROW } from "@/lib/csv";
import { missingFields, emptyRow, type CaseStudyRow } from "@/lib/schema";

type RowStatus = "working" | "ready" | "needs_review" | "published";
interface Item {
  id: string;
  row: CaseStudyRow;
  status: RowStatus;
  missing: string[];
}

const CONTENT_BRIEF_PROMPT = `Turn my raw notes below into a case-study CSV row for the Case Study Engine.

Reply with only a CSV: one header row with these exact columns, then one data row.
client_name,industry,country,headline,stat1_value,stat1_label,stat2_value,stat2_label,stat3_value,stat3_label,quote_text,quote_author_name,quote_author_role,section_the_customer,section_what_changed,section_why_this_matters,section_closing,tldr_problem,tldr_challenge,tldr_solution,client_website,case_slug

Rules: headline is one line, states the outcome, no full stop. The four section_* columns need the FINISHED paragraph text, not notes — write them properly, in Gushwork's voice (active voice, lead with the outcome). tldr_* columns are optional; leave blank if there isn't enough material for a clean Problem/Challenge/Solution summary.

My raw notes:
[paste your notes, call transcript, or client email here]`;

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const addRow = useCallback(async (partial: Partial<CaseStudyRow>) => {
    const id = "cs-" + Math.random().toString(36).slice(2);
    const row: CaseStudyRow = { ...emptyRow(), ...partial };
    const missing = missingFields(row);
    const status: RowStatus = missing.length ? "needs_review" : "ready";
    setItems((prev) => [...prev, { id, row, status: "working", missing }]);
    setActiveId((cur) => cur ?? id);

    // Save the draft first so a preview link exists immediately.
    await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, row, action: "draft" }),
    });

    // Fetch a hero photo in the background; fall back to the icon silently.
    let photoUrl: string | undefined;
    try {
      const res = await fetch("/api/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: row.industry }),
      });
      const data = await res.json();
      photoUrl = data?.photo?.url;
    } catch {
      /* icon fallback, no error surfaced */
    }
    if (photoUrl) {
      await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, row: { ...row }, action: "draft" }),
      });
    }

    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status, missing } : it)));
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const objs = rowsToObjects(parseCSV(text));
      for (const o of objs) await addRow(o);
    },
    [addRow],
  );

  const handleDocFetch = useCallback(async () => {
    if (!docUrl.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/fetch-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: docUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        await addRow(data.row);
        setDocUrl("");
      }
    } finally {
      setBusy(false);
    }
  }, [docUrl, addRow]);

  const approve = useCallback(async (item: Item) => {
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, row: item.row, action: "publish" }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error + (data.missing ? `: ${data.missing.join(", ")}` : ""));
      return;
    }
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "published" } : it)));
  }, []);

  const downloadTemplate = useCallback(() => {
    const csv = toCSV([SEED_ROW]);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "case-study-template.csv";
    a.click();
  }, []);

  const copyPrompt = useCallback(async () => {
    await navigator.clipboard.writeText(CONTENT_BRIEF_PROMPT);
    alert("Copied — paste into your own Claude Code chat.");
  }, []);

  const active = items.find((it) => it.id === activeId);
  const readyCount = items.filter((it) => it.status === "ready").length;
  const publishedCount = items.filter((it) => it.status === "published").length;

  return (
    <div>
      <h1>Upload</h1>
      <div
        className="dropzone"
        style={dragging ? { borderColor: "#06c" } : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <p>Drop a CSV here, or</p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      <p>
        <button onClick={downloadTemplate}>Download CSV template</button>{" "}
        <button onClick={copyPrompt}>Copy prompt for Claude Code</button>
      </p>

      <p>
        <input
          type="text"
          placeholder="https://docs.google.com/document/d/…"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          style={{ width: 320 }}
        />{" "}
        <button onClick={handleDocFetch} disabled={busy}>
          {busy ? "Fetching…" : "Fetch"}
        </button>
      </p>
      <p className="hint">Doc must be shared &quot;Anyone with the link can view.&quot;</p>

      {items.length > 0 && (
        <div className="layout">
          <div className="rail">
            <p>
              <b>{items.length}</b> rows · <b>{readyCount}</b> ready · <b>{publishedCount}</b> published
            </p>
            <div className="row-list">
              {items.map((it) => (
                <div
                  key={it.id}
                  className={`row-item${it.id === activeId ? " active" : ""}`}
                  onClick={() => setActiveId(it.id)}
                  style={{ cursor: "pointer" }}
                >
                  <span
                    className={`pill${it.status === "ready" || it.status === "published" ? " ok" : it.status === "needs_review" ? " warn" : ""}`}
                  >
                    {it.status}
                  </span>
                  <span style={{ flex: 1 }}>{it.row.client_name || "Untitled"}</span>
                  {it.status === "ready" && (
                    <button className="primary" onClick={() => approve(it)}>
                      Approve
                    </button>
                  )}
                  {it.status === "published" && <span className="hint">live at /case-study/{it.row.case_slug}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="preview-wrap">
            {active ? (
              <iframe src={`/preview/${active.id}`} title="Preview" />
            ) : (
              <p style={{ padding: 20 }}>Select a row to preview.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
