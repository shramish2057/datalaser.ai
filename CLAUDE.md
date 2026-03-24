# CLAUDE.md — DataLaser Development Bible

This file contains all rules, architecture decisions, and conventions for the DataLaser project.
Read this fully before making any changes. Every rule here is non-negotiable.

---

## Project Overview

DataLaser is an AI-powered business intelligence platform for the German Mittelstand and global SMBs.

**Core architecture:**
```
Your Data (DB or file)
        ↓
Data Pipeline (clean + validate) — Railway FastAPI service
        ↓
Template Engine (compute verified facts) — 42 bilingual templates
        ↓
AI Layer (explain + explore + generate) — Claude Sonnet via Anthropic API
        ↓
User (insights, answers, reports)
```

**Privacy-safe code execution model:**
Claude NEVER sees raw data rows. Claude only receives:
- Column names and types (schema)
- Verified facts from template computations [VERIFIED]
- Aggregated results (numbers, not rows)
Claude writes code → pipeline executes against real data → only result returns.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui |
| Backend | Supabase (auth + DB + storage + RLS) |
| Pipeline | FastAPI (Python) on Railway |
| AI | Claude Sonnet via Anthropic API (streaming) |
| Charts | Recharts |
| Deployment | Vercel (frontend), Railway (pipeline) |

**Pipeline URL:** https://datalaserai-production.up.railway.app
**Pipeline libs:** Polars, pandas, scipy, statsmodels, scikit-learn, RapidFuzz, ydata-profiling

---

## Project Structure

