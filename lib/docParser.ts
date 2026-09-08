// Parses a labelled Google Doc export into a CaseStudyRow. Deterministic
// label matching — no LLM. See the PRD's content-brief section: a doc has
// to use the same field labels/section headings a CSV row would carry.
import { type CaseStudyRow, emptyRow, SECTION_HEADINGS, slugify } from "./schema";

// Sentinel values ("__stat1" etc.) aren't real Field names — they mark a
// label that needs splitting into two+ fields, handled below.
const LABELS: Record<string, string> = {
  client: "client_name",
  "client name": "client_name",
  industry: "industry",
  country: "country",
  location: "country",
  headline: "headline",
  "stat 1": "__stat1",
  "stat 2": "__stat2",
  "stat 3": "__stat3",
  quote: "__quote",
  website: "client_website",
  slug: "case_slug",
  "tldr problem": "tldr_problem",
  "tldr challenge": "tldr_challenge",
  "tldr solution": "tldr_solution",
  // Bare aliases — a doc that says just "Problem:"/"Challenge:"/"Solution:"
  // under its own "TLDR" heading, rather than repeating "tldr " on each line.
  problem: "tldr_problem",
  challenge: "tldr_challenge",
  solution: "tldr_solution",
};

const SECTION_LABEL_TO_FIELD: Record<string, keyof CaseStudyRow> = Object.fromEntries(
  Object.entries(SECTION_HEADINGS).map(([field, heading]) => [heading.toLowerCase(), field as keyof CaseStudyRow]),
);

function extractGoogleDocId(url: string): string | null {
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

export function toPublicExportUrl(docUrl: string): string | null {
  const id = extractGoogleDocId(docUrl);
  if (!id) return null;
  return `https://docs.google.com/document/d/${id}/export?format=txt`;
}

/** Fetches a public Google Doc's plain-text export. Throws on non-2xx, and
 *  also on a 2xx that isn't actually the doc — an unshared doc's export URL
 *  redirects to Google's HTML sign-in page with a 200, not an error status,
 *  so a status check alone misses it. The doc must be shared "Anyone with
 *  the link can view." */
export async function fetchDocText(docUrl: string): Promise<string> {
  const exportUrl = toPublicExportUrl(docUrl);
  if (!exportUrl) throw new Error("Not a recognizable Google Doc link");
  const res = await fetch(exportUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Couldn't fetch the doc (${res.status}) — is it shared "Anyone with the link can view"?`,
    );
  }
  const text = await res.text();
  if (/^\s*<(!DOCTYPE html|html)/i.test(text)) {
    throw new Error(
      `That doc isn't shared publicly — Google returned a sign-in page instead of its content. Share it as "Anyone with the link can view" and try again.`,
    );
  }
  return text;
}

/** Splits "Label: value" lines and "Section Heading\n<paragraph>" blocks
 *  into a row. Unlabelled/unrecognized text is ignored, not guessed at. */
export function parseLabelledDoc(text: string): Partial<CaseStudyRow> {
  const row: Partial<CaseStudyRow> = {};
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let currentSection: keyof CaseStudyRow | null = null;
  let sectionBuffer: string[] = [];

  const flushSection = () => {
    if (currentSection && sectionBuffer.length) {
      (row as Record<string, string>)[currentSection] = sectionBuffer.join(" ").trim();
    }
    sectionBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const labelMatch = line.match(/^([A-Za-z][A-Za-z0-9 ]*?)\s*:\s*(.+)$/);
    const sectionHeading = SECTION_LABEL_TO_FIELD[line.toLowerCase()];

    if (sectionHeading) {
      flushSection();
      currentSection = sectionHeading;
      continue;
    }

    if (labelMatch) {
      flushSection();
      currentSection = null;
      const key = labelMatch[1].trim().toLowerCase();
      const value = labelMatch[2].trim();
      const mapped = LABELS[key];
      if (mapped === "__stat1" || mapped === "__stat2" || mapped === "__stat3") {
        const n = mapped.slice(-1);
        const [val, label] = value.split(/\s*[—–-]\s*/, 2);
        (row as Record<string, string>)[`stat${n}_value`] = (val ?? "").trim();
        (row as Record<string, string>)[`stat${n}_label`] = (label ?? "").trim();
      } else if (mapped === "__quote") {
        const m = value.match(/^["“](.+?)["”]\s*[—–-]\s*(.+)$/);
        if (m) {
          row.quote_text = m[1].trim();
          const [name, role] = m[2].split(",").map((s) => s.trim());
          row.quote_author_name = name ?? "";
          row.quote_author_role = role ?? "";
        } else {
          row.quote_text = value;
        }
      } else if (mapped) {
        (row as Record<string, string>)[mapped] = value;
      }
      continue;
    }

    if (currentSection) sectionBuffer.push(line);
  }
  flushSection();

  return { ...emptyRow(), ...row };
}

