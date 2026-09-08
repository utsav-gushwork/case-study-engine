import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, AUTH_ENABLED } from "@/lib/auth";
import { saveDraft, publish, getCaseStudy } from "@/lib/db";
import { missingFields } from "@/lib/schema";
import { pingUnsplashDownload } from "@/lib/unsplash";
import type { CaseStudyRow } from "@/lib/schema";

// One route handles both: save-as-draft (so a row survives a refresh while
// still being reviewed) and the actual publish action. No review gate on
// publish — see the PRD: the template was reviewed once, a generated page
// introduces no new design decision.
//
// Attribution comes from the server-side session, never a client-supplied
// field. Phase 1 (AUTH_ENABLED false) has no session to read, so rows are
// attributed as "unattributed" instead of 401ing — real attribution starts
// the moment phase 2 flips the flag on, no other code change needed.

export async function POST(req: NextRequest) {
  // getServerSession() itself throws ("There is a problem with the server
  // configuration") when NEXTAUTH_SECRET isn't set — true right now, phase 2
  // hasn't started. Skip the call entirely while auth is off instead of
  // catching the throw, same shape as middleware.ts's lazy construction.
  const session = AUTH_ENABLED ? await getServerSession(authOptions) : null;
  const who = session?.user?.email ?? (AUTH_ENABLED ? undefined : "unattributed");
  if (!who) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json();
  const { id, row, action, photo } = body as {
    id: string;
    row: CaseStudyRow;
    action: "draft" | "publish";
    photo?: { url?: string; credit?: { name: string; profileUrl: string } | null; downloadLocation?: string };
  };

  if (!id || !row) {
    return NextResponse.json({ error: "Missing id or row" }, { status: 400 });
  }

  const missing = missingFields(row);
  const status = missing.length ? "needs_review" : "ready";
  await saveDraft(id, row, status, who, photo);

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
  if (result?.photoCredit && existing?.photoDownloadLocation) {
    await pingUnsplashDownload(existing.photoDownloadLocation);
  }

  return NextResponse.json({ published: result });
}