```
/
├── src/
│   ├── app/
│   │   ├── (auth)/                 # Cookie-based auth pages (login/signup)
│   │   ├── (marketing)/            # URL-based locale public pages (/de, /en)
│   │   │   ├── de/login|signup/
│   │   │   └── en/login|signup/
│   │   ├── (personal)/             # Personal user routes
│   │   │   ├── projects/           # Project list + project detail
│   │   │   │   └── [projectId]/    # insights|ask|studio|dashboard|sources|prep|settings
│   │   │   └── settings/           # User settings (general, api-keys, billing)
│   │   ├── (team)/                 # Team/org routes
│   │   │   └── [orgSlug]/          # Org → workspace → project hierarchy
│   │   ├── api/                    # Next.js API routes (proxies to pipeline)
│   │   │   ├── ask/                # Ask Data streaming endpoint
│   │   │   ├── insights/generate/  # Insights generation
│   │   │   ├── studio/             # Notebook CRUD, execute, suggest, interpret
│   │   │   ├── pipeline/           # Profile, transform, validate, templates, auto-analysis
│   │   │   ├── sources/            # Upload, connect, test, query
│   │   │   ├── anomalies/          # Anomaly detection
│   │   │   └── onboarding/         # Onboarding completion + metric suggestion
│   │   ├── onboarding/             # Onboarding wizard (setup → org → project → connect → calibrate)
│   │   └── auth/callback/          # Supabase auth callback
│   ├── components/
│   │   ├── blocks/                 # Landing page sections (hero, features, testimonials)
│   │   ├── charts/                 # InteractiveChart, KPICard, DrillDown, Gauge, Heatmap
│   │   ├── landing/                # LandingPage.tsx
│   │   ├── layout/                 # Sidebar.tsx, TopBar.tsx
│   │   ├── onboarding/             # StepIndicator, ConnectorIcons
│   │   ├── settings/               # SettingsShell, OrgSettingsShell, WsSettingsShell
│   │   ├── studio/                 # StudioSidebar, CellCard, OutputPanel
│   │   ├── ui/                     # shadcn components (button, card, dialog, badge, faq, etc.)
│   │   ├── Logo.tsx                # Shared Logo component (all pages)
│   │   ├── LocaleToggle.tsx        # DE/EN language switcher
│   │   ├── ProjectIcon.tsx         # Project icon badge
│   │   └── DataQualityBanner.tsx   # Data quality warnings
│   ├── i18n/
│   │   └── request.ts             # Locale detection (cookie > Accept-Language > 'en')
│   ├── lib/
│   │   ├── ai/                    # Claude integration
│   │   │   ├── claude.ts          # Streaming chat
│   │   │   ├── sampler.ts         # buildDataContext — schema only, NO raw rows
│   │   │   ├── engineContext.ts   # formatFactsForPrompt with GERMAN_PROMPT_BLOCK
│   │   │   └── prompts.ts        # System prompts
│   │   ├── adapters/              # DB adapters (postgres, mysql, mongodb, snowflake, bigquery, csv)
│   │   ├── i18n/findingsMap.ts    # 45+ regex translators for German findings
│   │   ├── supabase/              # Admin, client, server helpers
│   │   ├── vault/                 # AES-256-GCM credential encryption
│   │   ├── studio/                # buildSchemaContext
│   │   ├── context/               # AppContext
│   │   ├── bootstrap.ts           # Org/workspace/project creation
│   │   ├── navigation.ts          # Route helpers
│   │   ├── formatNumber.ts        # Locale-aware number formatting
│   │   ├── chartTheme.ts          # Recharts theme tokens
│   │   └── utils.ts               # cn() and shared utilities
│   ├── messages/
│   │   ├── en.json                # English translations (~400 keys)
│   │   └── de.json                # German translations (~400 keys)
│   ├── middleware.ts              # Auth + locale redirect + public route checks
│   └── types/database.ts         # Supabase generated types
├── pipeline-service/              # FastAPI Python service (Railway)
│   ├── main.py
│   ├── routers/
│   │   ├── profile.py             # File + DB profiling
│   │   ├── transform.py           # 16 transformation operations
│   │   ├── validate.py            # 8 validation categories + drift
│   │   ├── analyst.py             # Safe sandboxed Python/SQL execution
│   │   ├── auto_analysis.py       # Full AutoAnalyzer endpoint
│   │   ├── templates.py           # 42 industry templates
│   │   └── join.py                # RapidFuzz join detection + merge
│   ├── services/
│   │   ├── profiler.py
│   │   ├── transformer.py
│   │   ├── validator.py
│   │   ├── analyst.py
│   │   ├── auto_analyzer.py       # 17 analyses, zero AI calls
│   │   ├── templates.py           # TemplateEngine class (42 templates)
│   │   ├── suggester.py           # AI transformation suggestions
│   │   ├── joiner.py              # Multi-source merge
│   │   └── file_handler.py        # File parsing utilities
│   ├── models/schemas.py
│   └── utils/
├── supabase/migrations/           # 22 migration files (01-22)
├── public/logos/                   # Customer & connector logos
├── tailwind.config.ts             # Design tokens (dl-* colors, fonts, radius, shadows)
└── CLAUDE.md                      # This file
```

---

## Navigation Architecture

**Public pages (URL-based locale for SEO):**
```
/de|/en              → Landing page
/de|/en/login        → Login
/de|/en/signup       → Signup
```

**Onboarding (behind auth, cookie-based locale):**
```
/onboarding/setup → /onboarding/org → /onboarding/project → /onboarding/connect → /onboarding/intent → /onboarding/calibrate
```

**Personal users:**
```
/projects → /projects/[projectId]/insights|ask|studio|dashboard|sources|prep|settings
```

**Team users:**
```
/[orgSlug] → /[orgSlug]/[workspaceSlug] → /[orgSlug]/[workspaceSlug]/[projectSlug]/...
```

**Studio** has its own full-screen layout (no project sidebar):
```
/projects/[projectId]/studio/[notebookId]
```

---

## i18n Rules — NON-NEGOTIABLE

### Never hardcode user-facing text. Ever.

Every string the user sees must use the translation function.

```tsx
// CORRECT
t('insights.title')
t('pipeline.status.ready')
t('templates.noResults')
t('errors.uploadFailed')

// WRONG — never do this
"Insights"
"Ready"
"No results found"
"Upload failed"
```

### Translation files

```
/src/messages/en.json  — English (default)
/src/messages/de.json  — German
```

