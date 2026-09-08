import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Case Study Gen Studio",
  description: "Bulk case-study generator — CSV/Doc in, on-brand pages out.",
};

// Deliberately bare: a generated case study (/preview/[id], /case-study/
// [slug]) shares this shell but nothing else — no nav bar, no reading-
// column width, no background texture. Those belong to the tool's own
// pages only, added by app/(studio)/layout.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2/src/regular/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2/src/bold/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2/src/fill/style.css" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
