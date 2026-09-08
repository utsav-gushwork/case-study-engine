import { NextResponse } from "next/server";
import { listPublished } from "@/lib/db";

export const dynamic = "force-dynamic";

// Same data as the /published page, but as JSON — the Home screen's
// "Published case studies" card is a client component and needs to fetch
// this rather than render it server-side.
export async function GET() {
  const rows = await listPublished();
  return NextResponse.json({ rows });
}
