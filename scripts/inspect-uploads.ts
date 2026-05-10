import { prisma } from "@/lib/db";

async function main() {
  const uploads = await prisma.upload.findMany({
    where: { processId: "aece2f03-62d4-42b5-8b76-94b64c3d94f0" },
    select: {
      id: true, originalName: true, dataRequestFileName: true,
      caseIdColumn: true, timestampColumn: true, activityColumn: true, activityFallback: true,
      rawData: true,
    },
    orderBy: { createdAt: "desc" },
  });

  for (const u of uploads) {
    console.log(`-- ${u.originalName} (slot: ${u.dataRequestFileName}) --`);
    console.log(`  activity:  ${u.activityFallback}  (col: ${u.activityColumn})`);
    console.log(`  caseIdCol: ${u.caseIdColumn}`);
    console.log(`  tsCol:     ${u.timestampColumn}`);
    const rows = u.rawData as any[];
    if (rows && rows.length > 0) {
      const headers = Object.keys(rows[0]);
      console.log(`  headers:   ${headers.join(", ")}`);
      const sampleTs = rows.slice(0, 3).map(r => r[u.timestampColumn!] ?? "(null)");
      console.log(`  ts samples: ${JSON.stringify(sampleTs)}`);
    }
    console.log("");
  }
  await prisma.$disconnect();
}
main();
