import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";

export interface GeneratedProcess {
  steps: { label: string; order: number; description: string }[];
  actors: { name: string; color: string; description: string; type: string }[];
  systems: { name: string; color: string; description: string; processTemplates: string[] }[];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { processName, processTemplate, save } = await request.json();
  if (!processName || !processTemplate) {
    return NextResponse.json({ error: "processName and processTemplate are required" }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a banking operations and process mining expert with deep knowledge of international banking standards (BPMN 2.0, ISO 20022, Basel III/IV, SWIFT, PSD2) and leading banking platforms (Temenos, Finastra, Finacle, Backbase, Salesforce Financial Services Cloud, nCino, FIS, Fiserv).

Generate a comprehensive reference process definition for: **${processName}**
Process template key: ${processTemplate}

Research this process as it is standardly practiced in retail and commercial banking, including:
- Industry-standard process steps in the correct sequence
- All human actors and their roles
- All technology systems typically involved
- BPMN best practices for this process type

Return ONLY valid JSON in exactly this structure (no markdown, no explanation):
{
  "steps": [
    {
      "label": "Step name (concise, verb-noun format e.g. 'Verify Identity')",
      "order": 1,
      "description": "What happens in this step, who does it, what system is involved"
    }
  ],
  "actors": [
    {
      "name": "Actor name",
      "color": "#hexcolor",
      "description": "Role description in this process",
      "type": "customer|front-office|back-office|operations|fraud|compliance|external|automated"
    }
  ],
  "systems": [
    {
      "name": "System name",
      "color": "#hexcolor",
      "description": "System purpose and common vendors (e.g. Temenos T24, Finastra Fusion)",
      "processTemplates": ["${processTemplate}"]
    }
  ]
}

Guidelines:
- Steps: 8-15 steps covering the full end-to-end journey including exceptions where relevant
- Actors: all human roles + automated system actors that touch this process
- Systems: all technology systems — core banking, middleware, specialist tools
- Colors: use distinct, professional hex colors per actor/system category:
  - Customer-facing: #3366FF blues
  - Front office: #26BC71 greens
  - Back office: #FFAC09 ambers
  - Risk/Fraud/Compliance: #EF4444 reds or #06B6D4 cyans
  - Automated/system: #64748B greys
  - Core systems: #F97316 oranges
  - Specialist tools: #8B2BE2 purples
- Be specific to ${processName} — not generic banking steps`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 });
  }

  let jsonText = content.text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonText = jsonMatch[1].trim();

  const generated: GeneratedProcess = JSON.parse(jsonText);

  // If save=true, persist directly to the database
  if (save) {
    await Promise.all([
      ...generated.steps.map((s) =>
        prisma.processStepTemplate.create({
          data: {
            label: s.label,
            processTemplate,
            order: s.order,
            description: s.description,
          },
        })
      ),
      ...generated.actors.map((a) =>
        prisma.processActor.create({
          data: { name: a.name, color: a.color, description: a.description, type: a.type },
        })
      ),
      ...generated.systems.map((s) =>
        prisma.applicationSystem.create({
          data: { name: s.name, color: s.color, description: s.description, processTemplates: s.processTemplates },
        })
      ),
    ]);
    return NextResponse.json({ saved: true, generated });
  }

  return NextResponse.json({ saved: false, generated });
}
