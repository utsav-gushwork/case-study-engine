import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { AUTH_ENABLED } from "@/lib/auth";

// Gates the TOOL, never the output. /case-study/* is what a prospect sees
// on a call — it must stay public, no Google login. Everything else (the
// upload/review UI, the published log, the API routes that create or
// publish a row) is MEANT to require sign-in, since that's what makes
// attribution ("who created/published this") possible at all — but that
// gate is phase 2 (see lib/auth.ts's AUTH_ENABLED).
//
// While it's off, this short-circuits BEFORE next-auth's own middleware
// runs at all — not just via its `authorized` callback — because that
// middleware calls getToken() unconditionally on every matched request,
// which needs NEXTAUTH_SECRET even to conclude "no session." No secret is
// configured in phase 1, and shouldn't need to be.
const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export default function middleware(...args: Parameters<typeof authMiddleware>) {
  if (!AUTH_ENABLED) return NextResponse.next();
  return authMiddleware(...args);
}

export const config = {
  matcher: ["/", "/published", "/preview/:path*", "/api/fetch-doc", "/api/photo", "/api/publish"],
};
