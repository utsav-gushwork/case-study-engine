"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { parseCSV, rowsToObjects, toCSV, SEED_ROW } from "@/lib/csv";
import { emptyRow, type CaseStudyRow } from "@/lib/schema";
import type { PublishedEntry } from "@/lib/db";

const CONTENT_BRIEF_PROMPT = `Turn my raw notes below into a case-study CSV row for the Case Study Gen Studio.

Reply with only a CSV: one header row with these exact columns, then one data row.
client_name,industry,country,headline,stat1_value,stat1_label,stat2_value,stat2_label,stat3_value,stat3_label,quote_text,quote_author_name,quote_author_role,section_the_customer,section_what_changed,section_why_this_matters,section_closing,tldr_problem,tldr_challenge,tldr_solution,client_website,case_slug

Rules: headline is one line, states the outcome, no full stop. The four section_* columns need the FINISHED paragraph text, not notes — write them properly, in Gushwork's voice (active voice, lead with the outcome). tldr_* columns are optional; leave blank if there isn't enough material for a clean Problem/Challenge/Solution summary.

My raw notes:
[paste your notes, call transcript, or client email here]`;

// Shown only while nothing's really been published yet — clearly marked as
// examples (dashed border + a caption), never mixed in with real rows.
const SAMPLE_PUBLISHED = [
  { id: "sample-1", client_name: "Example Client Co", domain: "exampleclient.com" },
  { id: "sample-2", client_name: "Sample Industries", domain: "sampleindustries.com" },
  { id: "sample-3", client_name: "Acme Logistics", domain: "acmelogistics.com" },
  { id: "sample-4", client_name: "Bright Path Health", domain: "brightpathhealth.com" },
  { id: "sample-5", client_name: "Northwind Supply Co", domain: "northwindsupply.com" },
];

function domainOf(row: Partial<CaseStudyRow>): string {
  if (!row.client_website) return "";
  return row.client_website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [docUrl, setDocUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [published, setPublished] = useState<PublishedEntry[]>([]);
  const [needsContentError, setNeedsContentError] = useState(false);

  useEffect(() => {
    fetch("/api/published-log")
      .then((r) => r.json())
      .then((d) => setPublished(d.rows ?? []))
      .catch(() => {});
  }, []);

  const draftRow = useCallback(async (partial: Partial<CaseStudyRow>) => {
    const id = "cs-" + Math.random().toString(36).slice(2);
    const row: CaseStudyRow = { ...emptyRow(), ...partial };
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, row, action: "draft" }),
    });
    if (!res.ok) {
      throw new Error(`Couldn't save that row (${res.status}) — nothing was lost, try again.`);
    }
  }, []);

  const startGenerating = useCallback(async () => {
    if (!pendingFile && !docUrl.trim()) {
      setNeedsContentError(true);
      return;
    }
    setNeedsContentError(false);
    setBusy(true);
    try {
      if (pendingFile) {
        const text = await pendingFile.text();
        const objs = rowsToObjects(parseCSV(text));
        for (const o of objs) await draftRow(o);
      }
      if (docUrl.trim()) {
        const res = await fetch("/api/fetch-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: docUrl.trim() }),
        });
        const data = await res.json();
        if (data.error) {
          alert(data.error);
          return;
        }
        // A doc can hold one case study or many (a master doc, each entry
        // marked by its own "Meta Title: ... Case Study | Gushwork" line) —
        // /api/fetch-doc always returns an array, draft every row it found.
        for (const r of data.rows as { row: CaseStudyRow }[]) await draftRow(r.row);
      }
      router.push("/generate");
    } catch (err: any) {
      alert(err?.message ?? "Something went wrong — nothing was generated.");
    } finally {
      setBusy(false);
    }
  }, [pendingFile, docUrl, draftRow, router]);

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

  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h1 style={{ fontSize: 56, fontWeight: 600 }}>Welcome{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="hint" style={{ marginTop: 20, fontSize: 16 }}>
          You can create and find all case studies published here.
        </p>
      </div>

      <div className="home-cards">
        <div className="gw-card home-card">
          <div className="home-card-head">
            <div className="home-card-head-row">
              <h2>Create new case study</h2>
              <span className="icon-badge">
                <i className="ph-fill ph-sparkle" />
              </span>
            </div>
            <p>Drop in a .CSV or google doc link to start generating</p>
          </div>

          <div className="upload-row">
            <label
              className="dropzone"
              style={dragging ? { borderColor: "var(--gw-primary-500)" } : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) setPendingFile(file);
              }}
            >
              <span>{pendingFile ? pendingFile.name : "Drop a CSV here or"}</span>
              <span className="gw-btn gw-btn-grey">
                <i className="ph-fill ph-cloud-arrow-up" /> Upload .csv
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="or-divider-col">
              <span className="rule" />
              <span>OR</span>
              <span className="rule" />
            </div>
            <div className="doc-panel">
              <h3>Drop the Google doc link below</h3>
              <p className="hint">Make sure the doc is on view all settings.</p>
              <div className="field-row">
                <input
                  type="text"
                  placeholder="paste google doc link here…"
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                />
                <button className="gw-btn gw-btn-grey" onClick={startGenerating} disabled={busy} type="button">
                  Fetch
                </button>
              </div>
            </div>
          </div>

          {needsContentError && <p className="field-error">Attach a CSV or paste a Google Doc link first.</p>}

          <div style={{ display: "flex", gap: 16 }}>
            <button className="gw-btn-ghost gw-btn gw-btn-sm" onClick={downloadTemplate} type="button">
              Download CSV template
            </button>
            <button className="gw-btn-ghost gw-btn gw-btn-sm" onClick={copyPrompt} type="button">
              Copy prompt for Claude Code
            </button>
          </div>
          <button className="gw-btn gw-btn-black" onClick={startGenerating} disabled={busy}>
            <i className="ph-bold ph-sparkle" /> {busy ? "Starting…" : "Start Generating"}
          </button>
        </div>

        <div className="gw-card home-card">
          <div className="home-card-head">
            <div className="home-card-head-row">
              <h2>Published case studies</h2>
              <span className="icon-badge">
                <img src="/assets/home/icon-published-badge.svg" alt="" />
              </span>
            </div>
          </div>
          <div className="published-list">
            {published.length === 0 &&
              SAMPLE_PUBLISHED.map((s) => (
                <div key={s.id} className="published-row">
                  <div className="published-row-top">
                    <div className="published-row-name-col">
                      <b>{s.client_name}</b>
                      <span className="published-row-domain">{s.domain}</span>
                    </div>
                    <span className="gw-chip gw-chip-live">Live</span>
                  </div>
                  <div className="published-row-meta">Example — real published case studies will appear here</div>
                </div>
              ))}
            {published.slice(0, 5).map((r) => (
              <div key={r.id} className="published-row">
                <div className="published-row-top">
                  <div className="published-row-name-col">
                    <b>{r.client_name}</b>
                    <span className="published-row-domain">{domainOf({ client_website: r.client_website }) || r.slug}</span>
                  </div>
                  <span className="gw-chip gw-chip-live">Live</span>
                </div>
                <div className="published-row-meta">
                  Published on {new Date(r.publishedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}, {new Date(r.publishedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} by{" "}
                  <u>{r.publishedBy}</u>
                </div>
              </div>
            ))}
          </div>
          <Link href="/published" className="gw-btn gw-btn-black" style={{ textDecoration: "none", justifyContent: "center" }}>
            See All Published Case Studies
          </Link>
        </div>
      </div>
    </div>
  );
}