Both files must be updated simultaneously.
Adding a key to en.json without adding it to de.json is a broken build. No exceptions.

### When adding any new feature or UI text:

1. Add English key to /src/messages/en.json
2. Add German translation to /src/messages/de.json
3. Use t('key') in the component — never raw string
4. If German translation is uncertain, use English as temporary fallback with a TODO comment:

```json
// de.json
"pipeline.newFeature": "New Feature (TODO: translate)"
```

Never leave a key missing from either file.

### What requires translation:
- All button labels
- All page titles and headings
- All placeholder text
- All toast/notification messages
- All error messages shown to users
- All empty state messages
- All tooltip text
- All modal titles and body text
- All table column headers
- All status badges

### What does NOT need translation:
- console.log messages (developer only)
- Code comments
- Variable names
- API error codes (internal)
- Technical identifiers
- Content inside .ts/.py files not shown to users

### i18n checklist — run before every commit:

```
- [ ] No hardcoded strings in JSX/TSX components
- [ ] No hardcoded strings in toast messages
- [ ] No hardcoded strings in error messages shown to users
- [ ] No hardcoded strings in placeholder attributes
- [ ] No hardcoded strings in button labels
- [ ] No hardcoded strings in aria-label attributes
- [ ] Both en.json and de.json updated with new keys
- [ ] No keys in en.json missing from de.json
- [ ] No keys in de.json missing from en.json
```

---

## Git Rules — NON-NEGOTIABLE

### Always commit before push

Never push without a clean, descriptive commit.

### Commit message format:

```
feat: add DATEV CSV parser with bilingual column detection
fix: correct German translation for pipeline status badge
i18n: add translations for Studio notebook UI
refactor: extract buildDataContext to separate utility
chore: update Railway environment variables
test: add Titanic CSV template detection test
```

Never commit with: "fix", "update", "changes", "misc", "wip"

### Mandatory commit points:

- Before switching branches
- Before starting a new feature
- Before any deployment to Vercel or Railway
- At the end of every working session
- After completing each sprint step

### Branch strategy:

```
main          — production, auto-deploys to Vercel
navigation-v2 — current development branch
feature/*     — new features, merge to dev branch
fix/*         — bug fixes
i18n/*        — translation-only changes
```

### Never:
- Push directly to main without testing
- Mix feature work and i18n updates in one commit (separate commits)
- Leave uncommitted changes before starting a new task
- Force push to main

---

## Privacy & Data Rules — NON-NEGOTIABLE

### Claude never sees raw data rows

The buildDataContext function in src/lib/sampler.ts must ONLY send:

```typescript
// CORRECT — send schema and verified facts only
const context = `
Dataset: ${source.name}
Row count: ${source.row_count}
Columns: ${columns.map(c => `${c.name}: ${c.dtype}`).join(', ')}
Date range: ${dateRange}
[VERIFIED] ${templateFindings.join('\n[VERIFIED] ')}
`

// WRONG — never send raw rows
const context = `
Data sample:
${JSON.stringify(source.sample_data.rows)}  // NEVER DO THIS
`
```

### Template-first architecture

Before any Claude API call:
1. Run get_applicable() on column profiles
2. Execute top 3 applicable templates
3. Inject [VERIFIED] findings into Claude prompt
4. Claude explains verified facts — never guesses

### What Claude receives:
- Column names and types
- Row count and date ranges
- Numeric min/max ranges
- [VERIFIED] template findings with specific numbers
- The user's question

### What Claude never receives:
- Raw data rows
- Individual customer records
- Personal information
- Transaction details
- Any actual data values

---

## Template Engine Rules

### 42 templates — never modify existing template IDs

```
T01-T08:  Universal (any data)
T09-T22:  German Mittelstand
T23-T30:  Broader verticals
T31:      Budget vs Actual Variance (Soll-Ist-Vergleich)
T32-T42:  Extended verticals (US/UK market, SaaS, logistics, HR)
```

### Bilingual detection is always-on

Never add a "German mode" toggle. German and English patterns run simultaneously
on every dataset. This is a core product feature, not an option.

