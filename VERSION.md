# Version History — APA Discovery Accelerator

This file is the source of truth for version snapshots. Each version represents a tested, working state worth rolling back to.

---

## v1.2 — "Full-screen Explorer + US template seed" (locked 2026-05-11)

**Purpose:** turn the Process Explorer into a full-screen, Celonis-grade workspace with a dedicated filter rail, vertical variants slider, and consolidated KPI strip — and seed three additional active US process templates (home_mortgage, commercial_onboarding, sme_loan_origination) so US demos have content beyond retail_onboarding.

### Scope delivered

**Process Explorer — layout overhaul**
- Killed page-level `maxWidth: 860` constraint on the ingest page — Explorer now spans the full viewport with a 32px gutter
- Canvas height: 600px → 680px
- Right-rail filter panel (360px) sits next to the canvas — no more horizontal chip rows competing for space
- Left-rail vertical variants slider (78px) — drag the thumb up to reveal more variants, bottom = top variant only, top = all variants; live label shows `X/N · Y% cases`

**Process Explorer — KPI stats strip**
- 5-stat strip across the top: **Cases · Activities · Variants · Median cycle · Conformance**
- Monospace numbers, grey dividers
- Variants stat includes "top covers X% of cases" subtitle; Median includes "p25 X · p75 Y"; Conformance is RAG-coloured (green ≥80%, amber 50-79%, red <50%) with "X cases deviate" subtitle

**Process Explorer — unified filter panel**
- Dimension dropdown: Outcome / Duration / Conformance / Time period
- Horizontal-bar list ranked by case count, scaled by **share of total cases** (a 60%-of-total bucket fills 60% of the bar; small buckets visibly shrink)
- Multi-select within a dimension (click bars to toggle in/out); switching dimensions resets the others (mutual exclusion)
- Empty buckets dim and become unclickable
- Time period uses the existing dual-thumb date-range slider
- Live footer: "2 of 4 outcomes · 47% of cases covered"
- One-click `Clear (N)` button shows whenever any filter is active

**Backend — process graph**
- `durationHistogram` computed server-side (10 equal-width buckets) — kept in payload for future use; histogram UI was prototyped then removed (the share-of-total bars do the same job more legibly)

**US process templates seeded**
- **Home Mortgage** v1 (active, USA) — 14 sub-processes, 21 metrics (TRID + HMDA + ECOA-aware), 9 actors (Mortgage Borrower, MLO, Loan Processor, Underwriter, Appraiser, Title Company, Closer, Compliance Officer, Automated Underwriting), 9 US-specific systems (Encompass, Fannie Mae DU, Freddie Mac LP, tri-merge bureaus, AppraisalPort, First American/Fidelity Title, DocuSign/Notarize, MERS, FIS IBS/Fiserv LoanServ), 5 deviation patterns
- **Commercial Account Onboarding** v1 (active, USA) — 11 steps, 21 metrics, 8 actors, 7 systems (Salesforce FSC, nCino, LexisNexis Bridger, D&B, Refinitiv WorldCheck, FIS IBS/Fiserv Premier, Treasury Management Portal), 5 deviation patterns
- **SME Loan Origination** v1 (active, USA) — full seed
- **USA value coefficients**: 20 USD-denominated banking benchmarks (FTE rates, regulatory fines, risk/loss models, SME-specific)
- All four templates activated for `country: United States` via `CountryProcessActivation`
- `retail_onboarding` legacy step rows (14) migrated to the correct `processTemplate` key as part of the home_mortgage fix script

**Scripts (new)**
- `scripts/seed-demo-templates.ts` — offline seed for commercial_onboarding + sme_loan_origination + USA coefficients + US activations
- `scripts/fix-home-mortgage.ts` — fixes the home_mortgage processKey/name swap and seeds full content
- `scripts/audit-templates.ts` — high-level counts per template
- `scripts/audit-seating.ts` — per-template seating audit (systems linked, actors in pool vs expected)
- `scripts/list-repository.ts` — repository listing helper

### Schema migrations
None.

### Known limitations (deliberately deferred)
- `home_mortgage` has 26 `ProcessStepTemplate` rows where 14 should exist (duplicate seed passes) — cleanup pending
- `home_mortgage` has 19 systems seated where 9 specific vendors are enough (10 generic-named carry-overs from earlier seed) — cleanup pending
- `retail_onboarding` is missing 4 expected actors in the global pool (Retail Applicant, Branch CSR, Digital Onboarding Bot, KYC / AML Analyst) — cleanup pending
- `retail_onboarding` has no US-specific vendor systems seated (only generic functional names) — decision pending: add US vendors or keep generic
- `durationHistogram` is computed but unused — dead code, remove or wire to a future feature
- Brush-drag multi-select in filter bars (currently click-to-toggle)

