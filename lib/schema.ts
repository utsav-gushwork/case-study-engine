// The case-study content brief — see the PRD's "Content brief" section.
// Every field here has to arrive already written; nothing in this app drafts
// or interprets copy. Same shape whether it lands as a CSV row or a parsed doc.

export const FIELDS = [
  "client_name",
  "industry",
  "country",
  "headline",
  "stat1_value",
  "stat1_label",
  "stat2_value",
  "stat2_label",
  "stat3_value",
  "stat3_label",
  "quote_text",
  "quote_author_name",
  "quote_author_role",
  "section_the_customer",
  "section_what_changed",
  "section_why_this_matters",
  "section_closing",
  "tldr_problem",
  "tldr_challenge",
  "tldr_solution",
  "client_website",
  "case_slug",
] as const;

export type Field = (typeof FIELDS)[number];
export type CaseStudyRow = Record<Field, string>;

// Missing any of these means the row can't generate a page yet.
export const REQUIRED_FIELDS: Field[] = [
  "client_name",
  "industry",
  "country",
  "headline",
  "stat1_value",
  "stat1_label",
  "stat2_value",
  "stat2_label",
  "stat3_value",
  "stat3_label",
  "quote_text",
  "quote_author_name",
  "section_the_customer",
  "section_what_changed",
  "section_why_this_matters",
  "section_closing",
];

export function emptyRow(): CaseStudyRow {
  const row = {} as CaseStudyRow;
  for (const f of FIELDS) row[f] = "";
  return row;
}

export function missingFields(row: Partial<CaseStudyRow>): Field[] {
  return REQUIRED_FIELDS.filter((f) => !row[f] || !row[f]!.trim());
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function deriveMetaDescription(row: Partial<CaseStudyRow>): string {
  if (!row.client_name) return "";
  const stat =
    row.stat3_value && row.stat3_label
      ? `${row.stat3_value} ${row.stat3_label}`.toLowerCase()
      : row.stat2_value && row.stat2_label
        ? `${row.stat2_value} ${row.stat2_label}`.toLowerCase()
        : "real results";
  let desc = `See how ${row.client_name}${row.industry ? `, a ${row.industry} business,` : ""} hit ${stat} with Gushwork's AI-powered SEO.`;
  if (desc.length > 160) desc = desc.slice(0, 157).trim() + "…";
  return desc;
}

export function deriveMetaTitle(row: Partial<CaseStudyRow>): string {
  return row.client_name ? `${row.client_name} Case Study | Gushwork` : "";
}

// The exact four section headings the template ships — literal text, never
// data. See the PRD: "those four headings are literal template text."
export const SECTION_HEADINGS: Record<
  "section_the_customer" | "section_what_changed" | "section_why_this_matters" | "section_closing",
  string
> = {
  section_the_customer: "The customer",
  section_what_changed: "What changed",
  section_why_this_matters: "Why this matters",
  section_closing: "Ready to build your growth story",
};

export type PublishStatus = "needs_review" | "ready" | "published";

export interface StoredCaseStudy extends CaseStudyRow {
  id: string;
  status: PublishStatus;
  photoUrl?: string;
  photoCredit?: { name: string; profileUrl: string } | null;
  photoDownloadLocation?: string;
  createdAt: string;
  createdBy?: string;
  publishedAt?: string;
  publishedBy?: string;
}
