"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const COUNTRIES: { name: string; code: string; region: string }[] = [
  { name: "United Kingdom", code: "GB", region: "Europe" },
  { name: "Germany", code: "DE", region: "Europe" },
  { name: "Netherlands", code: "NL", region: "Europe" },
  { name: "Belgium", code: "BE", region: "Europe" },
  { name: "France", code: "FR", region: "Europe" },
  { name: "Spain", code: "ES", region: "Europe" },
  { name: "Italy", code: "IT", region: "Europe" },
  { name: "Sweden", code: "SE", region: "Europe" },
  { name: "Denmark", code: "DK", region: "Europe" },
  { name: "Norway", code: "NO", region: "Europe" },
  { name: "Finland", code: "FI", region: "Europe" },
  { name: "Switzerland", code: "CH", region: "Europe" },
  { name: "Austria", code: "AT", region: "Europe" },
  { name: "Poland", code: "PL", region: "Europe" },
  { name: "Portugal", code: "PT", region: "Europe" },
  { name: "Ireland", code: "IE", region: "Europe" },
  { name: "Czech Republic", code: "CZ", region: "Europe" },
  { name: "Romania", code: "RO", region: "Europe" },
  { name: "Hungary", code: "HU", region: "Europe" },
  { name: "Greece", code: "GR", region: "Europe" },
  { name: "United Arab Emirates", code: "AE", region: "Middle East" },
  { name: "Saudi Arabia", code: "SA", region: "Middle East" },
  { name: "Kuwait", code: "KW", region: "Middle East" },
  { name: "Bahrain", code: "BH", region: "Middle East" },
  { name: "Qatar", code: "QA", region: "Middle East" },
  { name: "Oman", code: "OM", region: "Middle East" },
  { name: "Jordan", code: "JO", region: "Middle East" },
  { name: "Egypt", code: "EG", region: "Middle East" },
  { name: "Turkey", code: "TR", region: "Middle East" },
  { name: "South Africa", code: "ZA", region: "Africa" },
  { name: "Nigeria", code: "NG", region: "Africa" },
  { name: "Kenya", code: "KE", region: "Africa" },
  { name: "Ghana", code: "GH", region: "Africa" },
  { name: "Morocco", code: "MA", region: "Africa" },
  { name: "Tanzania", code: "TZ", region: "Africa" },
  { name: "Ethiopia", code: "ET", region: "Africa" },
  { name: "United States", code: "US", region: "North America" },
  { name: "Canada", code: "CA", region: "North America" },
  { name: "Mexico", code: "MX", region: "North America" },
  { name: "Brazil", code: "BR", region: "Latin America" },
  { name: "Colombia", code: "CO", region: "Latin America" },
  { name: "Chile", code: "CL", region: "Latin America" },
  { name: "Argentina", code: "AR", region: "Latin America" },
  { name: "Peru", code: "PE", region: "Latin America" },
  { name: "Uruguay", code: "UY", region: "Latin America" },
  { name: "Australia", code: "AU", region: "Asia Pacific" },
  { name: "Singapore", code: "SG", region: "Asia Pacific" },
  { name: "India", code: "IN", region: "Asia Pacific" },
  { name: "Japan", code: "JP", region: "Asia Pacific" },
  { name: "South Korea", code: "KR", region: "Asia Pacific" },
  { name: "Malaysia", code: "MY", region: "Asia Pacific" },
  { name: "Indonesia", code: "ID", region: "Asia Pacific" },
  { name: "Thailand", code: "TH", region: "Asia Pacific" },
  { name: "Philippines", code: "PH", region: "Asia Pacific" },
  { name: "Vietnam", code: "VN", region: "Asia Pacific" },
  { name: "New Zealand", code: "NZ", region: "Asia Pacific" },
  { name: "Hong Kong", code: "HK", region: "Asia Pacific" },
];

const REGION_COLORS: Record<string, { bg: string; text: string }> = {
  "Europe":        { bg: "rgba(26,90,255,0.1)",  text: "#1A5AFF" },
  "Middle East":   { bg: "rgba(255,172,9,0.12)", text: "#B07800" },
  "Africa":        { bg: "rgba(46,204,113,0.1)", text: "#1A8F4F" },
  "North America": { bg: "rgba(6,182,212,0.1)",  text: "#0891B2" },
  "Latin America": { bg: "rgba(168,85,247,0.1)", text: "#7C3AED" },
  "Asia Pacific":  { bg: "rgba(239,68,68,0.1)",  text: "#DC2626" },
};

const INSTITUTION_TYPES = [
  { id: "bank",             label: "Commercial Bank" },
  { id: "credit_union",     label: "Credit Union" },
  { id: "neobank",          label: "Neobank" },
  { id: "insurance",        label: "Insurance" },
  { id: "building_society", label: "Building Society" },
  { id: "cooperative",      label: "Cooperative Bank" },
  { id: "fintech",          label: "Fintech / Payments" },
];

const AUM_RANGES      = ["Under $1B", "$1B – $10B", "$10B – $50B", "$50B – $100B", "$100B – $500B", "$500B+"];
const EMPLOYEE_RANGES = ["Under 500", "500 – 2,000", "2,000 – 10,000", "10,000 – 50,000", "50,000+"];
const CUSTOMER_RANGES = ["Under 100K", "100K – 1M", "1M – 5M", "5M – 20M", "20M+"];

