import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Restricts sign-in to the company's Google Workspace domain, so login
// doubles as the access gate the tool needs (Utsav's ask: track who
// created/published each case study). Change or remove ALLOWED_DOMAIN if a
// broader or narrower gate is wanted — this is a default, not a ruling.
const ALLOWED_DOMAIN = "gushwork.ai";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const hd = (profile as { hd?: string } | undefined)?.hd;
      return hd === ALLOWED_DOMAIN;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};
