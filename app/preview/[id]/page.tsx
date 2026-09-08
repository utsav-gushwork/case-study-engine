import { notFound } from "next/navigation";
import { getCaseStudy } from "@/lib/db";
import CaseStudyTemplate from "@/components/CaseStudyTemplate";

export const dynamic = "force-dynamic";

// Draft preview — any row regardless of status, so it works before publish.
// Same template component the live /case-study/[slug] route uses.
export default async function PreviewPage({ params }: { params: { id: string } }) {
  const row = await getCaseStudy(params.id);
  if (!row) notFound();
  return <CaseStudyTemplate row={row} />;
}
