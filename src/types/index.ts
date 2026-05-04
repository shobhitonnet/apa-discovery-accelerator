export type ProcessTemplate =
  | "mortgage"
  | "sme_loan"
  | "dispute"
  | "onboarding";

export interface ProcessTemplateConfig {
  id: ProcessTemplate;
  name: string;
  description: string;
  expectedSystems: string[];
  happyPath: string[];
  darkProcessZones: string[];
  correlationHints: string[];
}

export const PROCESS_TEMPLATES: ProcessTemplateConfig[] = [
  {
    id: "mortgage",
    name: "Home Mortgage Origination",
    description:
      "End-to-end mortgage journey from application to completion, spanning 10-12 systems",
    expectedSystems: [
      "CRM",
      "LOS",
      "ID Verification",
      "Credit Bureau",
      "Document Management",
      "Valuation",
      "Decision Engine",
      "E-Sign",
      "Conveyancing",
      "Core Banking",
      "Payments",
      "Land Registry",
    ],
    happyPath: [
      "Lead Capture",
      "Application Submission",
      "ID Verification",
      "Credit Check",
      "Document Collection",
      "Property Valuation",
      "Underwriting Decision",
      "Offer Generation",
      "Offer Acceptance",
      "Conveyancing",
      "Completion",
      "Funds Transfer",
      "Registration",
    ],
    darkProcessZones: [
      "Between Application and ID Verification",
      "Between Credit Check and Document Collection",
      "Between Valuation and Underwriting",
      "Between Offer and Conveyancing",
    ],
    correlationHints: [
      "customer_id",
      "application_ref",
      "property_address",
      "applicant_name",
      "loan_amount",
    ],
  },
  {
    id: "sme_loan",
    name: "SME Loan Origination",
    description:
      "Business lending from enquiry to disbursement, including financial analysis and covenant setup",
    expectedSystems: [
      "CRM",
      "LOS",
      "Credit Bureau",
      "Financial Spreading",
      "Document Management",
      "Decision Engine",
      "Core Banking",
      "Payments",
    ],
    happyPath: [
      "Enquiry",
      "Application",
      "KYB/KYC Check",
      "Credit Assessment",
      "Financial Spreading",
      "Document Collection",
      "Underwriting",
      "Approval",
      "Offer",
      "Acceptance",
      "Account Setup",
      "Disbursement",
    ],
    darkProcessZones: [
      "Between Enquiry and Application",
      "Between Financial Spreading and Underwriting",
      "Between Approval and Offer Generation",
    ],
    correlationHints: [
      "company_registration",
      "application_id",
      "borrower_name",
      "facility_amount",
    ],
  },
  {
    id: "dispute",
    name: "Transaction Dispute Management",
    description:
      "Card or payment dispute from customer notification through investigation to resolution",
    expectedSystems: [
      "Contact Center",
      "Case Management",
      "Core Banking",
      "Card Processor",
      "Fraud Detection",
      "Document Management",
      "Payments",
    ],
    happyPath: [
      "Dispute Raised",
      "Case Created",
      "Provisional Credit",
      "Investigation",
      "Merchant Contact",
      "Evidence Review",
      "Decision",
      "Final Settlement",
      "Case Closure",
    ],
    darkProcessZones: [
      "Between Dispute Raised and Case Creation",
      "Between Investigation and Merchant Response",
    ],
    correlationHints: [
      "transaction_id",
      "card_number_last4",
      "case_ref",
      "customer_id",
    ],
  },
  {
    id: "onboarding",
    name: "Customer Onboarding",
    description:
      "New-to-bank customer onboarding including KYC, account opening, and product activation",
    expectedSystems: [
      "CRM",
      "ID Verification",
      "KYC/AML",
      "Core Banking",
      "Card Issuing",
      "Digital Banking",
      "Document Management",
    ],
    happyPath: [
      "Application Start",
      "Personal Details",
      "ID Verification",
      "KYC/AML Screening",
      "Account Opening",
      "Card Issuance",
      "Digital Enrollment",
      "Welcome Pack",
      "First Transaction",
    ],
    darkProcessZones: [
      "Between KYC Screening and Account Opening",
      "Between Card Issuance and Digital Enrollment",
    ],
    correlationHints: [
      "customer_id",
      "application_ref",
      "national_id",
      "email",
    ],
  },
];

export interface SchemaInferenceResult {
  columns: {
    name: string;
    inferredRole:
      | "case_id"
      | "activity"
      | "timestamp"
      | "actor"
      | "attribute"
      | "system_ref"
      | "unknown";
    confidence: number;
    reasoning: string;
    sampleValues: string[];
  }[];
  detectedSystem: string | null;
  overallConfidence: number;
  notes: string;
}
