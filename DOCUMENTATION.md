# DOCUMENTATION.md — DataLaser Complete Documentation Plan

This file instructs the Claude Code agent to implement complete documentation
for DataLaser across all categories: technical, product, marketing, and legal.

Read this fully before writing a single line of documentation.

---

## Documentation Stack

### External technical docs — Mintlify

URL: docs.datalaser.de
Repository: /docs folder in main repo
Format: .mdx files
Deploy: Auto-deploys on push to main

Setup:
```bash
npm install -g mintlify
mintlify init  # in /docs folder
```

Configuration: /docs/mint.json
```json
{
  "name": "DataLaser",
  "logo": {
    "light": "/logo/light.svg",
    "dark": "/logo/dark.svg"
  },
  "favicon": "/favicon.svg",
  "colors": {
    "primary": "#000000",
    "light": "#ffffff",
    "dark": "#000000"
  },
  "topbarLinks": [
    {
      "name": "datalaser.de",
      "url": "https://datalaser.de"
    }
  ],
  "anchors": [
    {
      "name": "API Reference",
      "icon": "code",
      "url": "api-reference"
    }
  ],
  "navigation": [
    {
      "group": "Getting Started",
      "pages": [
        "introduction",
        "quickstart",
        "first-datasource",
        "first-insight"
      ]
    },
    {
      "group": "Product Guides",
      "pages": [
        "guides/data-sources",
        "guides/data-health",
        "guides/data-prep",
        "guides/insights",
        "guides/ask-data",
        "guides/studio",
        "guides/templates"
      ]
    },
    {
      "group": "API Reference",
      "pages": [
        "api-reference/authentication",
        "api-reference/data-sources",
        "api-reference/pipeline",
        "api-reference/templates",
        "api-reference/insights",
        "api-reference/studio"
      ]
    },
    {
      "group": "Security",
      "pages": [
        "security/overview",
        "security/data-flow",
        "security/eu-residency",
        "security/dsgvo"
      ]
    }
  ]
}
```

### Internal docs — Notion

Structure mirrors the sections below.
Not public. For team use only.

---

## Section 1 — Getting Started (Mintlify)

### File: /docs/introduction.mdx

Write this document covering:

```
Title: What is DataLaser

Opening paragraph:
DataLaser is an AI-powered business intelligence platform
built specifically for the German Mittelstand and global SMBs.
It monitors your data 24/7, answers questions in plain language,
and generates complete analysis reports — all grounded in
verified computations, not guesses.

Sections:
1. How DataLaser is different
   - Template engine computes verified facts first
   - AI explains verified facts, never guesses
   - Every answer traceable to a computation
   - German and English column detection built-in

2. The three modes
   - Insights: 24/7 proactive monitoring
   - Ask Data: conversational analytics
   - Studio: professional analysis reports

3. Privacy by architecture
   - Claude never sees raw data rows
   - Only column names and aggregated results
   - EU infrastructure (Frankfurt)
   - DSGVO compliant

4. Who DataLaser is for
   - Mittelstand companies (20-500 employees)
   - No data engineer required
   - Works with existing Postgres, CSV, Excel
   - German and English language support
```

### File: /docs/quickstart.mdx

Write a 5-minute quickstart:

```
Step 1: Create account (1 minute)
  - Sign up at datalaser.de
  - Verify email
  - Create your first project

Step 2: Connect data (2 minutes)
  Option A: Upload a CSV file
  Option B: Connect your Postgres database

Step 3: See your first insight (2 minutes)
  - DataLaser automatically profiles your data
  - Templates detect what analyses apply
  - First insights generated automatically

Include: Screenshots of each step
Include: A sample CSV download link for testing
Include: "What happens to my data?" callout box
```

### File: /docs/first-datasource.mdx

```
Title: Connect Your First Data Source

Sections:
1. Uploading a file
   - Supported formats: CSV, Excel, JSON
   - Maximum file size
   - How German column names are detected automatically
   - What happens after upload (health page)

2. Connecting a database
   - Supported databases list
   - Required permissions (read-only recommended)
   - How credentials are encrypted
   - Testing the connection
   - Live vs scheduled sync

3. Understanding the health page
   - Quality score explained
   - Column-by-column breakdown
   - What the warnings mean
   - Next steps: prepare vs explore
```

---

## Section 2 — Product Guides (Mintlify)

### File: /docs/guides/data-prep.mdx

