import TopBar from "@/components/TopBar";

// Chrome for the tool itself only — Home, Generate, Published, Sign-in.
// /preview/[id] and /case-study/[slug] render CaseStudyTemplate directly,
// outside this group: a generated case study is a standalone document (it
// gets shown to prospects, sometimes stood up on its own), never wrapped
// in this app's own nav bar, reading-column width, or background texture.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell">
      <TopBar />
      <main>{children}</main>
    </div>
  );
}