const inputStyle = {
  width: "100%", borderRadius: 8, border: "1px solid #DDE3EC", background: "#fff",
  padding: "8px 12px", fontSize: 13, color: "#001C3D", outline: "none",
  boxSizing: "border-box" as const,
};

const selectStyle = {
  ...inputStyle,
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235C6E84' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: 36,
  cursor: "pointer",
};

interface Props {
  engagementId: string;
  initial: {
    name: string;
    clientName: string;
    country?: string | null;
    region?: string | null;
    institutionType?: string | null;
    aum?: string | null;
    employees?: string | null;
    customers?: string | null;
  };
}

export function EditEngagementProfile({ engagementId, initial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state — initialised from saved data
  const [name, setName] = useState(initial.name);
  const [clientName, setClientName] = useState(initial.clientName);
  const [institutionType, setInstitutionType] = useState(initial.institutionType ?? "");
  const [aum, setAum] = useState(initial.aum ?? "");
  const [employees, setEmployees] = useState(initial.employees ?? "");
  const [customers, setCustomers] = useState(initial.customers ?? "");
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Resolve country code from saved country name
  const [countryCode, setCountryCode] = useState(
    () => COUNTRIES.find((c) => c.name === initial.country)?.code ?? ""
  );

  const selectedCountry = useMemo(() => COUNTRIES.find((c) => c.code === countryCode), [countryCode]);
  const region = selectedCountry?.region ?? "";
  const regionColor = region ? REGION_COLORS[region] : null;

  const filteredCountries = useMemo(
    () => COUNTRIES.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase())),
    [countrySearch]
  );

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/engagements/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientName,
          country: selectedCountry?.name ?? null,
          region: region || null,
          institutionType: institutionType || null,
          aum: aum || null,
          employees: employees || null,
          customers: customers || null,
        }),
      });
      setSaved(true);
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20, cursor: "pointer",
          background: open ? "rgba(26,90,255,0.08)" : "#F5F7F9",
          color: open ? "#1A5AFF" : "#5C6E84",
          border: `1px solid ${open ? "rgba(26,90,255,0.2)" : "#DDE3EC"}`,
        }}
      >
        {saved ? "✓ Saved" : open ? "Cancel" : "Edit Profile"}
      </button>

      {open && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5C6E84", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Engagement Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5C6E84", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Client Name</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Country picker */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5C6E84", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Country</label>
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setCountryOpen((v) => !v)}
                style={{ ...inputStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}
              >
                <span style={{ color: selectedCountry ? "#001C3D" : "#5C6E84" }}>
                  {selectedCountry?.name ?? "Select country…"}
                </span>
                {regionColor && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: regionColor.bg, color: regionColor.text, marginLeft: 8, flexShrink: 0 }}>
                    {region}
                  </span>
                )}
              </div>
              {countryOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #DDE3EC", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,28,61,0.12)", zIndex: 50, overflow: "hidden" }}>
                  <div style={{ padding: "8px 10px", borderBottom: "1px solid #EEF2F8" }}>
                    <input
                      autoFocus
                      type="text" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country…"
                      style={{ ...inputStyle, padding: "6px 10px", fontSize: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {filteredCountries.map((c) => {
                      const rc = REGION_COLORS[c.region];
                      return (
                        <div
                          key={c.code}
                          onClick={() => { setCountryCode(c.code); setCountryOpen(false); setCountrySearch(""); }}
                          style={{ padding: "9px 14px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: countryCode === c.code ? "rgba(26,90,255,0.05)" : undefined, color: "#001C3D" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F7F9"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = countryCode === c.code ? "rgba(26,90,255,0.05)" : "transparent"; }}
                        >
                          {c.name}
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20, background: rc.bg, color: rc.text }}>{c.region}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Institution type */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5C6E84", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type of Institution</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {INSTITUTION_TYPES.map((t) => (
                <button
                  key={t.id} type="button"
                  onClick={() => setInstitutionType(institutionType === t.id ? "" : t.id)}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 30, cursor: "pointer",
                    background: institutionType === t.id ? "#1A5AFF" : "#F5F7F9",
                    color: institutionType === t.id ? "#fff" : "#374D6C",
                    border: institutionType === t.id ? "1px solid #1A5AFF" : "1px solid #DDE3EC",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scale fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5C6E84", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>AUM</label>
              <select value={aum} onChange={(e) => setAum(e.target.value)} style={selectStyle}>
                <option value="">Select range…</option>
                {AUM_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5C6E84", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Employees</label>
              <select value={employees} onChange={(e) => setEmployees(e.target.value)} style={selectStyle}>
                <option value="">Select range…</option>
                {EMPLOYEE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#5C6E84", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Customers</label>
              <select value={customers} onChange={(e) => setCustomers(e.target.value)} style={selectStyle}>
                <option value="">Select range…</option>
                {CUSTOMER_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Save button */}
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
            <button
              onClick={handleSave}
              disabled={saving || !name || !clientName}
              style={{
                fontSize: 13, fontWeight: 700, padding: "9px 24px", borderRadius: 30, cursor: saving ? "wait" : "pointer",
                background: saving ? "#DDE3EC" : "#1A5AFF",
                color: saving ? "#5C6E84" : "#fff",
                border: "none",
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
