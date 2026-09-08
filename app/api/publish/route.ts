import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveDraft, publish, getCaseStudy } from "@/lib/db";
import { missingFields } from "@/lib/schema";
import { pingUnsplashDownload } from "@/lib/unsplash";
import type { CaseStudyRow } from "@/lib/schema";

// One route handles both: save-as-draft (so a row survives a refresh while
// still being reviewed) and the actual publish action. No review gate on
// publish — see the PRD: the template was reviewed once, a generated page
// introduces no new design decision.
//
// Attribution always comes from the server-side session, never a client-
// supplied field — that's the whole point of gating this route on login.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const who = session?.user?.email;
  if (!who) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json();
  const { id, row, action } = body as { id: string; row: CaseStudyRow; action: "draft" | "publish" };

  if (!id || !row) {
    return NextResponse.json({ error: "Missing id or row" }, { status: 400 });
  }

  const missing = missingFields(row);
  const status = missing.length ? "needs_review" : "ready";
  await saveDraft(id, row, status as any, who);

  if (action === "draft") {
    return NextResponse.json({ status, missing });
  }

  if (missing.length) {
    return NextResponse.json({ error: "Not ready to publish", missing }, { status: 422 });
  }

  const existing = await getCaseStudy(id);
  const result = await publish(id, {
    publishedBy: who,
    photoUrl: existing?.photoUrl,
    photoCredit: existing?.photoCredit,
  });

  // Unsplash API terms: ping the download endpoint only once a photo is
  // actually used, i.e. right here at publish — never on every preview render.
  if (result?.photoCredit && (existing as any)?.photoDownloadLocation) {
    await pingUnsplashDownload((existing as any).photoDownloadLocation);
  }

  return NextResponse.json({ published: result });
}
