import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { anthropic } from "@/lib/anthropic";

interface SchemaColumn {
  name: string;
  inferredRole: string;
  confidence: number;
}

interface SchemaInference {
  columns: SchemaColumn[];
  detectedSystem: string | null;
}

interface CorrelationMap {
  systems: Record<string, {
    caseIdColumn: string;
    activityColumn: string;
    timestampColumn: string;
    actorColumn: string | null;
    crossRefs: Array<{
      localColumn: string;
      targetSystem: string;
      targetColumn: string;
    }>;
  }>;
  spineSystem: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: engagementId } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    include: { uploads: true },
  });

  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  const uploads = engagement.uploads.filter(
    (u) => u.rawData && u.schemaInference
  );

  if (uploads.length === 0) {
    return NextResponse.json(
      { error: "No uploads with raw data found. Please re-upload your CSV files." },
      { status: 400 }
    );
  }

  await prisma.eventLog.deleteMany({ where: { engagementId } });

  // Step 1: Ask Claude for the correlation strategy only (schema + 3 sample rows)
  const systemSummaries = uploads.map((u) => {
    const schema = u.schemaInference as unknown as SchemaInference;
    const rows = u.rawData as Record<string, string>[];
    return {
      system: u.systemSource ?? u.originalName,
      columns: schema.columns.map((c) => ({
        name: c.name,
        role: c.inferredRole,
        confidence: c.confidence,
      })),
      sampleRows: rows.slice(0, 3),
    };
  });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a banking process mining expert. I have CSV exports from ${uploads.length} systems for a ${engagement.processTemplate} banking process.

For each system I'll give you the schema and 3 sample rows. Return a correlation map so I can join the data in code.

SYSTEMS:
${JSON.stringify(systemSummaries, null, 2)}

Return ONLY valid JSON, no markdown:
{
  "systems": {
    "<systemName>": {
      "caseIdColumn": "column name that is the case ID for this system",
      "activityColumn": "column name containing the activity/step name",
      "timestampColumn": "column name containing the event timestamp",
      "actorColumn": "column name for who performed the action, or null",
      "crossRefs": [
        {
          "localColumn": "column in this system that references another system",
          "targetSystem": "exact system name as given above",
          "targetColumn": "column in that system it maps to"
        }
      ]
    }
  },
  "spineSystem": "system name whose caseId should be used as the unified case ID"
}`,
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

  const correlationMap: CorrelationMap = JSON.parse(jsonText);

  // Step 2: Execute the join in JavaScript
  // Build a lookup: for each non-spine system, map its case ID -> spine case ID
  const spineSystem = correlationMap.spineSystem;
  const spineUpload = uploads.find(
    (u) => (u.systemSource ?? u.originalName) === spineSystem
  ) ?? uploads[0];
  const spineSystemName = spineUpload.systemSource ?? spineUpload.originalName;
  const spineConfig = correlationMap.systems[spineSystemName];

  // Build reverse lookup tables: foreignKey -> spineId
  const lookups: Record<string, Record<string, string>> = {};

  if (spineConfig) {
    const spineRows = spineUpload.rawData as Record<string, string>[];
    for (const row of spineRows) {
      const spineId = row[spineConfig.caseIdColumn];
      if (!spineId) continue;
      // Index the spine by its own case ID
      if (!lookups[spineSystemName]) lookups[spineSystemName] = {};
      lookups[spineSystemName][spineId] = spineId;
    }

    // For each other system, find what cross-ref points back to the spine
    for (const upload of uploads) {
      const sysName = upload.systemSource ?? upload.originalName;
      if (sysName === spineSystemName) continue;
      const sysConfig = correlationMap.systems[sysName];
      if (!sysConfig) continue;

      const crossRef = sysConfig.crossRefs?.find(
        (r) => r.targetSystem === spineSystemName
      );
      if (!crossRef) continue;

      const sysRows = upload.rawData as Record<string, string>[];
      if (!lookups[sysName]) lookups[sysName] = {};
      for (const row of sysRows) {
        const foreignKey = row[crossRef.localColumn];
        const localId = row[sysConfig.caseIdColumn];
        if (foreignKey && localId) {
          lookups[sysName][localId] = foreignKey;
        }
      }
    }
  }

  // Step 3: Build unified event log from all rows
  const events: Array<{
    caseId: string;
    activity: string;
    timestamp: Date;
    system: string;
    actor: string | null;
    confidence: number;
    engagementId: string;
  }> = [];

  for (const upload of uploads) {
    const sysName = upload.systemSource ?? upload.originalName;
    const sysConfig = correlationMap.systems[sysName];
    if (!sysConfig) continue;

    const rows = upload.rawData as Record<string, string>[];
    const lookup = lookups[sysName] ?? {};

    for (const row of rows) {
      const localId = row[sysConfig.caseIdColumn];
      if (!localId) continue;

      const rawActivity = row[sysConfig.activityColumn];
      const rawTimestamp = row[sysConfig.timestampColumn];
      if (!rawActivity || !rawTimestamp) continue;

      const parsedDate = new Date(rawTimestamp);
      if (isNaN(parsedDate.getTime())) continue;

      // Resolve to spine case ID
      const caseId =
        sysName === spineSystemName
          ? localId
          : (lookup[localId] ?? localId);

      events.push({
        caseId,
        activity: rawActivity,
        timestamp: parsedDate,
        system: sysName,
        actor: sysConfig.actorColumn ? (row[sysConfig.actorColumn] ?? null) : null,
        confidence: 1.0,
        engagementId,
      });
    }
  }

  if (events.length === 0) {
    return NextResponse.json(
      { error: "No events could be extracted. Check that your CSV files have activity and timestamp columns." },
      { status: 400 }
    );
  }

  await prisma.eventLog.createMany({ data: events });

  await prisma.engagement.update({
    where: { id: engagementId },
    data: { status: "analyzing" },
  });

  const caseIds = [...new Set(events.map((e) => e.caseId))];

  return NextResponse.json({
    success: true,
    correlationStrategy: correlationMap,
    stats: {
      systemsCorrelated: uploads.length,
      casesFound: caseIds.length,
      eventsCreated: events.length,
    },
  });
}
