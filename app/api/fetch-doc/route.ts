import { NextRequest, NextResponse } from "next/server";
import { fetchDocText, parseGoogleDoc } from "@/lib/docParser";
import { missingFields, slugify } from "@/lib/schema";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing doc url" }, { status: 400 });
  }
  try {
    const text = await fetchDocText(url);
    const parsed = parseGoogleDoc(text);
    const rows = parsed.map((row) => {
      if (!row.case_slug && row.client_name) row.case_slug = slugify(row.client_name);
      const missing = missingFields(row);
      return { row, missing, status: missing.length ? "needs_review" : "ready" };
    });
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Couldn't fetch that doc" }, { status: 422 });
  }
}
