"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { parseCSV, rowsToObjects, toCSV, SEED_ROW } from "@/lib/csv";
import { emptyRow, type CaseStudyRow } from "@/lib/schema";
import type { PublishedEntry } from "@/lib/db";

const CONTENT_BRIEF_PROMPT = `Turn the Google Doc below into a case-study CSV for the Case Study Gen Studio.

The doc may hold ONE case study, or several bundled together into one "master doc". Handle both: read the whole doc first, find every distinct case study in it — a new one usually starts at its own outcome-led headline plus a line like "Meta Title: {Client} Case Study | Gushwork", or just a clear switch to a different client/company — and produce one CSV data row per case study you find, not just the first one.

If I gave you a Google Docs link rather than pasted text: extract the file ID from it and fetch https://docs.google.com/document/d/{ID}/export?format=txt to get the plain text. If that comes back as an HTML sign-in page instead of real content, the doc isn't shared "Anyone with the link can view" — tell me and stop, don't guess at content. If you have no way to fetch URLs at all, ask me to paste the doc's text instead.

Reply with only a CSV: one header row with these exact columns, then one data row per case study.
client_name,industry,country,headline,stat1_value,stat1_label,stat2_value,stat2_label,stat3_value,stat3_label,quote_text,quote_author_name,quote_author_role,section_the_customer,section_what_changed,section_why_this_matters,section_closing,tldr_problem,tldr_challenge,tldr_solution,client_website,case_slug

For each case study, extract:
- client_name: the company's name, exactly as written.
- industry / country: explicit "Industry:"/"Location:" (or "Country:") labels win first; otherwise look for a single line shaped like "{Industry} · {Country}" near the top of the entry.
- headline: the outcome-led title line right above the entry's own heading/meta-title marker (strip a leading "{Client}: " prefix if it repeats the client name). One line, states the outcome, no full stop — Gushwork headings never end in a period, not even ones you write yourself.
- stat1/2/3 value + label: three (value, label) pairs — a number/metric followed by its short description — usually sitting together as a block of short lines before the narrative starts, sometimes separated from it by a bare divider line of underscores or dashes. A bare number with no letters ("100", "50+") is still a real value, not a divider — don't skip it.
- quote_text / quote_author_name / quote_author_role: only fill these in for an actual direct quote in quotation marks, attributed to a named person. A sentence that just mentions someone by name, or a paraphrased/reported claim, is not a quote — leave all three blank rather than force one.
- section_the_customer: the narrative up through wherever the doc marks the "before" state (often a line like "Before Gushwork") — who the client is and what things looked like beforehand.
- section_what_changed: what Gushwork actually built or did, and the concrete results — usually the largest, middle part of the narrative. The doc's own bespoke sub-headings here ("What Gushwork built", "What changed for X", ...) are structure, not content to repeat verbatim — write this as one flowing paragraph, not a list of headed fragments.
- section_why_this_matters: the closing reflection on why the result matters, usually opening at a heading starting "Why..." — everything from there to (but not including) any final wrap-up/next-steps note.
- section_closing: only fill this in if the doc has a distinct closing/wrap-up statement separate from section_why_this_matters — otherwise leave it blank rather than duplicate content or invent one.
- tldr_problem / tldr_challenge / tldr_solution: look for a section headed "TLDR" (or "T;LDR", or "Problem, Challenge, Solution" — same section, different label) with "Problem:"/"Challenge:"/"Solution:" lines under it. Leave all three blank if that entry doesn't have this structure.
- client_website: only if the client's own site URL actually appears in the doc; otherwise blank.
- case_slug: the client name, lowercased, with spaces/punctuation collapsed to single hyphens (e.g. "Percy's Lawn Care" → "percy-s-lawn-care").

Writing rules for every section_*/tldr_* field: finished, Gushwork-voice paragraphs, not raw notes — active voice, lead with the outcome, sentence case, no exclamation marks. Use the doc's own real sentences and numbers; never invent facts, quotes, or results that aren't in the source.

CSV formatting: quote any field containing a comma, quote mark, or line break, doubling internal quote marks (standard RFC4180) — the section_* fields are full paragraphs and will need this.

Google Doc:
[paste the doc link, or its full text, here]`;

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
    // Keyed by slug so re-running Start Generating on the same doc updates
    // the existing draft instead of piling on a duplicate row each time.
    const id = partial.case_slug ? "cs-" + partial.case_slug : "cs-" + Math.random().toString(36).slice(2);
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