### Findings strings — quality standard

Every _run_tXX_() method findings list must contain specific numbers.

```python
# CORRECT
findings = [
    "Top 3 customers account for 67% of Umsatz — Klumpenrisiko",
    "ART-003 produces 53.5% of all Ausschuss — concentrated defect source",
    "Durchlaufzeit varies 2.6x between Gehaeuse (4.2 days) and Kolben (1.6 days)",
]

# WRONG — generic, useless
findings = [
    "Revenue is concentrated among customers",
    "Some products have higher defect rates",
    "Lead times vary by product type",
]
```

### Standard chart format — never deviate

```python
chart_data = {
    "chart_type": "bar" | "line" | "scatter" | "histogram",
    "data": [...],
    "x_key": "column_name",
    "y_keys": ["value_column"],
    "title": "Chart title in user's language"
}
```

### AI context function — always call before Claude

```python
def build_ai_context_from_templates(
    df: pd.DataFrame,
    column_profiles: list,
    max_templates: int = 3
) -> str:
    """
    Run top applicable templates and return verified
    facts as structured context for Claude.
    Format: [VERIFIED] {finding}
    """
```

This function must be called before every Claude API call in:
- /api/ask route
- /api/insights/generate route
- /api/studio/suggest route

---

## API Routes

### Next.js API routes (proxies)

| Route | Purpose |
|---|---|
| /api/ask | Ask Data — streaming chat |
| /api/insights/generate | 24h insights generation |
| /api/anomalies | Anomaly detection |
| /api/studio/execute | Execute code cell (file source) |
| /api/studio/execute-db | Execute code cell (live DB) |
| /api/studio/suggest | Generate notebook cells |
| /api/studio/interpret | Interpret execution results |
| /api/studio/proactive | Proactive analysis suggestions |
| /api/studio/notebooks | CRUD for notebooks |
| /api/studio/query-library | Saved query management |
| /api/pipeline/profile | File profiling |
| /api/pipeline/profile-db | Live DB profiling |
| /api/pipeline/transform | Apply transformations |
| /api/pipeline/suggestions | AI transformation suggestions |
| /api/pipeline/validate | Run validation tests |
| /api/pipeline/templates | Template applicable + run |
| /api/pipeline/auto-analysis | Full AutoAnalyzer (17 analyses) |
| /api/pipeline/run-now | Trigger pipeline run |
| /api/pipeline/join/detect | RapidFuzz join key detection |
| /api/pipeline/join/apply | Multi-source merge |
| /api/sources/upload | Upload to Supabase Storage |
| /api/sources/connect | Save DB connection |
| /api/sources/test | Test DB connection |
| /api/sources/query | Run query against source |
| /api/onboarding/complete | Complete onboarding flow |
| /api/onboarding/suggest-metrics | AI metric suggestions |

### Pipeline service endpoints (Railway)

| Endpoint | Purpose |
|---|---|
| POST /profile/file | Full Python profiling |
| POST /profile/database | Live DB profiling |
| POST /transform/apply | 16 transformation operations |
| POST /transform/suggestions | AI suggestions from profile |
| POST /validate/run | 8 validation categories |
| POST /validate/drift | Schema drift detection |
| POST /join/detect | RapidFuzz join key detection |
| POST /join/apply | Multi-source merge |
| POST /analyst/execute | Safe sandboxed Python |
| POST /analyst/execute-db | Live DB code execution |
| POST /analyst/descriptive | Descriptive statistics |
| POST /analyst/correlation | Correlation matrix |
| POST /analyst/regression | Linear/multiple regression |
| POST /analyst/anova | One-way ANOVA |
| POST /analyst/forecast | Time series forecasting |
| POST /analyst/suggest-analysis | NL to Python code |
| POST /auto-analysis/run | Full AutoAnalyzer (17 analyses) |
| POST /templates/applicable | Get matching templates |
| POST /templates/{id}/run | Execute a template |
| POST /onboarding/suggest-metrics | AI metric suggestions |

