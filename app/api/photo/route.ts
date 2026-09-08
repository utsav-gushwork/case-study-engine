import { NextRequest, NextResponse } from "next/server";
import { searchHeroPhoto } from "@/lib/unsplash";

export async function POST(req: NextRequest) {
  const { industry } = await req.json();
  if (!industry || typeof industry !== "string") {
    return NextResponse.json({ error: "Missing industry" }, { status: 400 });
  }
  // Returns null (not an error) when there's no key or no match — the
  // caller falls back to the icon treatment, same as the established rule.
  const photo = await searchHeroPhoto(industry).catch(() => null);
  return NextResponse.json({ photo });
}
