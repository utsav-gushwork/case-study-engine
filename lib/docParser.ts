// Parses a labelled Google Doc export into a CaseStudyRow. Deterministic
// label matching — no LLM. See the PRD's content-brief section: a doc has
// to use the same field labels/section headings a CSV row would carry.
import { type CaseStudyRow, emptyRow, SECTION_HEADINGS } from "./schema";

// Sentinel values ("__stat1" etc.) aren't real Field names — they mark a
// label that needs splitting into two+ fields, handled below.
const LABELS: Record<string, string> = {
  client: "client_name",
  "client name": "client_name",
  industry: "industry",
  country: "country",
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

/** Fetches a public Google Doc's plain-text export. Throws on non-2xx —
 *  the doc must be shared "Anyone with the link can view." */
export async function fetchDocText(docUrl: string): Promise<string> {
  const exportUrl = toPublicExportUrl(docUrl);
  if (!exportUrl) throw new Error("Not a recognizable Google Doc link");
  const res = await fetch(exportUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Couldn't fetch the doc (${res.status}) — is it shared "Anyone with the link can view"?`,
    );
  }
  return res.text();
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
