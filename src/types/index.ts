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

// ─── Domain Matrix Catalog ───────────────────────────────────────────────────

export type LineOfBusiness = "retail" | "sme" | "commercial" | "wealth";

export interface LobProcess {
  key: string;
  name: string;
  description: string;
  active: boolean;
}

export interface LobDefinition {
  label: string;
  color: string;
  bg: string;
  processes: LobProcess[];
}

// active: true = fully built, selectable. false = visible but greyed out (coming soon).
export const LOB_CATALOG: Record<LineOfBusiness, LobDefinition> = {
  retail: {
    label: "Retail Banking",
    color: "#1A5AFF",
    bg: "rgba(26,90,255,0.08)",
    processes: [
      { key: "retail_mortgage",        name: "Home Mortgage Origination",    description: "End-to-end mortgage from application to completion",            active: false },
      { key: "retail_onboarding",      name: "Customer Onboarding & KYC",    description: "New-to-bank onboarding including identity and AML checks",      active: true  },
      { key: "retail_dispute",         name: "Transaction Dispute",          description: "Card or payment dispute from raise to resolution",              active: false },
      { key: "retail_personal_loan",   name: "Personal Loan",                description: "Unsecured personal lending origination and disbursement",       active: true  },
      { key: "retail_account_opening", name: "Account Opening",              description: "Current or savings account opening for new/existing customers", active: false },
      { key: "retail_cards",           name: "Credit Card Origination",      description: "Card application, underwriting, issuance and activation",       active: false },
      { key: "retail_collections",     name: "Collections & Recoveries",     description: "Early arrears through to debt recovery workflows",              active: false },
      { key: "retail_payments",        name: "Payments & Transfers",         description: "Domestic and international payment origination and processing",  active: false },
    ],
  },
  sme: {
    label: "SME Banking",
    color: "#06B6D4",
    bg: "rgba(6,182,212,0.08)",
    processes: [
      { key: "sme_loan",               name: "SME Business Loan",            description: "Business lending from enquiry to disbursement",                 active: false },
      { key: "sme_account_opening",    name: "Business Account Opening",     description: "KYB, account setup and product activation for SMEs",            active: false },
      { key: "sme_trade_finance",      name: "Trade Finance",                description: "Letters of credit, guarantees and trade payment instruments",   active: false },
      { key: "sme_cash_management",    name: "Cash Management & Liquidity",  description: "Sweeping, pooling, and working capital optimisation",           active: false },
      { key: "sme_invoice_financing",  name: "Invoice Financing",            description: "Invoice discounting and factoring workflows",                   active: false },
      { key: "sme_merchant",           name: "Merchant Acquiring",           description: "Merchant onboarding, terminal provisioning and settlement",     active: false },
    ],
  },
  commercial: {
    label: "Commercial Banking",
    color: "#FFAC09",
    bg: "rgba(255,172,9,0.08)",
    processes: [
      { key: "commercial_lending",     name: "Commercial Lending",           description: "Large-ticket lending from origination to covenant monitoring",  active: false },
      { key: "commercial_syndicated",  name: "Syndicated Loans",             description: "Multi-bank facility arrangement and agency management",         active: false },
      { key: "commercial_treasury",    name: "Treasury & FX",                description: "FX, derivatives and liquidity management operations",           active: false },
      { key: "commercial_trade",       name: "Trade Finance & LC",           description: "Documentary credits and structured trade instruments",          active: false },
      { key: "commercial_cash",        name: "Corporate Cash Management",    description: "Notional pooling, sweeps and multi-entity liquidity",           active: false },
      { key: "commercial_onboarding",  name: "Corporate Onboarding",         description: "Full KYB/AML due diligence for corporate clients",             active: false },
    ],
  },
  wealth: {
    label: "Wealth Management",
    color: "#2ECC71",
    bg: "rgba(46,204,113,0.08)",
    processes: [
      { key: "wealth_onboarding",      name: "Client Onboarding & KYC",      description: "Suitability assessment, KYC and account opening for HNW clients", active: false },
      { key: "wealth_portfolio",       name: "Portfolio Management",          description: "Model portfolio construction, rebalancing and reporting",          active: false },
      { key: "wealth_acat",            name: "Asset Transfer (ACAT)",         description: "In-kind and cash transfer of assets between custodians",           active: false },
      { key: "wealth_third_party",     name: "3rd Party Account Access",      description: "Setting up and managing delegated access to client accounts",      active: false },
      { key: "wealth_financial_plan",  name: "Financial Planning",            description: "Goals-based planning, scenario modelling and advice delivery",     active: false },
      { key: "wealth_estate",          name: "Estate & Trust Administration", description: "Trust setup, estate execution and beneficiary management",         active: false },
    ],
  },
};

export const ALL_LOBS: LineOfBusiness[] = ["retail", "sme", "commercial", "wealth"];

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
