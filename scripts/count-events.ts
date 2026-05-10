import { prisma } from "@/lib/db";

async function main() {
  // Find a case with KYC
  const kycCase = await prisma.$queryRaw<Array<{ caseId: string }>>`
    SELECT DISTINCT "caseId" FROM "EventLog"
    WHERE "activity" = 'KYC & Identity Verification'
    LIMIT 5
  `;
  for (const { caseId } of kycCase) {
    console.log(`\n----- Case ${caseId} -----`);
    const events = await prisma.$queryRaw<Array<{ activity: string; timestamp: Date }>>`
      SELECT "activity", "timestamp" FROM "EventLog"
      WHERE "caseId" = ${caseId}
      ORDER BY "timestamp" ASC
    `;
    for (const e of events) console.log(`  ${e.timestamp.toISOString()}  ${e.activity}`);
  }

  // Count distinct cases per "first" activity
  console.log("\n\nFirst activity per case (top 10):");
  const firstActivities = await prisma.$queryRaw<Array<{ activity: string; n: bigint }>>`
    SELECT first_activity AS activity, COUNT(*) AS n FROM (
      SELECT "caseId", (
        SELECT "activity" FROM "EventLog" e2
        WHERE e2."caseId" = e1."caseId"
        ORDER BY "timestamp" ASC LIMIT 1
      ) AS first_activity
      FROM "EventLog" e1
      GROUP BY "caseId"
    ) t
    GROUP BY first_activity ORDER BY n DESC LIMIT 10
  `;
  for (const r of firstActivities) console.log(`  ${r.activity}: ${r.n}`);

  await prisma.$disconnect();
}
main();