```
Title: Data Prep Wizard

Introduction:
Why data preparation matters.
Dirty data = wrong AI answers.
DataLaser's 5-step wizard cleans your data
before any analysis runs.

Step 1: Profile
  What the profiler measures:
  - Null rates per column
  - Outlier detection (IQ method)
  - Type inference
  - Encoding detection
  - Quality score calculation (0-100)
  - Semantic role detection (measure/dimension/date/binary/id)

  Quality score breakdown:
  - 80-100: Clean data, ready to analyse
  - 50-79: Some issues, cleaning recommended
  - 0-49: Significant issues, cleaning required

Step 2: Suggestions
  How AI suggestions work:
  - Based on profile findings
  - Ranked by confidence score
  - Before/after preview for each
  - Accept or reject individually

  Common suggestions:
  - Fill null values (median/mean/mode/constant)
  - Cast column types
  - Normalise date formats (including German DD.MM.YYYY)
  - Clip outliers
  - Encode categorical columns

Step 3: Transform
  All 16 available operations:
  (document each one with example)

Step 4: Validate
  8 validation test categories:
  (document each one)

  Understanding results:
  - Issue: affects quality score, should fix
  - Characteristic: informational, not a problem
  - Info: metadata about your data

Step 5: Ready
  What happens when wizard completes:
  - Cleaned file saved to secure EU storage
  - Pipeline recipe saved for future re-runs
  - Scheduled sync available
  - All analysis uses cleaned data automatically

Pipeline Recipes:
  What they are
  How to re-run
  How to schedule
  How to modify
```

### File: /docs/guides/ask-data.mdx

```
Title: Ask Data

Introduction:
Ask any business question in plain language.
Get a streaming answer with interactive charts.

How it works (technical overview):
  1. Your question submitted
  2. Templates run on your data (verified facts computed)
  3. Claude receives only column names + verified facts
  4. Claude writes Python/SQL code
  5. Code runs in secure pipeline against your data
  6. Only aggregated result returns
  7. Claude explains in plain language

What you can ask:
  - Revenue analysis: "What is our revenue by region this quarter?"
  - Comparisons: "Compare performance between product A and B"
  - Trends: "How has our margin changed over the last 6 months?"
  - Rankings: "Who are our top 10 customers by revenue?"
  - Correlations: "Is there a relationship between price and quantity?"

Understanding the answer:
  - Every answer shows "Based on: [Template Name]"
  - Numbers are verified, not estimated
  - Click "View computation" to see exactly what was calculated

Source selector:
  - Toggle which data sources to include
  - Useful when you have multiple connected sources
  - Selection persists per conversation

Chart interactions:
  - Hover for exact values
  - Click legend to show/hide series
  - Charts are fully interactive

Conversation history:
  - All conversations saved per project
  - Load previous conversations
  - Share conversation with team members (Team plan)

Privacy note:
  - Your raw data never leaves EU infrastructure
  - Claude only sees column names and aggregated results
  - [Link to security documentation]
```

### File: /docs/guides/studio.mdx

```
Title: DataLaser Studio

Introduction:
Studio is a professional analyst workspace.
Describe your analysis in one sentence.
Studio generates a complete report with
code, charts, statistics, and conclusions.

The two-panel layout:
  Left: Living notebook (editable code and text cells)
  Right: Live report (professional formatted output)

Creating a notebook:
  1. Navigate to Studio
  2. Click "New notebook"
  3. In the "Ask Claude" input describe your analysis
  4. Claude generates 14+ cells automatically
  5. Review and run cells
  6. Export when ready

Cell types:
  - Heading: Section titles in the report
  - Text: Prose explanations
  - Python: Code that executes against your data
  - SQL: Queries for database sources
  - R: R code execution (coming soon)

Running code:
  - Click run on individual cell
  - Or "Run all" to execute entire notebook
  - Output appears below each cell
  - Right panel updates automatically

The report panel:
  - Code hidden by default (toggle to show)
  - Charts rendered as interactive visualizations
  - Tables formatted professionally
  - Statistics with p-values and confidence intervals
  - Cover page auto-generated

Exporting:
  - PDF: Professional report for sharing
  - Jupyter .ipynb: For data scientists
  - Python .py: Standalone script
  - HTML: For embedding or sharing online

Execution modes:
  - File source: Runs against your uploaded file
  - Live database: Queries fresh data on every run

Query library:
  - Save frequently used queries
  - Share across team (Team plan)
  - Categorise by project or type
```

