import { NextResponse } from "next/server";
import { listDrafts } from "@/lib/db";

export const dynamic = "force-dynamic";

// Backs the /generate screen's row list — every case study not yet
// published, so the list survives a refresh instead of living only in
// client state.
export async function GET() {
  const rows = await listDrafts();
  return NextResponse.json({ rows });
}
