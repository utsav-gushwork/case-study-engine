import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublished } from "@/lib/db";
import { deriveMetaTitle, deriveMetaDescription } from "@/lib/schema";
import CaseStudyTemplate from "@/components/CaseStudyTemplate";

export const dynamic = "force-dynamic"; // always read the current DB row, never cache stale content

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await getPublished(params.slug);
  if (!row) return {};
  return {
    title: deriveMetaTitle(row),
    description: deriveMetaDescription(row),
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const row = await getPublished(params.slug);
  if (!row) notFound();
  return <CaseStudyTemplate row={row} />;
}