### File: /docs/guides/templates.mdx

```
Title: Industry Analysis Templates

Introduction:
DataLaser includes 31 pre-built analysis templates
covering universal statistics, German Mittelstand,
and broader industry verticals.

Templates automatically detect which analyses
apply to your data based on column names and types.
German and English column names are both detected
without any configuration.

How template detection works:
  - Upload your file or connect your database
  - DataLaser scans column names and types
  - Matches against bilingual pattern library
  - Returns applicable templates with confidence scores
  - You run the ones most relevant

Universal templates (T01-T08):
  Work on any dataset with sufficient columns.
  Document each:
  T01: Data Quality Scorecard
    What it measures, what columns needed, chart type
  T02: Correlation Explorer
  T03: Distribution Profiler
  T04: Outlier Detection Report
  T05: Segment Comparison (ANOVA)
  T06: Time Trend Analysis
  T07: Categorical Association Map
  T08: Pareto Analysis (80/20)

German Mittelstand templates (T09-T22):
  Document each with:
  - What business question it answers
  - What columns are needed (German AND English)
  - What computation runs
  - Example output with sample numbers
  - Why this matters for German businesses

  T09: Revenue Driver Analysis (Umsatzanalyse)
  T10: Profitability Analysis (Rentabilitätsanalyse)
  T11: Production Efficiency (Produktionseffizienz)
  T12: Supply Chain Lead Time (Lieferzeit)
  T13: Customer Concentration Risk (Klumpenrisiko)
  T14: Pricing Elasticity (Preiselastizität)
  T15: Defect Root Cause (Ausschussanalyse)
  T16: Inventory Turnover (Lagerumschlag)
  T17: Employee Productivity (Mitarbeiterproduktivität)
  T18: Regional Performance (Standortvergleich)
  T19: Cash Flow Patterns (Liquiditätsplanung)
  T20: Warranty/Returns Analysis (Reklamationsmanagement)
  T21: Batch Quality Control (SPC)
  T22: Energy Consumption (Energieverbrauch)
  T31: Budget vs Actual Variance (Soll-Ist-Vergleich)

Broader verticals (T23-T30):
  Document each similarly.

Understanding template output:
  - Findings: plain English statements with specific numbers
  - Charts: interactive visualizations
  - Metrics: computed values with statistical context
  - Verified: all numbers computed by DataLaser engine

How templates power AI:
  - Templates run first, compute verified facts
  - [VERIFIED] findings injected into every AI prompt
  - Claude explains verified facts, never guesses
  - This is why DataLaser answers don't hallucinate
```

---

## Section 3 — API Reference (Mintlify)

### File: /docs/api-reference/authentication.mdx

```
Title: Authentication

DataLaser uses Supabase JWT authentication.

Getting your API key:
  1. Login to datalaser.de
  2. Go to Settings → API
  3. Copy your API key

Using the API key:
  All requests must include:
  Authorization: Bearer YOUR_API_KEY

Base URL:
  https://datalaser.de/api

Rate limits:
  100 requests per minute per API key
  Contact hello@datalaser.de for higher limits
```

### File: /docs/api-reference/pipeline.mdx

Document ALL 19 pipeline endpoints with:
- Method and path
- Description
- Request body (with types)
- Response body (with types)
- Example request (curl)
- Example response (JSON)
- Error codes

All 19 endpoints:
```
POST /profile/file
POST /profile/database
POST /transform/apply
POST /transform/suggestions
POST /validate/run
POST /validate/drift
POST /join/detect
POST /join/apply
POST /analyst/execute
POST /analyst/execute-db
POST /analyst/descriptive
POST /analyst/correlation
POST /analyst/regression
POST /analyst/anova
POST /analyst/ttest
POST /analyst/chisquare
POST /analyst/forecast
POST /analyst/suggest-analysis
POST /auto-analysis/run
POST /templates/applicable
POST /templates/{template_id}/run
```

For each endpoint document:
```mdx
## POST /profile/file

Profile a CSV, Excel, or JSON file to get
column statistics, quality scores, and semantic roles.

### Request

```json
{
  "file": "multipart/form-data"
}
```

### Response

```json
{
  "row_count": 891,
  "column_count": 12,
  "quality_score": 65,
  "columns": [
    {
      "name": "Age",
      "dtype": "float64",
      "null_rate": 0.199,
      "semantic_role": "measure",
      "warnings": ["19.9% null values"]
    }
  ],
  "warnings": [...],
  "suggestions": [...]
}
```

### Errors

| Code | Description |
|------|-------------|
| 400 | Invalid file format |
| 413 | File too large |
| 500 | Processing error |
```