---

## Database Schema (Supabase)

### Key tables

```
profiles              — user profiles
organizations         — org entity
org_members           — org membership + roles
workspaces            — workspace per org
workspace_members     — workspace access
projects              — analytics project
data_sources          — connected data sources
  file_path                 — raw file in Storage
  cleaned_file_path         — cleaned file after prep
  pipeline_status           — unprepared|ready|scheduled|error
  pipeline_recipe_id        — saved transform recipe
insight_documents     — 24h AI briefings
conversations         — Ask Data conversation history
studio_notebooks      — Studio notebooks
query_library         — saved queries
pipeline_recipes      — saved transform steps
pipeline_run_history  — all pipeline executions
data_profiles         — column profile results
validation_results    — validation test results
data_lineage          — transformation history
anomalies             — detected anomalies
sync_logs             — scheduled sync logs
invitations           — org invite tokens
```

### RLS policy reminder

Every new table MUST have Row Level Security policies.
Users can only access data belonging to their org.
Never skip RLS on a new table.

---

## Supabase Storage

**Bucket:** data-sources (private, RLS enforced)

**File paths:**
```
{userId}/{sourceId}/{filename}           — raw uploaded file
{userId}/{sourceId}/cleaned_{filename}   — cleaned file after prep
```

Access: Always use signed URLs. Never expose bucket directly.

---

## Environment Variables

