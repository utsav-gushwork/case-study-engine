export { default } from "next-auth/middleware";

// Gates the TOOL, never the output. /case-study/* is what a prospect sees
// on a call — it must stay public, no Google login. Everything else (the
// upload/review UI, the published log, the API routes that create or
// publish a row) requires sign-in, since that's what makes attribution
// ("who created/published this") possible at all.
export const config = {
  matcher: ["/", "/published", "/preview/:path*", "/api/fetch-doc", "/api/photo", "/api/publish"],
};