---

## Section 4 — Security Documentation (Mintlify)

### File: /docs/security/data-flow.mdx

```
Title: How Your Data Flows Through DataLaser

This document explains exactly what happens to your data
at every step. No vague assurances — specific technical details.

Step 1: Data upload / connection
  - File upload: encrypted in transit (TLS 1.3)
  - Stored in Supabase Storage, eu-central-1 Frankfurt
  - File path: {userId}/{sourceId}/{filename}
  - Access: signed URLs only, expires in 1 hour
  - Database credentials: encrypted AES-256-GCM
    before storage, decrypted only in pipeline service

Step 2: Pipeline processing
  - Runs in Railway EU infrastructure
  - Profiling, transformation, validation
  - All computation happens here
  - No data sent to external services at this stage

Step 3: Template computation
  - 31 templates run against your data
  - All computation local to pipeline service
  - Zero external API calls
  - Verified facts extracted as [VERIFIED] findings

Step 4: AI processing
  What is sent to Claude (Anthropic API):
  - Column names and data types
  - Row count and date ranges
  - [VERIFIED] findings from templates
  - Your question

  What is NEVER sent to Claude:
  - Raw data rows
  - Individual customer records
  - Personal information (names, emails, IDs)
  - Transaction amounts or details
  - Any actual data values

Step 5: Response
  - Claude's answer returned to your browser
  - Conversation saved in Supabase (Frankfurt)
  - Raw data never stored in conversation

Visual data flow diagram:
[Include diagram showing the flow]
```

### File: /docs/security/eu-residency.mdx

```
Title: EU Data Residency

All DataLaser infrastructure runs in EU data centers.

Infrastructure locations:
  Database: Supabase eu-central-1 (Frankfurt, Germany)
  File storage: Supabase eu-central-1 (Frankfurt, Germany)
  Pipeline service: Railway EU West (Europe)
  Frontend CDN: Vercel with EU region priority (fra1, arn1, lhr1)

AI processing:
  Anthropic API processes column names and verified statistics.
  This data is covered by our signed Data Processing Agreement
  with Anthropic under EU Standard Contractual Clauses (SCCs)
  per GDPR Article 46.

  Anthropic's commitments under our DPA:
  - Data not used for model training
  - SOC 2 Type II certified
  - Processing only for service delivery
  - EU Standard Contractual Clauses in place

Enterprise Privacy Mode:
  For customers requiring zero data outside EU jurisdiction:
  - Enable in Project Settings → Privacy → EU-only mode
  - All template computations run (Frankfurt)
  - AI narrative generation disabled
  - Pure verified analytics, no external processing
  - Available on Enterprise plan

Contractual guarantees:
  - Our DPA with you covers EU infrastructure
  - Anthropic DPA available on request
  - Data residency addendum available for Enterprise
```

---

## Section 5 — Architecture Document (Internal/Mintlify)

### File: /docs/architecture.mdx

```
Title: DataLaser Architecture

This document describes the complete technical architecture
of the DataLaser platform.

System overview diagram:
[Insert architecture diagram showing all components]

Components:

1. Next.js Frontend (Vercel)
   - React 19, TypeScript, Tailwind v4
   - Server components for data fetching
   - Client components for interactivity
   - Streaming for AI responses
   - i18n: next-intl (German + English)

2. Supabase (Frankfurt)
   - PostgreSQL database
   - Row Level Security on all tables
   - Storage for data files
   - Auth (JWT)
   - Real-time subscriptions for Studio

3. FastAPI Pipeline Service (Railway EU)
   - Python 3.11
   - Polars for large file processing
   - pandas, scipy, statsmodels for analysis
   - Template engine (31 templates)
   - AutoAnalyzer (17 analyses)
   - Sandboxed code execution

4. Anthropic Claude API
   - Receives: schema + verified context only
   - Streaming responses
   - Structured JSON output for charts
   - Code generation for Studio

Database schema:
[Document all 20+ tables with columns and relationships]

Data flow diagrams:
[One diagram per feature: Ask Data, Insights, Studio, Data Prep]

Security architecture:
[Encryption at rest, in transit, credential vault]

Deployment architecture:
[Vercel + Railway + Supabase topology]

Performance considerations:
[Polars vs pandas decision, Railway scaling, Supabase connection pooling]
```

