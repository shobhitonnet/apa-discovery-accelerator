import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropic } from "@/lib/anthropic";
import type { SchemaInferenceResult } from "@/types";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { csvHeaders, sampleRows, fileName, processTemplate } = body;

  if (!csvHeaders || !sampleRows) {
    return NextResponse.json(
      { error: "csvHeaders and sampleRows are required" },
      { status: 400 }
    );
  }

  const sampleData = [csvHeaders.join(",")]
    .concat(sampleRows.slice(0, 10).map((row: string[]) => row.join(",")))
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a banking process mining expert. Analyze this CSV data from a banking operational system and infer the schema.

File name: ${fileName || "unknown"}
Process context: ${processTemplate || "general banking process"}

CSV sample (headers + first 10 rows):
\`\`\`
${sampleData}
\`\`\`

For each column, determine its role in process mining:
- case_id: The identifier that groups events into a single process instance (e.g., application ID, case reference)
- activity: The step/action name in the process (e.g., "Application Submitted", "Credit Check")
- timestamp: When the event occurred
- actor: Who performed the action (person, team, or system)
- system_ref: A reference ID from another system (useful for cross-system correlation)
- attribute: Additional data about the event (amounts, statuses, etc.)
- unknown: Cannot determine the role

Also identify which banking system this data likely comes from (CRM, LOS, Core Banking, etc.).

Respond in this exact JSON format:
{
  "columns": [
    {
      "name": "column_name",
      "inferredRole": "case_id|activity|timestamp|actor|attribute|system_ref|unknown",
      "confidence": 0.0-1.0,
      "reasoning": "Why this classification",
      "sampleValues": ["val1", "val2", "val3"]
    }
  ],
  "detectedSystem": "System name or null",
  "overallConfidence": 0.0-1.0,
  "notes": "Any observations about data quality, missing fields, or correlation opportunities"
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected response from AI" },
      { status: 500 }
    );
  }

  // Extract JSON from the response (handle markdown code blocks)
  let jsonText = content.text;
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  const result: SchemaInferenceResult = JSON.parse(jsonText.trim());
  return NextResponse.json(result);
}