### Required in .env.local and Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
PIPELINE_SERVICE_URL=https://datalaserai-production.up.railway.app
```

### Required in Railway:

```
ANTHROPIC_API_KEY=
ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
```

---

## Security Rules

### Credentials
- DB credentials encrypted with AES-256-GCM before storage
- Credentials decrypted server-side only — never sent to client
- Decryption only in Railway pipeline service using service role

### Code execution sandbox
- Python execution blocks: os, subprocess, sys, importlib
- No file system access outside designated temp directory
- Execution timeout: 30 seconds maximum
- Memory limit enforced per execution

### Never:
- Send raw credentials to client
- Log credentials in any service
- Store decrypted credentials anywhere
- Allow arbitrary module imports in sandboxed execution

---

## Studio Rules

### Left panel — living notebook
- Cell types: python, sql, r, text, heading
- Dark code editor: #1a1a2e background, #e2e8f0 text
- Auto-save: debounced 2 seconds
- Execution: individual cells or all at once

### Right panel — report renderer
- Code hidden by default (show/hide toggle)
- Charts render as interactive Recharts
- Download options: PDF, .ipynb, .py, HTML
- Cover page auto-generated from notebook title

### Code quality standard for AI-generated notebooks
Claude must generate production-quality code cells:
- Minimum 10-30 lines per code cell
- Proper imports at cell top
- Real statistical methods (not toy examples)
- Result stored in result variable
- Minimum 14 cells for a complete analysis notebook
- Include: data loading, cleaning, EDA, statistical tests, visualization, conclusions

### Execution modes
- File source: Download from Storage, FormData, Railway /analyst/execute
- Live DB source: Decrypt credentials server-side, Railway /analyst/execute-db

---

## Ask Data Rules

### Streaming architecture
1. Templates run, verified context built
2. Claude receives schema + [VERIFIED] facts only
3. Claude writes pandas/SQL code
4. Code executes in pipeline against real data
5. Aggregated result returns
6. Claude interprets in plain English

### Every answer must show source
```
"Based on: Profitability Analysis (T10), Defect Root Cause (T15)"
[View computation]
```

### Source selector
Users can toggle which data sources are included per query.
/api/ask accepts optional source_ids[] filter.
buildDataContext in sampler.ts accepts sourceIds?: string[].

---

## Insights Rules

### This is push, not pull
Insights generate automatically every 24h without user asking.
Do not make Insights reactive only — it must be proactive.

### Generation flow
1. Scheduled job triggers
2. Pipeline runs pre-built queries locally (no Claude for computation)
3. Aggregated numbers, Claude writes narrative
4. User sees briefing

---

## Data Prep Wizard Rules

**5 steps — never skip steps:**
1. Profile — full Python profiler
2. Suggestions — AI-ranked transformations with before/after preview
3. Transform — user selects and applies
4. Validate — 8 test categories
5. Ready — cleaned file saved, recipe stored

**On completion:**
- Save cleaned file to Storage at {userId}/{sourceId}/cleaned_{filename}
- Update data_sources.cleaned_file_path
- Save steps to pipeline_recipes table
- Update data_sources.pipeline_status to ready

buildDataContext always prefers cleaned_file_path over raw sample_data.

---

## Validation Rules

### Outlier detection — skip ID-like columns
Never run outlier detection on columns matching:
ticket|id|code|number|ref|key|index|_id|uuid

### ValidationResult categories
- issue — penalizes quality score
- characteristic — informational, no penalty
- info — metadata, no penalty

Only issue category failures affect the overall score.

---

## Deployment Checklist

### Before deploying to Vercel:
- [ ] All i18n keys present in both en.json and de.json
- [ ] No hardcoded strings in components
- [ ] PIPELINE_SERVICE_URL set in Vercel environment
- [ ] Clean commit with descriptive message
- [ ] Tested locally on both English and German language

### Before deploying to Railway:
- [ ] ANTHROPIC_API_KEY set in Railway variables
- [ ] ALLOWED_ORIGINS includes Vercel URL
- [ ] No new Python dependencies without updating requirements.txt
- [ ] Pipeline service tested locally with: uvicorn main:app --reload
- [ ] Clean commit with descriptive message

---

## What NOT to do — common mistakes

```
NEVER send raw data rows to Claude API
NEVER hardcode any user-facing string
NEVER add translation key to en.json without de.json
NEVER commit with message "fix" or "update"
NEVER push without committing first
NEVER skip RLS policies on new Supabase tables
NEVER import os/subprocess in sandboxed Python execution
NEVER store decrypted credentials outside Railway service
NEVER skip the template engine before Claude API calls
NEVER generate toy 2-line code cells in Studio
NEVER break the 5-step Data Prep wizard sequence
NEVER allow pipeline_status to stay unprepared after successful prep
NEVER skip the i18n checklist before committing
```

---

## Sprint Reference

| Sprint | Status | Description |
|---|---|---|
| Sprint 1 | Complete | AutoAnalyzer — 17 analyses, zero AI calls |
| Sprint 2 | Complete | 42 industry templates (bilingual DE/EN detection) |
| Sprint 2.5 | Complete | build_ai_context_from_templates() bridge |
| Sprint 3 | Complete | 18 chart types + drill-down (histogram, heatmap, gauge) |
| Sprint 4 | Complete | Auto-Analysis Insights page |
| Sprint 5 | Complete | Complete i18n — 400+ keys, all pages translated DE/EN |
| Sprint 6 | Complete | Landing page redesign (GLSL Hills, bento features, testimonials) |
| Sprint 7 | Complete | Multi-tenant navigation (personal + team routes) |
| Sprint 8 | Complete | Onboarding wizard (setup → connect → calibrate) |
| Sprint 9 | Complete | UI modernization — design token scale-up |
| Sprint 10 | Planned | Dashboard builder |
| Sprint 11 | Planned | Anomaly detection alerts (Slack/email) |
| Sprint 12 | Planned | SSO / SAML |
| Sprint 13 | Planned | Playwright test suite |

---

## Competitive Context

| Capability | Power BI | ThoughtSpot | Tableau | DataLaser |
|---|---|---|---|---|
| Distribution profiling | No | No | No | Yes |
| Chi-square associations | No | No | No | Yes |
| Bilingual detection | No | No | No | Yes |
| Industry templates (42) | No | No | No | Yes |
| Works without AI | No | No | No | Yes |
| Verified context (no hallucination) | No | No | No | Yes |
| Total score | 12/20 | 14/20 | 8/20 | 20/20 |

---

Last updated: March 24, 2026
This file is the source of truth for all DataLaser development decisions.
When in doubt — read this file first.