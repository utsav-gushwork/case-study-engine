import { NextMiddleware, NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { AUTH_ENABLED } from "@/lib/auth";

// Gates the TOOL, never the output. /case-study/* is what a prospect sees
// on a call — it must stay public, no Google login. Everything else (the
// upload/review UI, the published log, the API routes that create or
// publish a row) is MEANT to require sign-in, since that's what makes
// attribution ("who created/published this") possible at all — but that
// gate is phase 2 (see lib/auth.ts's AUTH_ENABLED).
//
// While it's off, next-auth's own middleware is never even constructed,
// not just never invoked — building it eagerly at module scope crashed
// Vercel's edge middleware in production (MIDDLEWARE_INVOCATION_FAILED)
// with no NEXTAUTH_SECRET set, which next-auth tolerates in `next dev` but
// not there. Deferring the `withAuth(...)` call into the function body,
// behind the same flag, means it's only ever constructed once AUTH_ENABLED
// is true and a secret genuinely exists — same lazy-singleton shape as
// lib/db.ts's getStore().
let authMiddleware: NextMiddleware | null = null;

const middleware: NextMiddleware = (...args) => {
  if (!AUTH_ENABLED) return NextResponse.next();
  if (!authMiddleware) {
    authMiddleware = withAuth({
      callbacks: {
        authorized: ({ token }) => !!token,
      },
    }) as unknown as NextMiddleware;
  }
  return authMiddleware(...args);
};

export default middleware;

export const config = {
  matcher: [
    "/",
    "/generate",
    "/published",
    "/preview/:path*",
    "/api/fetch-doc",
    "/api/photo",
    "/api/publish",
    "/api/rows",
    "/api/published-log",
  ],
};
