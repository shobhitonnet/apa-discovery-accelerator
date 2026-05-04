import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PROCESS_TEMPLATES } from "@/types";
import { NewEngagementForm } from "./NewEngagementForm";

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  stepCount: number;
  systemCount: number;
  isCustom: boolean;
}

export default async function NewEngagementPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Fetch distinct process templates from DB with step counts
  const stepGroups = await prisma.processStepTemplate.groupBy({
    by: ["processTemplate"],
    _count: { id: true },
    where: { processTemplate: { not: "generic" } },
  });

  // Systems per template
  const allSystems = await prisma.applicationSystem.findMany({
    select: { processTemplates: true },
  });

  const templates: TemplateSummary[] = stepGroups.map((g) => {
    const slug = g.processTemplate;
    const known = PROCESS_TEMPLATES.find((t) => t.id === slug);
    const systemCount = allSystems.filter(
      (s) => s.processTemplates.includes("*") || s.processTemplates.includes(slug)
    ).length;

    return {
      id: slug,
      name: known?.name ?? slugToTitle(slug),
      description: known?.description ?? `AI-generated reference process for ${slugToTitle(slug)}.`,
      stepCount: g._count.id,
      systemCount,
      isCustom: !known,
    };
  });

  // Sort: built-in first, then custom alphabetically
  templates.sort((a, b) => {
    if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return <NewEngagementForm templates={templates} />;
}

function slugToTitle(slug: string) {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
