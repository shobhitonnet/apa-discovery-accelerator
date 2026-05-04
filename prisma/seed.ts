import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create a default admin user
  const passwordHash = await bcrypt.hash("discovery2026", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@backbase.com" },
    update: {},
    create: {
      email: "admin@backbase.com",
      name: "APA Admin",
      passwordHash,
      role: "admin",
    },
  });

  console.log(`Seeded user: ${user.email} (password: discovery2026)`);

  // Create a sample engagement
  const engagement = await prisma.engagement.upsert({
    where: { id: "sample-engagement-001" },
    update: {},
    create: {
      id: "sample-engagement-001",
      name: "Acme Bank — Mortgage Discovery",
      clientName: "Acme Bank",
      processTemplate: "mortgage",
      status: "created",
      createdById: user.id,
    },
  });

  console.log(`Seeded engagement: ${engagement.name}`);

  // ── Process Step Templates ──────────────────────────────────────────────────
  const steps = [
    // Mortgage
    { label: "Lead Capture", processTemplate: "mortgage", order: 1 },
    { label: "Application Submission", processTemplate: "mortgage", order: 2 },
    { label: "ID Verification", processTemplate: "mortgage", order: 3 },
    { label: "Credit Check", processTemplate: "mortgage", order: 4 },
    { label: "Document Collection", processTemplate: "mortgage", order: 5 },
    { label: "Property Valuation", processTemplate: "mortgage", order: 6 },
    { label: "Underwriting Review", processTemplate: "mortgage", order: 7 },
    { label: "Offer Generation", processTemplate: "mortgage", order: 8 },
    { label: "Offer Acceptance", processTemplate: "mortgage", order: 9 },
    { label: "Conveyancing", processTemplate: "mortgage", order: 10 },
    { label: "Completion", processTemplate: "mortgage", order: 11 },
    { label: "Funds Transfer", processTemplate: "mortgage", order: 12 },
    // SME Loan
    { label: "Enquiry", processTemplate: "sme_loan", order: 1 },
    { label: "Application", processTemplate: "sme_loan", order: 2 },
    { label: "KYB/KYC Check", processTemplate: "sme_loan", order: 3 },
    { label: "Credit Assessment", processTemplate: "sme_loan", order: 4 },
    { label: "Financial Spreading", processTemplate: "sme_loan", order: 5 },
    { label: "Document Collection", processTemplate: "sme_loan", order: 6 },
    { label: "Underwriting", processTemplate: "sme_loan", order: 7 },
    { label: "Approval", processTemplate: "sme_loan", order: 8 },
    { label: "Offer", processTemplate: "sme_loan", order: 9 },
    { label: "Acceptance", processTemplate: "sme_loan", order: 10 },
    { label: "Account Setup", processTemplate: "sme_loan", order: 11 },
    { label: "Disbursement", processTemplate: "sme_loan", order: 12 },
    // Dispute
    { label: "Dispute Raised", processTemplate: "dispute", order: 1 },
    { label: "Case Created", processTemplate: "dispute", order: 2 },
    { label: "Provisional Credit", processTemplate: "dispute", order: 3 },
    { label: "Investigation", processTemplate: "dispute", order: 4 },
    { label: "Merchant Contact", processTemplate: "dispute", order: 5 },
    { label: "Evidence Review", processTemplate: "dispute", order: 6 },
    { label: "Decision", processTemplate: "dispute", order: 7 },
    { label: "Final Settlement", processTemplate: "dispute", order: 8 },
    { label: "Case Closure", processTemplate: "dispute", order: 9 },
    // Onboarding
    { label: "Application Start", processTemplate: "onboarding", order: 1 },
    { label: "Personal Details", processTemplate: "onboarding", order: 2 },
    { label: "ID Verification", processTemplate: "onboarding", order: 3 },
    { label: "KYC/AML Screening", processTemplate: "onboarding", order: 4 },
    { label: "Account Opening", processTemplate: "onboarding", order: 5 },
    { label: "Card Issuance", processTemplate: "onboarding", order: 6 },
    { label: "Digital Enrollment", processTemplate: "onboarding", order: 7 },
    { label: "Welcome Pack", processTemplate: "onboarding", order: 8 },
    // Generic
    { label: "Document Request", processTemplate: "generic", order: 1 },
    { label: "Manual Review", processTemplate: "generic", order: 2 },
    { label: "Approval Gate", processTemplate: "generic", order: 3 },
    { label: "Data Entry", processTemplate: "generic", order: 4 },
    { label: "Notification Sent", processTemplate: "generic", order: 5 },
    { label: "Third-Party Check", processTemplate: "generic", order: 6 },
    { label: "Compliance Sign-off", processTemplate: "generic", order: 7 },
    { label: "System Update", processTemplate: "generic", order: 8 },
  ];

  for (const step of steps) {
    await prisma.processStepTemplate.upsert({
      where: { id: `step-${step.processTemplate}-${step.order}` },
      update: { label: step.label },
      create: { id: `step-${step.processTemplate}-${step.order}`, ...step },
    });
  }
  console.log(`Seeded ${steps.length} process step templates`);

  // ── Application Systems ────────────────────────────────────────────────────
  const systems = [
    // Process-specific
    { id: "sys-los", name: "LOS", color: "#26BC71", description: "Loan Origination System", processTemplates: ["mortgage", "sme_loan"] },
    { id: "sys-valuation", name: "Valuation", color: "#F97316", description: "Property Valuation (Hometrack/RICS)", processTemplates: ["mortgage"] },
    { id: "sys-conveyancing", name: "Conveyancing", color: "#8B2BE2", description: "Conveyancing Tracker", processTemplates: ["mortgage"] },
    { id: "sys-esign", name: "E-Sign", color: "#06B6D4", description: "DocuSign / Adobe Sign", processTemplates: ["mortgage", "sme_loan"] },
    { id: "sys-financial-spreading", name: "Financial Spreading", color: "#FFAC09", description: "Financial Analysis Tool", processTemplates: ["sme_loan"] },
    { id: "sys-card-processor", name: "Card Processor", color: "#6366F1", description: "Visa / Mastercard Network", processTemplates: ["dispute", "onboarding"] },
    { id: "sys-case-mgmt", name: "Case Management", color: "#F59E0B", description: "ServiceNow / Jira", processTemplates: ["dispute"] },
    { id: "sys-card-issuing", name: "Card Issuing", color: "#EC4899", description: "Card Production System", processTemplates: ["onboarding"] },
    { id: "sys-digital-banking", name: "Digital Banking", color: "#3366FF", description: "Mobile / Online Banking Platform", processTemplates: ["onboarding"] },
    // Generic (available for all)
    { id: "sys-crm", name: "CRM", color: "#3366FF", description: "Salesforce / Dynamics", processTemplates: ["*"] },
    { id: "sys-core-banking", name: "Core Banking", color: "#F97316", description: "Temenos / Finastra / Finacle", processTemplates: ["*"] },
    { id: "sys-doc-mgmt", name: "Doc Management", color: "#8B2BE2", description: "OnBase / SharePoint / OpenText", processTemplates: ["*"] },
    { id: "sys-kyc-aml", name: "KYC / AML", color: "#EF4444", description: "Identity & Screening Platform", processTemplates: ["*"] },
    { id: "sys-credit-bureau", name: "Credit Bureau", color: "#06B6D4", description: "Experian / Equifax / TransUnion", processTemplates: ["*"] },
    { id: "sys-decision-engine", name: "Decision Engine", color: "#FFAC09", description: "Rules / AI Decisioning Engine", processTemplates: ["*"] },
    { id: "sys-payments", name: "Payments", color: "#10B981", description: "Payment Processing System", processTemplates: ["*"] },
    { id: "sys-risk", name: "Risk System", color: "#BE123C", description: "Risk & Fraud Platform", processTemplates: ["*"] },
    { id: "sys-email-workflow", name: "Email / Workflow", color: "#64748B", description: "Comms & Workflow Automation", processTemplates: ["*"] },
    { id: "sys-manual", name: "Manual / Spreadsheet", color: "#9CA3AF", description: "No system — manual work", processTemplates: ["*"] },
  ];

  for (const sys of systems) {
    await prisma.applicationSystem.upsert({
      where: { id: sys.id },
      update: { name: sys.name, color: sys.color, description: sys.description, processTemplates: sys.processTemplates },
      create: sys,
    });
  }
  console.log(`Seeded ${systems.length} application systems`);

  // ── Process Actors ─────────────────────────────────────────────────────────
  const actors = [
    { id: "actor-customer", name: "Customer", color: "#3366FF", description: "End customer / applicant", type: "customer" },
    { id: "actor-call-centre", name: "Call Centre Agent", color: "#26BC71", description: "Front-line phone / chat agent", type: "front-office" },
    { id: "actor-relationship-mgr", name: "Relationship Manager", color: "#8B2BE2", description: "Dedicated client RM", type: "front-office" },
    { id: "actor-back-office", name: "Back Office", color: "#FFAC09", description: "Processing & operations team", type: "back-office" },
    { id: "actor-underwriter", name: "Underwriter", color: "#F97316", description: "Credit / risk underwriter", type: "back-office" },
    { id: "actor-fraud-team", name: "Fraud Team", color: "#EF4444", description: "Fraud investigation & prevention", type: "fraud" },
    { id: "actor-compliance", name: "Compliance Officer", color: "#06B6D4", description: "Regulatory & AML compliance", type: "compliance" },
    { id: "actor-automated", name: "Automated System", color: "#64748B", description: "No human touch — fully automated", type: "automated" },
  ];

  for (const actor of actors) {
    await prisma.processActor.upsert({
      where: { id: actor.id },
      update: { name: actor.name, color: actor.color, description: actor.description, type: actor.type },
      create: actor,
    });
  }
  console.log(`Seeded ${actors.length} process actors`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
