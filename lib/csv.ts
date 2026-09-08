// RFC4180-ish CSV parsing: quoted fields, embedded commas/newlines, escaped
// quotes. Deterministic — no LLM involved, per the PRD's zero-API pipeline.
import { FIELDS, type CaseStudyRow, emptyRow } from "./schema";

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }
  return rows;
}

export function rowsToObjects(rows: string[][]): Partial<CaseStudyRow>[] {
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Partial<CaseStudyRow> = {};
      header.forEach((h, idx) => {
        if ((FIELDS as readonly string[]).includes(h)) {
          (obj as Record<string, string>)[h] = (r[idx] ?? "").trim();
        }
      });
      return obj;
    });
}

function csvCell(v: string | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(objects: Partial<CaseStudyRow>[]): string {
  const lines = [FIELDS.join(",")];
  for (const o of objects) {
    lines.push(FIELDS.map((f) => csvCell(o[f])).join(","));
  }
  return lines.join("\n");
}

export const SEED_ROW: CaseStudyRow = {
  ...emptyRow(),
  client_name: "Cutting Edge Plasma",
  industry: "CNC Equipment",
  country: "USA",
  headline: "From Chasing CNC Buyers To Getting Found On Google",
  stat1_value: "#1 rankings",
  stat1_label: "for high-intent searches across Midwest states",
  stat2_value: "4,000+",
  stat2_label: "Visitors to their site",
  stat3_value: "50+ leads",
  stat3_label: "Generated since they started working with us",
  quote_text: "What you guys are doing is far superior to what I was doing.",
  quote_author_name: "Steve Fisher",
  quote_author_role: "Owner, Cutting Edge Plasma",
  section_the_customer:
    "Cutting Edge Plasma had a good product, strong reviews, and a clear buyer base. But the website was not bringing in buyers — Steve Fisher, the owner, was doing most of the sales work himself.",
  section_what_changed:
    "In the first 90 days, the channel started bringing in buyers who matched Cutting Edge Plasma's market — fabrication shops, custom metalwork businesses, independent operators.",
  section_why_this_matters:
    "Cutting Edge Plasma did not need more abstract marketing activity. Steve needed buyers who were already looking for CNC equipment to find him before they found someone else.",
  section_closing:
    "The channel is now bringing in buyers from the exact geography Steve wanted to focus on. The sales work is still his — but the top of the funnel has changed.",
  case_slug: "cutting-edge-plasma",
};
