import { NextRequest, NextResponse } from "next/server";
import { searchHeroPhoto } from "@/lib/unsplash";

export async function POST(req: NextRequest) {
  const { industry, page } = await req.json();
  if (!industry || typeof industry !== "string") {
    return NextResponse.json({ error: "Missing industry" }, { status: 400 });
  }
  // Returns null (not an error) when there's no key or no match — the
  // caller falls back to the icon treatment, same as the established rule.
  // `page` lets the "regenerate" action ask for a different match instead
  // of the same top result every time.
  const photo = await searchHeroPhoto(industry, typeof page === "number" ? page : 1).catch(() => null);
  return NextResponse.json({ photo });
}
