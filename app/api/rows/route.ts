import { NextRequest, NextResponse } from "next/server";
import { listDrafts, discardDraft } from "@/lib/db";

export const dynamic = "force-dynamic";

// Backs the /generate screen's row list — every case study not yet
// published, so the list survives a refresh instead of living only in
// client state.
export async function GET() {
  const rows = await listDrafts();
  return NextResponse.json({ rows });
}

// Discards one unwanted draft row — a master doc can hand back dozens at
// once (see lib/docParser.ts's parseGoogleDoc), so reviewers need a way to
// drop the ones they don't want without approving/publishing them.
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await discardDraft(id);
  return NextResponse.json({ ok: true });
}