// ── Master doc: one Google Doc holding many case studies ──────────────────
// Real doc structure observed 8 Sep 2026 (Utsav's own case-study drafts
// doc): each entry is anchored by a literal, consistently-repeated
// "Meta Title: {Client} Case Study | Gushwork" line — no LLM needed to find
// the boundary, it's already there. Everything else per entry (industry/
// country, three stat pairs, a "T;LDR" block with Problem:/Challenge:/
// Solution: lines, then freeform narrative) varies in sub-heading wording
// between entries, so only the few markers confirmed consistent across
// multiple real entries are matched; the rest is bucketed by position, not
// guessed at.
const META_TITLE_RE = /^Meta Title:\s*(.+?)\s+Case Study\s*\|\s*Gushwork\s*$/i;
const INDUSTRY_COUNTRY_LINE_RE = /^(.+?)\s*·\s*(.+)$/;
const TLDR_HEADING_RE = /^t;?ldr$/i;
const BEFORE_GUSHWORK_RE = /^before gushwork$/i;
const WHY_HEADING_RE = /^why\b/i;
const TLDR_LABEL_RE = /^(problem|challenge|solution)\s*:\s*(.+)$/i;

/** True if a line reads as a short standalone sub-heading (no ending
 *  punctuation, under 60 chars) rather than a narrative sentence — used
 *  only to keep those bespoke-worded sub-headings (e.g. "What Gushwork
 *  built") out of the joined paragraph text they introduce, never to infer
 *  what they mean. */