---

## Section 6 — Marketing Documents (Notion — Internal)

### Document: Product Positioning

```
DataLaser Positioning Document

One-liner:
"AI-powered business intelligence that verifies facts
before explaining them — built for the German Mittelstand."

Category: Business Intelligence / Analytics AI

Target customer (ICP):
  Primary: Head of Controlling / CFO at Mittelstand company
  Company: 20-500 employees, Germany
  Industry: Manufacturing, logistics, professional services
  Tech stack: Postgres or CSV exports, no data engineer
  Current solution: Excel + manual reports + gut feeling
  Pain: 3-6 hours per insight, always looking backwards

Positioning matrix:
[2x2: Price vs Analytical Depth — DataLaser in top-right quadrant]

Key differentiators:
1. Verified architecture (no hallucination)
2. German-first bilingual detection
3. 31 industry templates
4. Works without data engineer
5. DSGVO compliant, EU infrastructure

Messaging pillars:
1. Verified: "Every number is proven, not guessed"
2. German: "Built for how German businesses actually work"
3. Fast: "From CSV to insight in 5 minutes"
4. Private: "Your data never leaves EU infrastructure"

Competitive positioning:
vs ThoughtSpot: Same power, 1/100th the price, no IT team
vs Julius AI: Live DB, team collab, verified architecture
vs Excel+ChatGPT: Automated, persistent, always fresh, verified
```

### Document: Ideal Customer Profile (ICP)

```
Primary ICP:

Job title: Leiter Controlling / CFO / Kaufmännischer Leiter
Company size: 50-200 employees
Industry: Manufacturing (Fertigung), Logistics (Logistik)
Location: Germany (DACH)
Tech: Postgres or DATEV exports
Team: No dedicated data analyst

Pain points:
- Monthly reporting takes 3+ days
- Excel files emailed around, version chaos
- Cannot answer "why" questions quickly
- Board asks for data, takes days to prepare
- No visibility into real-time performance

Trigger events (when to reach out):
- Just hired a new CFO or Controlling Leiter
- Company recently adopted ERP (SAP B1)
- Growing fast (hiring signals on LinkedIn)
- Just raised funding (IHK announcements)

Secondary ICP:
Job title: Head of Operations / Geschäftsführer
Same company profile
Pain: Operational data in silos, no unified view
```

### Document: GTM Playbook

```
Phase 1 (Months 1-3): First 10 customers
  Channel: LinkedIn outreach (DataLaser company page)
  Channel: IHK Frankfurt and Rheinhessen events
  Channel: Steuerberater pilot partnerships
  Offer: 30-day free pilot
  Goal: 10 pilots → 3-5 paying customers

Phase 2 (Months 4-6): Scale to 50 customers
  Channel: German LinkedIn content (templates, insights)
  Channel: DATEV CSV auto-detection announcement
  Channel: Product Hunt launch (German category)
  Channel: Controlling-Portal.de community
  Goal: €5,000-10,000 MRR

Phase 3 (Months 7-12): €50k MRR
  Channel: Steuerberater partnership program
  Channel: IHK partnership for member companies
  Channel: Series of German market landing pages
  Goal: €50,000 MRR, raise pre-seed round

Content strategy:
  Weekly LinkedIn post (DataLaser company page):
  - Template showcase: "How T15 found the defect root cause"
  - Customer story (anonymised)
  - Product update
  - German market data insight

  SEO landing pages:
  - datalaser.de/fuer/fertigung
  - datalaser.de/fuer/logistik
  - datalaser.de/fuer/controlling
  - datalaser.de/fuer/steuerberater
```

### Document: Objection Handling Guide

