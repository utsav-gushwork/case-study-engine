import type { Metadata } from "next";
import Providers from "@/components/Providers";
import TopBar from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Case Study Engine",
  description: "Bulk case-study generator — CSV/Doc in, on-brand pages out.",
};

// Deliberately bare-bones — a real visual design comes from Figma later
// (see the PRD); no point investing styling effort here twice.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TopBar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