### Rollback
Tagged `v1.2` in git. To roll back: `git checkout v1.2`.

---

## v1.1 — "Explorer interactivity + executive view" (locked 2026-05-10)

**Purpose:** make the Process Explorer interactive at the edge/activity level, restructure the digital-twin page into a clean tab + sub-tab UX, auto-load the cockpit and findings, and surface an executive triangle on top of findings.

### Scope delivered

**Process Explorer interactivity**
- Hover over an edge or its data-point label → that line darkens, others dim to ~12% opacity, source + target nodes glow with an amber halo
- Click an edge → pinned right-side callout with: from→to header, transition metrics (cases, % of total, avg/median/min/max time), applications involved (source + target systems), actor breakdown (top actors by count with percentage bars), example case IDs, candidate root causes from the banking deviation library
- Click an activity node → similar callout with: activity metrics (cases, events, rework indicator, avg/median/max time at activity, position-in-case %), applications involved, actors performing the activity (with explicit "no actor identified" empty state), top inbound + outbound flow connections, example case IDs
- New endpoints: `/edge-detail` and `/activity-detail` — server-side aggregation of per-transition / per-activity metrics
- APA-agent reveal removed from the edge callout to preserve suspense for Tile 3

**Variants slider**
- Replaced the percentage-based "Paths" slider with a discrete variant-rank slider
- Each step adds the next most frequent variant; the rightmost position is "all variants" and falls back to the full graph including long-tail
- Right-side label shows cumulative coverage: `Top X · Y% of cases`
- Footer surfaces variant context: "Top 3 of 7 variants · 49% of cases · 14/52 transitions"

**Lens filters (Outcome / Duration / Conformance / Time period)**
- Outcome chips: All / Approved / Declined / Withdrawn / In progress — derived heuristically from the last activity in each case
- Duration chips: All / Fastest 25% / Q2 / Q3 / Slowest 25% — quartile thresholds computed across the dataset; tooltip shows actual p25/p50/p75 thresholds
- Conformance chips: All / Conforming / Deviating — case follows discovered happy path edge-for-edge vs at least one off-path transition
- Time-period dual-thumb range slider over actual case-start range; debounced server refetch with `Refreshing…` indicator
- Mutual exclusivity across the three chip-row lenses; time-period independent
- Activities slider removed (redundant with variants slider)
- All filters always visible (no collapsible "Advanced filters" wrapper)

**Page restructure: tabs + sub-tabs**
- Top-level tabs: **Data Setup** (Stage 1 + 2) and **Digital Twin** (Stage 3 + 4 + 5)
- Smart default: lands on Digital Twin if activity table is built, else Data Setup
- Digital Twin sub-tabs: **Process Explorer** · **Process Cockpit** · **Process Analysis**
- Locked-state placeholder when prerequisites aren't met
- Helpful nudge "Open Digital Twin →" appears in Data Setup once Stage 2 builds successfully

**Auto-load + caching**
- Process Cockpit auto-loads on tab open (deterministic, fast, free); button renamed to **Refresh ↻**
- Process Analysis: new schema columns `findings` (Json) + `findingsGeneratedAt` (DateTime?) on `EngagementProcess`; first visit auto-generates and caches, subsequent visits load instantly from DB; **Regenerate** button forces a fresh Claude call

**Process Analysis — Elastic Operations triangle**
- Three-card executive view at the top of Stage 5: **Growth · Efficiency · Control**
- Each card shows £ value (with % of total), finding count, one-line Claude-generated summary, and 3-5 main-factor bullets
- Each finding now tagged with `elasticOpsVertex`; Claude provides per-vertex rolling summary
- Server-side reconciliation: triangle totals are recomputed from per-finding `annualValueLeak + elasticOpsVertex`, so triangle math always sums exactly to the total leak
- Three hard prompt rules: math consistency on every breakdown, no fabricated coefficients (set to 0 + flag if missing), explicit reconciliation contract

**Other**
- Sample CSV simulator actor-uniformity issue logged as a P-Bug in [docs/status.html](docs/status.html)
- Actor data-request priority lowered from must-have → should-have in the Claude prompt
- Activity callout now explicitly says "No actor identified" with a banking-realistic explanation when actor data is sparse / missing
- Cockpit top-stat strip wraps cleanly at narrow widths (no more clipped "5 at risk" pill)