```
For sales conversations and pitch Q&A:

"We're worried about data privacy"
→ [Full response as documented in privacy slide]
→ Our data never reaches Claude. Templates compute here in Frankfurt.
→ Anthropic DPA signed. EU Standard Contractual Clauses.
→ EU-only mode available for strictest requirements.

"We already have Power BI / Tableau"
→ Those tools wait for you to ask. We tell you before you ask.
→ No SQL required. No data engineer. Works in 5 minutes.
→ 31 German industry templates they don't have.
→ €149/month vs €10,000+/year licensing.

"ChatGPT can do this"
→ ChatGPT guesses. We verify.
→ ChatGPT doesn't connect to your live Postgres.
→ ChatGPT has no DATEV awareness.
→ ChatGPT doesn't monitor 24/7 and push briefings.

"We're too small for analytics tools"
→ That's exactly who we built this for.
→ No data engineer needed. CSV upload and go.
→ €49/month. Less than one hour of consulting time.

"What happens if Anthropic has an outage?"
→ Everything still works. Templates run without AI.
→ 17 analyses, 31 templates — all pure computation.
→ No competitor can say this. They're all AI-dependent.

"We need SOC 2"
→ SOC 2 Type I targeted Q3 2026.
→ Vanta implementation in progress.
→ For now: EU infrastructure + Anthropic DPA + our DPA.
→ Enterprise Privacy Mode: zero external AI if required.

"You're too early stage"
→ Product is fully built and deployed.
→ [Show live demo immediately]
→ Pilot program: 30 days free, no commitment.
```

---

## Section 7 — Legal Documents (Notion — Internal, then publish)

### AGB (Terms of Service)

Purchase from eRecht24.de — SaaS template in German.
Customise with:
- DataLaser service description
- Pricing tiers
- Cancellation terms (monthly, no minimum)
- Data processing references
- Jurisdiction: Germany

### Datenschutzerklärung (Privacy Policy)

Purchase from eRecht24.de — DSGVO compliant template.
Customise with:
- Supabase as data processor
- Anthropic as data processor (DPA reference)
- Railway as data processor
- EU data residency statement
- Cookie usage
- Contact: datenschutz@datalaser.de

### Auftragsverarbeitungsvertrag (AVV / DPA)

Download free template from BayLDA (Bavarian Data Protection Authority).
Or purchase from eRecht24.de.
Make available as downloadable PDF at datalaser.de/dpa

### Impressum

Required by German law for commercial websites.
Must include:
- Your full legal name
- Address
- Email: hello@datalaser.de
- Steuernummer
- Responsible for content (Verantwortlicher)

---

## Implementation Order

### Week 1 — Foundation:
```
1. Set up Mintlify in /docs folder
2. Create mint.json configuration
3. Write introduction.mdx
4. Write quickstart.mdx
5. Write security/data-flow.mdx (most important for sales)
6. Write security/eu-residency.mdx
```

### Week 2 — Product guides:
```
7. Write guides/data-prep.mdx
8. Write guides/ask-data.mdx
9. Write guides/templates.mdx
10. Write guides/studio.mdx
11. Write guides/insights.mdx
```

### Week 3 — API reference:
```
12. Document all 19 pipeline endpoints
13. Document authentication
14. Document templates API
15. Add code examples for each endpoint
```

### Week 4 — Marketing and legal:
```
16. Write product positioning document (Notion)
17. Write ICP document (Notion)
18. Write GTM playbook (Notion)
19. Write objection handling guide (Notion)
20. Purchase and customise AGB from eRecht24
21. Purchase and customise Datenschutzerklärung
22. Download and customise AVV template
23. Write Impressum
```

### Ongoing:
```
- Update changelog on every release
- Update API docs when endpoints change
- Update templates docs when new templates added
- Review legal docs quarterly
```

---

## Documentation Quality Standards

### Every product guide must include:
- What the feature does (1 paragraph)
- When to use it
- Step-by-step instructions with screenshots
- At least one concrete example with real numbers
- Common questions or gotchas
- Link to related features

### Every API endpoint must include:
- Method and path
- Description
- Request body with all fields typed
- Response body with all fields typed
- At least one curl example
- At least one response example
- Error codes table

### Every document must:
- Be available in German AND English
- Use t() keys — no hardcoded strings
- Be reviewed before publishing
- Have a last-updated date

---

## Tools and Resources

```
Mintlify:          mintlify.com (docs platform)
eRecht24:          e-recht24.de (German legal templates)
BayLDA:            lda.bayern.de (free AVV template)
EUIPO:             euipo.europa.eu (EU trademark search)
DPMA:              dpma.de (German trademark search)
Anthropic DPA:     console.anthropic.com/settings/privacy
Screenshots:       Use Cleanshot X or similar
Diagrams:          Mermaid (renders in Mintlify natively)
```

---

Last updated: March 2026
Docs URL: docs.datalaser.de
Questions: hello@datalaser.de