function looksLikeHeading(line: string): boolean {
  return line.length > 0 && line.length < 60 && !/[.!?”"]$/.test(line);
}

/** Splits a doc's full text into one block per "Meta Title: ... Case Study
 *  | Gushwork" anchor, each block starting from that entry's headline line
 *  (immediately above its Meta Title) through to just before the next
 *  entry's headline line. Returns the whole text as a single block when no
 *  anchor is found, so a plain single-case-study doc still parses. */
export function splitMasterDoc(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const anchors: number[] = [];
  lines.forEach((l, i) => {
    if (META_TITLE_RE.test(l.trim())) anchors.push(i);
  });
  if (anchors.length === 0) return [text];

  return anchors.map((metaIdx, k) => {
    const startIdx = Math.max(0, metaIdx - 1);
    const endIdx = k + 1 < anchors.length ? anchors[k + 1] - 1 : lines.length;
    return lines.slice(startIdx, endIdx).join("\n");
  });
}

/** Parses one master-doc block (see splitMasterDoc) into a row. */
export function parseMasterDocBlock(block: string): Partial<CaseStudyRow> {
  const lines = block.replace(/\r\n/g, "\n").split("\n");
  const row: Partial<CaseStudyRow> = {};

  const metaIdx = lines.findIndex((l) => META_TITLE_RE.test(l.trim()));
  if (metaIdx === -1) return parseLabelledDoc(block);

  const metaMatch = lines[metaIdx].trim().match(META_TITLE_RE)!;
  const clientName = metaMatch[1].trim();
  row.client_name = clientName;
  row.case_slug = slugify(clientName);

  const headlineLine = metaIdx > 0 ? lines[metaIdx - 1].trim() : "";
  row.headline = headlineLine.toLowerCase().startsWith(clientName.toLowerCase() + ":")
    ? headlineLine.slice(clientName.length + 1).trim()
    : headlineLine;

  // Explicit "Industry:"/"Location:" labels anywhere in the block win first;
  // otherwise fall back to a single "Industry · Country" line. stopAt always
  // tracks "first line after the last thing we've consumed", so stat
  // collection below picks up right where this leaves off either way.
  let stopAt = lines.length;
  for (let i = metaIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const labelMatch = line.match(/^(industry|location|country)\s*:\s*(.+)$/i);
    if (labelMatch) {
      const key = labelMatch[1].toLowerCase();
      row[key === "industry" ? "industry" : "country"] = labelMatch[2].trim();
      stopAt = i + 1;
      continue;
    }
    const combo = line.match(INDUSTRY_COUNTRY_LINE_RE);
    if (combo && !row.industry) {
      row.industry = combo[1].trim();
      row.country = combo[2].trim();
      stopAt = i + 1;
      break;
    }
    if (TLDR_HEADING_RE.test(line)) {
      break;
    }
  }

  // Three stat value/label pairs between the industry line and "T;LDR". A
  // bare divider line ("________________") sometimes separates the stats
  // from the narrative — has no letters at all, cheap and safe to skip.
  const hasLetters = (s: string) => /[a-zA-Z]/.test(s);
  const statLines: string[] = [];
  let tldrIdx = -1;
  for (let i = stopAt; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !hasLetters(line)) continue;
    if (TLDR_HEADING_RE.test(line)) {
      tldrIdx = i;
      break;
    }
    if (statLines.length < 6) statLines.push(line);
  }
  for (let s = 0; s < 3; s++) {
    const value = statLines[s * 2];
    const label = statLines[s * 2 + 1];
    if (value) (row as Record<string, string>)[`stat${s + 1}_value`] = value;
    if (label) (row as Record<string, string>)[`stat${s + 1}_label`] = label;
  }

  // Pre-TLDR intro narrative — the opening of section_the_customer.
  const introLines: string[] = [];
  if (tldrIdx > -1) {
    for (let i = stopAt; i < tldrIdx; i++) {
      const line = lines[i].trim();
      if (line && hasLetters(line) && !statLines.slice(0, 6).includes(line)) introLines.push(line);
    }
  }

  // TLDR's three labelled lines.
  let afterTldrIdx = lines.length;
  if (tldrIdx > -1) {
    afterTldrIdx = tldrIdx + 1;
    for (let i = tldrIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const m = line.match(TLDR_LABEL_RE);
      if (!m) {
        afterTldrIdx = i;
        break;
      }
      const field = LABELS[m[1].toLowerCase()];
      if (field) (row as Record<string, string>)[field] = m[2].trim();
      afterTldrIdx = i + 1;
    }
  }

  // Post-TLDR narrative, split on the two markers confirmed consistent
  // across real entries: "Before Gushwork" opens the customer section,
  // a line starting "Why" opens the why-this-matters section. Everything
  // in between (regardless of its own bespoke sub-headings) is
  // section_what_changed. section_closing has no source in this doc format
  // — left blank, flagged by missingFields for a manual pass rather than
  // guessed at.
  let phase: "customer" | "changed" | "why" = "customer";
  let seenBeforeGushwork = false;
  const customerLines = [...introLines];
  const changedLines: string[] = [];
  const whyLines: string[] = [];
  for (let i = afterTldrIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (WHY_HEADING_RE.test(line)) {
      phase = "why";
      continue; // the heading itself never joins the prose
    }
    if (BEFORE_GUSHWORK_RE.test(line)) {
      seenBeforeGushwork = true;
      continue; // its content still belongs to section_the_customer
    }
    if (phase !== "why" && looksLikeHeading(line)) {
      // Any other short heading-like line after "Before Gushwork" opens the
      // aggregated "what changed" middle section — its own bespoke wording
      // ("What Gushwork built", "The TATA inquiry", ...) isn't parsed
      // individually, just used as a boundary.
      if (seenBeforeGushwork) phase = "changed";
      continue;
    }

    if (phase === "customer") customerLines.push(line);
    else if (phase === "changed") changedLines.push(line);
    else whyLines.push(line);
  }

  row.section_the_customer = customerLines.join(" ").trim();
  row.section_what_changed = changedLines.join(" ").trim();
  row.section_why_this_matters = whyLines.join(" ").trim();

  return { ...emptyRow(), ...row };
}

/** Entry point for /api/fetch-doc: always returns an array — one row for a
 *  plain single-case-study doc, many for a master doc holding several. */
export function parseGoogleDoc(text: string): Partial<CaseStudyRow>[] {
  const blocks = splitMasterDoc(text);
  if (blocks.length === 1 && !META_TITLE_RE.test(blocks[0])) {
    return [parseLabelledDoc(blocks[0])];
  }
  return blocks.map(parseMasterDocBlock);
}