### Schema migrations
- `EngagementProcess.findings` (Json?) — cached Stage 5 narrative
- `EngagementProcess.findingsGeneratedAt` (DateTime?) — cache freshness timestamp

### Known limitations (deliberately deferred)
- Top KPI strip on Process Explorer (Celonis-style) — backlog
- Throughput-time histogram inline in Process Explorer — backlog
- Variants list as a right-rail panel beside the graph (currently a tab toggle) — backlog
- Stage 4 visual conformance overlay — still backlog
- Tile 3 APA Simulation & Value Recovery — still locked

### Rollback
Tagged `v1.1` in git. To roll back: `git checkout v1.1`.

---

## v1.0 — "Discovery foundation" (locked 2026-05-10)

**Purpose:** end-to-end process mining flow from CSV upload → digital twin → KPI cockpit → Stage-5 findings narrative, backed by a curated process repository and country/coefficient knowledge base.

### Scope delivered

**Engagement workspace**
- Engagement creation with country, region (auto-derived), institution type, AUM, employees, customers, core banking system
- Multi-process per engagement (`EngagementProcess`) — Retail, SME, Commercial, Wealth lines of business
- Per-process landing page with 3 tiles: **Process Model & Data Request** (active), **Process Discovery & Insights** (active), **APA Simulation & Value Recovery** (locked)

**Tile 1 — Process Model & Data Request**
- BPMN canvas (React Flow + Dagre) — drag/drop, save state to `processMap`
- Process Capability assessment (digital / partial / manual per sub-process)
- Process Metrics form (volume, TAT, rates)
- Claude-generated MoSCoW Data Request from canvas + capability state
- Sample-CSV generator that deterministically produces files matching the data request (JSZip download)

**Tile 2 — Process Discovery & Insights** (5 inline stages)
- **Stage 1: Upload** — CSV ingestion with role auto-detection (case_id / activity / timestamp / actor), per-data-request slot mapping, `Reset` to clear stale uploads
- **Stage 2: Build Activity Table** — heuristic + value-based column detection, `parseTimestamp` rejecting years outside 1900-2100, chunked event inserts (CHUNK=2000), `rawData` purge after build
- **Stage 3a: Process Explorer** — variant graph with two sliders (min activity %, min path %) defaulting to clean view, heat-map toggle (frequency / cycle time), pink exception edges, deviation-aware happy-path detection
- **Stage 3b: Variant Analysis** — top-N paths by frequency, long-tail bucket
- **Stage 4: KPI Cockpit** — categorised KPI dashboard (8 categories × 3 sources direct/inferred/assumed), RAG status vs benchmarks, inline editing for assumed metrics with per-engagement `metricOverrides`
- **Stage 5: Findings (Value Leak)** — Claude-narrated findings grouped by cockpit category, with rank/severity/cases-affected/annual value leak/root cause/recommendation/recommended APA agent

**Process Repository** (admin)
- Tiles homepage: Process / Country / Knowledge
- `ProcessTemplate` versioned (processKey + version + isActive), with steps, sub-processes, metric definitions, deviation patterns
- Process Explorer Agent (Claude) — generates full process from a name + description
- Per-process detail page: Steps / Systems / Actors / Deviation Library / Sub-processes / Metric Definitions
- Metric Definitions admin: 8 categories × 3 sources, threshold direction (lower/higher_is_better), required flag, per-engagement override capability

**Country Repository** (admin)
- Per-country page: Activated Processes (links to canonical templates) + Value Coefficients
- `CountryProcessActivation` — country forks a canonical template version, optionally customises map/sub-processes/metrics
- `ValueCoefficient` cascade lookup: country + institutionType + key + validFrom

**Knowledge Library** (admin, read-only browse + per-process editing)
- DB-backed `DeviationPattern` (skip / loop / out_of_order / extra_step) with banking-specific candidate reasons tagged by category, severity, investigation hint, value model, APA agent
- 9 seeded patterns covering KYC, credit check, fraud screening, document collection, decision/account ordering

**Auth & deploy**
- NextAuth credentials provider, role-gated admin (`role: "admin"`)
- Postgres on Neon Launch tier
- All Claude calls via `src/lib/anthropic.ts` using `claude-sonnet-4-20250514`

### Known limitations (deliberately deferred)
- Stage 4 visual conformance overlay (BPMN canvas with actual-on-ideal coloured overlay)
- Tile 3 APA Simulation & Value Recovery (locked, future automation simulator)
- Multi-tenancy (single workspace today)
- Exports (CSV/PDF of cockpit + findings)

### Rollback
Tag this snapshot in git as `v1.0` once committed. The HTML status board at `docs/status.html` is the human-readable companion to this file.

---
