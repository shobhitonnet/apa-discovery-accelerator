import { prisma } from "@/lib/db";

async function main() {
  const u = await prisma.upload.findFirst({
    where: { processId: "aece2f03-62d4-42b5-8b76-94b64c3d94f0", originalName: "kyc_verification_log.csv" },
    select: { rawData: true },
  });
  const rows = u?.rawData as any[];
  console.log("First 3 rows of KYC file:");
  for (const r of rows.slice(0, 3)) {
    console.log(JSON.stringify(r));
  }
  await prisma.$disconnect();
}
main();
