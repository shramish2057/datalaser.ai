# TESTING.md — DataLaser Complete Test Suite

This file instructs the Claude Code agent to implement a comprehensive test suite
covering unit, integration, and E2E tests for every feature in DataLaser.

Read this fully before writing a single line of test code.

---

## Setup Before Writing Any Tests

### 1. Test environment requirements

Create a separate Supabase project for testing. Never run tests against production.

```
TEST_SUPABASE_URL=https://your-test-project.supabase.co
TEST_SUPABASE_ANON_KEY=your-test-anon-key
TEST_SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key
TEST_PIPELINE_SERVICE_URL=http://localhost:8000
TEST_ANTHROPIC_API_KEY=your-test-key
```

Create .env.test in project root. Never commit this file.

### 2. Install testing dependencies

Frontend:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test playwright
npm install -D msw (for API mocking)
npx playwright install
```

Pipeline service:
```bash
pip install pytest pytest-asyncio httpx pytest-cov faker --break-system-packages
```

### 3. Test data files — create these before writing tests

Create /tests/fixtures/ directory with:
```
titanic.csv          — 891 rows, mixed types, known quality issues
german_sales.csv     — German headers: Umsatz, Kosten, Kunde, Produkt, Datum
manufacturing.csv    — German: Artikel, Ausschuss, Maschine, Lieferzeit, Menge
simple_numeric.csv   — 3 numeric columns, 100 rows, no nulls
messy_data.csv       — nulls, wrong types, duplicates, outliers
large_file.csv       — 10,000 rows for performance testing
sample.xlsx          — Excel with multiple sheets
sample.json          — JSON array format
```

### 4. Test database seed

Create /tests/seed.ts:
- One test organization
- One test workspace
- One test project
- One test user (confirmed email)
- Run before E2E tests, clean up after

---

## Part 1 — Unit Tests

### Existing tests (already implemented)

These test files already exist in the codebase:

1. src/lib/vault/vault.test.ts - Encryption round-trip, tampered data detection, unicode handling
2. src/lib/adapters/adapters.test.ts - Adapter factory, interface contract, live Postgres tests
3. src/lib/ai/ai.test.ts - Claude API integration with mock data
4. src/lib/ai/ai.dryrun.test.ts - Sandbox dry run verification
5. src/app/api/sources/sources.test.ts - Sources API endpoint tests

DO NOT rewrite these. Extend them as needed.

### Frontend unit tests (Vitest)

Location: src/__tests__/

#### sampler.ts tests
File: src/__tests__/lib/sampler.test.ts

Test these functions:
```
buildDataContext():
  - Returns schema only, never raw rows
  - Includes column names and types
  - Includes row count
  - Includes date range if date column present
  - Includes verified template findings when available
  - Returns empty string gracefully if no sources
  - Prefers cleaned_file_path over raw sample_data
  - Accepts optional sourceIds filter
  - Returns only specified sources when sourceIds provided

CRITICAL TEST:
  const context = buildDataContext(sources)
  expect(context).not.toContain(rawDataRow.customer_name)
  expect(context).not.toContain(rawDataRow.revenue.toString())
  // Raw data must never appear in context
```

#### bootstrap.ts tests
File: src/__tests__/lib/bootstrap.test.ts

Test:
```
createOrganization():
  - Creates org with correct slug
  - Creates default workspace
  - Creates org_member record with owner role
  - Handles duplicate slug gracefully

createProject():
  - Creates project under correct workspace
  - Sets default analysis_mode
  - Returns project with id

generateSlug():
  - Converts spaces to hyphens
  - Lowercases everything
  - Removes special characters
  - Handles German characters (ü→u, ä→a, ö→o)
```

#### i18n tests
File: src/__tests__/i18n/translations.test.ts

```
CRITICAL TESTS:
  - Every key in en.json exists in de.json
  - Every key in de.json exists in en.json
  - No empty string values in either file
  - No keys with value "TODO" in production build
  - Total key count matches between files

Run this test on every commit. Fail fast on missing translations.
```

#### formatNumber.ts tests
File: src/__tests__/lib/formatNumber.test.ts

```
formatNumber():
  - Formats with German locale: 1234.56 -> "1.234,56"
  - Formats with English locale: 1234.56 -> "1,234.56"
  - Abbreviates large numbers: 1500000 -> "1.5M"
  - Formats currency with symbol: "EUR 1.234,56"
  - Formats percentage: 0.186 -> "18.6%"
  - Handles compact mode for small screens
  - Handles sign option (always show +/-)
  - Returns "0" for null/undefined/NaN

smartFormat():
  - Auto-detects appropriate format for value range
  - Uses compact for values > 10000
  - Uses percentage for values 0-1 with percent hint

formatDate():
  - German format: "24. Marz 2026"
  - English format: "March 24, 2026"
  - Handles invalid dates gracefully

formatRelativeTime():
  - "vor 2 Stunden" for German locale
  - "2 hours ago" for English locale
```

#### engineContext.ts tests
File: src/__tests__/lib/ai/engineContext.test.ts

```
getEngineContext():
  - Fetches analysis context for a source
  - Returns [VERIFIED] prefixed findings
  - Never includes raw data values
  - Handles missing source gracefully
  - Caches results for repeated calls

formatFactsForPrompt():
  - Includes GERMAN_PROMPT_BLOCK when locale is 'de'
  - Formats findings with [VERIFIED] prefix
  - Limits total context size
```

#### claude.ts tests
File: src/__tests__/lib/ai/claude.test.ts

```
generateInsights():
  - Returns structured insight object
  - Includes chart_data when applicable
  - Handles streaming correctly
  - Respects locale for response language

generateAsk():
  - Streams response tokens
  - Includes source attribution
  - Handles follow-up context

CRITICAL: Mock Anthropic API, never make real API calls in tests.
```

#### navigation.ts tests
File: src/__tests__/lib/navigation.test.ts

```
projectUrl():
  - Returns /projects/{id} for personal
  - Returns /{org}/{ws}/{slug} for team

workspaceUrl():
  - Returns correct path with tab parameter

orgUrl():
  - Returns /{orgSlug} with optional tab

newProjectUrl():
  - Returns correct path for personal vs team
```

#### dataQuality.ts tests
File: src/__tests__/lib/dataQuality.test.ts

```
assessDataQuality():
  - Returns correct severity for missing values (>50% = red, >20% = amber, >5% = yellow)
  - Detects mixed types in numeric columns
  - Detects format inconsistencies in date columns
  - Detects high cardinality
  - Calculates overall quality score correctly
  - canProceed is false when red warnings exist
```

#### findingsMap.ts tests
File: src/__tests__/lib/i18n/findingsMap.test.ts

```
translateFinding():
  - Translates "Top 3 customers account for 67%" correctly to German
  - Preserves numbers in translation
  - Preserves column names in translation
  - Handles all 45+ regex patterns
  - Returns original string if no pattern matches
  - Handles German special characters in column names
```

#### Component tests
File: src/__tests__/components/

```
InteractiveChart.tsx:
  - Renders bar chart from chart_data
  - Renders line chart from chart_data
  - Renders area, pie, donut, scatter, stacked bar, funnel chart types
  - Renders histogram, heatmap, combo, waterfall, gauge, radar chart types
  - Handles empty data gracefully
  - Shows error state on invalid data
  - Drill-down panel opens on bar click
  - Download as PNG works
  - Fullscreen toggle works
  - Locale-aware axis formatting (de-DE vs en-US)

KPICard.tsx:
  - Renders KPI value and label
  - Shows trend indicator (up/down/flat)
  - Formats numbers with locale
  - Handles null/undefined values

Logo.tsx:
  - Renders at sm/md/lg sizes
  - Renders as link when href provided
  - Renders as span when no href

LocaleToggle.tsx:
  - Toggles between DE and EN
  - Sets cookie on toggle
  - Reflects current locale state

ProjectIconPicker.tsx:
  - Renders all available icons
  - Highlights selected icon
  - Calls onChange on selection

DataQualityBanner.tsx:
  - Shows correct color for quality score (green >80, amber 50-80, red <50)
  - Displays issue count
  - Links to health page

StepIndicator.tsx:
  - Renders correct number of steps
  - Highlights current step
  - Shows completed steps with checkmark
```

---

### Pipeline service unit tests (pytest)

Location: pipeline-service/tests/

#### Profiler tests
File: pipeline-service/tests/test_profiler.py

```python
def test_profile_titanic_csv():
    # Upload titanic.csv
    # Assert: 891 rows detected
    # Assert: quality_score between 60-70
    # Assert: Cabin column flagged as high null rate
    # Assert: Age column flagged as medium null rate
    # Assert: semantic roles assigned correctly

def test_profile_german_csv():
    # Upload german_sales.csv
    # Assert: Umsatz detected as measure role
    # Assert: Kunde detected as dimension role
    # Assert: Datum detected as date role
    # Assert: bilingual patterns match correctly

def test_profile_detects_encoding():
    # Upload CSV with Latin-1 encoding
    # Assert: encoding detected correctly
    # Assert: German characters preserved (ü, ä, ö)

def test_profile_empty_file():
    # Upload empty CSV
    # Assert: returns error gracefully
    # Assert: no server crash

def test_profile_large_file():
    # Upload 10,000 row CSV
    # Assert: completes within 30 seconds
    # Assert: memory usage stays reasonable
```

#### Transformer tests
File: pipeline-service/tests/test_transformer.py

Test all 16 operations:
```python
def test_fill_nulls_median():
def test_fill_nulls_mean():
def test_fill_nulls_mode():
def test_fill_nulls_constant():
def test_cast_type_float_to_int():
def test_cast_type_string_to_date():
def test_normalize_dates_german_format():
    # DD.MM.YYYY → ISO format
def test_deduplicate_exact():
def test_deduplicate_fuzzy():
def test_clip_outliers_iqr():
def test_split_column():
def test_merge_columns():
def test_regex_replace():
def test_one_hot_encode():
def test_drop_column():
def test_rename_column():

# CRITICAL: each test must verify source data not mutated
def test_transform_does_not_mutate_source():
    original = load_df()
    original_hash = hash(original.to_string())
    apply_transform(original, operation)
    assert hash(original.to_string()) == original_hash
```

#### Validator tests
File: pipeline-service/tests/test_validator.py

```python
def test_validates_completeness():
def test_validates_uniqueness():
def test_validates_type_consistency():
def test_validates_value_ranges():
def test_validates_categorical_validity():
def test_validates_date_validity():
def test_validates_pattern_matching():
def test_detects_schema_drift():

def test_skips_outliers_on_id_columns():
    # Columns matching ticket|id|code|number|ref
    # Must not have outlier detection run on them
    df = pd.DataFrame({'order_id': range(1000)})
    result = validate(df)
    assert not any('outlier' in f.lower() 
                   for f in result.findings 
                   if 'order_id' in f)

def test_scoring_penalizes_only_issues():
    # characteristic and info categories
    # must not reduce quality score
```

#### Template engine tests
File: pipeline-service/tests/test_templates.py

```python
def test_universal_templates_apply_to_any_data():
    # T01-T08 must appear for any CSV with 3+ columns
    result = get_applicable(any_column_profiles)
    template_ids = [t.template_id for t in result]
    for t in ['T01','T02','T03','T04']:
        assert t in template_ids

def test_german_templates_detect_german_headers():
    # Upload CSV with: Umsatz, Kosten, Kunde, Produkt
    profiles = profile_columns(['Umsatz','Kosten','Kunde','Produkt'])
    result = get_applicable(profiles)
    ids = [t.template_id for t in result]
    assert 'T09' in ids  # Revenue Driver
    assert 'T10' in ids  # Profitability
    assert 'T13' in ids  # Customer Concentration

def test_bilingual_detection_english_headers():
    # Same as above but English headers
    profiles = profile_columns(['revenue','cost','customer','product'])
    result = get_applicable(profiles)
    ids = [t.template_id for t in result]
    assert 'T09' in ids
    assert 'T10' in ids

def test_confidence_scoring():
    # Role match + name match = higher confidence
    # Role match only = lower confidence
    # Threshold 0.3 minimum to appear

def test_findings_contain_specific_numbers():
    # CRITICAL: findings must not be generic
    result = run_template('T10', df, profiles)
    for finding in result.findings:
        # Must contain at least one number
        assert any(char.isdigit() for char in finding), \
            f"Finding has no numbers: {finding}"

def test_t31_budget_variance():
    # Upload CSV with: budget/soll + actual/ist
    # T31 must detect and run correctly
    # Variance = actual - budget computed correctly

def test_build_ai_context_from_templates():
    # Must return [VERIFIED] prefixed findings
    context = build_ai_context_from_templates(df, profiles)
    assert '[VERIFIED]' in context
    # Must never contain raw data rows
    for row_value in df.values.flatten():
        assert str(row_value) not in context

def test_auto_analyzer_17_analyses():
    # AutoAnalyzer must complete all 17 analyses
    result = auto_analyzer.run(df)
    assert len(result.analyses) >= 17
    assert len(result.top_insights) >= 5
    # Zero AI calls made during execution
    # (mock Anthropic API and assert not called)
```

#### Analyst service tests
File: pipeline-service/tests/test_analyst.py

```python
def test_execute_code_returns_result():
    # Simple pandas operation
    # Assert: result contains expected output
def test_execute_db_query():
    # SQL against test database
    # Assert: results match expected
def test_descriptive_statistics():
    # Assert: mean, median, std, skew, kurtosis correct
def test_correlation_matrix():
    # Assert: Pearson and Spearman computed correctly
def test_regression_analysis():
    # Assert: coefficients and R-squared returned
def test_anova_analysis():
    # Assert: F-statistic and p-value returned
def test_forecast_timeseries():
    # Assert: forecast values and confidence intervals returned
def test_suggest_analysis_from_nl():
    # Natural language to Python code
    # Assert: valid Python returned
```

#### Suggester tests
File: pipeline-service/tests/test_suggester.py

```python
def test_suggests_fill_for_null_columns():
    # Column with 30% nulls
    # Assert: fill suggestion generated with correct strategy
def test_suggests_type_cast_for_mixed_types():
    # Column with mixed numeric/string
    # Assert: cast suggestion generated
def test_confidence_scoring():
    # Assert: high-null column gets higher confidence than low-null
def test_preview_accuracy():
    # Assert: before/after preview matches actual transform
```

#### Joiner tests
File: pipeline-service/tests/test_joiner.py

```python
def test_detect_join_keys_by_name():
    # Two dataframes with customer_id column
    # Assert: customer_id detected as join key
def test_detect_join_keys_by_cardinality():
    # Columns with matching unique values
    # Assert: detected even if names differ
def test_apply_inner_join():
def test_apply_left_join():
def test_apply_right_join():
def test_handles_type_mismatch():
    # int vs string IDs
    # Assert: graceful error or auto-cast
```

#### File handler tests
File: pipeline-service/tests/test_file_handler.py

```python
def test_detect_csv_format():
def test_detect_excel_format():
def test_detect_json_format():
def test_detect_encoding_utf8():
def test_detect_encoding_latin1():
def test_handle_german_characters():
    # u-umlaut, a-umlaut, o-umlaut, eszett preserved
def test_temp_file_cleanup():
    # Assert: no temp files left after processing
def test_reject_oversized_file():
```

#### Security tests
File: pipeline-service/tests/test_security.py

```python
def test_blocks_os_module():
    code = "import os; os.listdir('/')"
    result = execute_code(code)
    assert result.success == False
    assert 'blocked' in result.error.lower()

def test_blocks_subprocess():
    code = "import subprocess; subprocess.run(['ls'])"
    result = execute_code(code)
    assert result.success == False

def test_blocks_sys_module():
    code = "import sys; sys.exit(0)"
    result = execute_code(code)
    assert result.success == False

def test_execution_timeout():
    code = "while True: pass"
    result = execute_code(code)
    assert result.success == False
    assert result.duration_seconds < 35

def test_no_file_system_access():
    code = "open('/etc/passwd', 'r').read()"
    result = execute_code(code)
    assert result.success == False
```

### Middleware tests
File: src/__tests__/middleware.test.ts

#### Locale detection
  - Cookie preference persists across requests
  - Accept-Language header "de" sets German locale
  - Accept-Language header "en-US" sets English locale
  - Default to English when no cookie and no Accept-Language
  - Cookie set with 365-day expiry
  - Locale cookie name is correct

#### Route redirects
  - /login redirects to /{locale}/login
  - /signup redirects to /{locale}/signup
  - Redirect respects locale cookie
  - Redirect respects Accept-Language if no cookie

#### Protected route access
  - Unauthenticated access to /projects returns redirect to login
  - Unauthenticated access to /settings returns redirect to login
  - Unauthenticated access to /onboarding returns redirect to login
  - Unauthenticated access to /app/* returns redirect to login
  - Unauthenticated access to /{orgSlug}/workspace returns redirect to login
  - next param preserves intended URL through login flow
  - Public routes (/, /en, /de, /auth/callback) do NOT redirect

#### Authenticated user home detection
  - dl_home cache cookie hit returns instant redirect (no DB query)
  - dl_home cache miss queries org_members table
  - Personal org user redirects to /projects
  - Team org user redirects to /{orgSlug}
  - Cache set with 1-hour expiry
  - Logout clears dl_home cookie

---

## Part 2 — Integration Tests

### API route integration tests

Location: src/__tests__/api/

#### Ask Data API
File: src/__tests__/api/ask.test.ts

```typescript
describe('POST /api/ask', () => {
  test('returns streaming response', async () => {})
  test('calls templates before Claude', async () => {})
  test('never sends raw data rows to Claude', async () => {
    // Mock Anthropic API
    // Capture what was sent to Claude
    // Assert no raw data values present
  })
  test('filters by source_ids when provided', async () => {})
  test('saves conversation to database', async () => {})
  test('handles empty sources gracefully', async () => {})
  test('returns chart data in [CHART] blocks', async () => {})
  test('requires authentication', async () => {
    // No auth header → 401
  })
})
```

#### Insights API
File: src/__tests__/api/insights.test.ts

```typescript
describe('POST /api/insights/generate', () => {
  test('generates insights from live data', async () => {})
  test('templates run before Claude narrative', async () => {})
  test('saves to insight_documents table', async () => {})
  test('filters by source_ids when provided', async () => {})
  test('requires authentication', async () => {})
})
```

#### Pipeline proxy routes
File: src/__tests__/api/pipeline.test.ts

```typescript
describe('Pipeline proxy routes', () => {
  test('POST /api/pipeline/profile proxies correctly', async () => {})
  test('POST /api/pipeline/transform proxies correctly', async () => {})
  test('POST /api/pipeline/validate proxies correctly', async () => {})
  test('POST /api/pipeline/templates proxies correctly', async () => {})
  test('Returns 503 when pipeline service down', async () => {})
  test('Passes auth headers correctly', async () => {})
})
```

#### Sources API
File: src/__tests__/api/sources.test.ts

```typescript
describe('Sources API', () => {
  test('POST /api/sources/upload saves to correct storage path', async () => {
    // Path must be {userId}/{sourceId}/{filename}
  })
  test('Updates data_sources record after upload', async () => {})
  test('Rejects files over size limit', async () => {})
  test('Accepts CSV, Excel, JSON formats', async () => {})
  test('Rejects unsupported formats', async () => {})
})
```

#### Anomalies API
File: src/__tests__/api/anomalies.test.ts

```typescript
describe('GET /api/anomalies', () => {
  test('returns anomalies for project sources', async () => {})
  test('filters by severity threshold', async () => {})
  test('requires authentication', async () => {})
})
```

#### Pipeline Auto-Analysis API
File: src/__tests__/api/pipeline-auto-analysis.test.ts

```typescript
describe('POST /api/pipeline/auto-analysis', () => {
  test('runs all 17 analyses and returns structured results', async () => {})
  test('completes within 30 seconds for 1000-row dataset', async () => {})
  test('returns zero AI calls made (pure computation)', async () => {})
  test('handles missing columns gracefully', async () => {})
})
```

#### Pipeline Join API
File: src/__tests__/api/pipeline-join.test.ts

```typescript
describe('POST /api/pipeline/join/detect', () => {
  test('detects foreign keys between two sources', async () => {})
  test('returns confidence scores for join candidates', async () => {})
  test('handles type mismatches gracefully', async () => {})
})

describe('POST /api/pipeline/join/apply', () => {
  test('merges two sources on detected keys', async () => {})
  test('handles left/right/inner join types', async () => {})
})
```

#### Pipeline Profile DB API
File: src/__tests__/api/pipeline-profile-db.test.ts

```typescript
describe('POST /api/pipeline/profile-db', () => {
  test('profiles live PostgreSQL database', async () => {})
  test('profiles live MySQL database', async () => {})
  test('decrypts credentials before profiling', async () => {})
  test('returns column metadata and quality score', async () => {})
})
```

#### Pipeline Run-Now API
File: src/__tests__/api/pipeline-run-now.test.ts

```typescript
describe('POST /api/pipeline/run-now', () => {
  test('triggers pipeline recipe execution', async () => {})
  test('updates pipeline_status during run', async () => {})
  test('stores results in pipeline_run_history', async () => {})
})
```

#### Pipeline Suggestions API
File: src/__tests__/api/pipeline-suggestions.test.ts

```typescript
describe('POST /api/pipeline/suggestions', () => {
  test('returns AI transformation suggestions with confidence', async () => {})
  test('includes before/after preview for each suggestion', async () => {})
})
```

#### Sources Test API
File: src/__tests__/api/sources-test.test.ts

```typescript
describe('POST /api/sources/test', () => {
  test('validates PostgreSQL connection', async () => {})
  test('validates MySQL connection', async () => {})
  test('returns error for invalid credentials', async () => {})
  test('times out after 10 seconds', async () => {})
})
```

#### Sources Query API
File: src/__tests__/api/sources-query.test.ts

```typescript
describe('POST /api/sources/query', () => {
  test('executes SQL query against source', async () => {})
  test('returns paginated results', async () => {})
  test('rejects dangerous SQL (DROP, DELETE, ALTER)', async () => {})
  test('enforces query timeout', async () => {})
})
```

#### Studio Interpret API
File: src/__tests__/api/studio-interpret.test.ts

```typescript
describe('POST /api/studio/interpret', () => {
  test('interprets code execution output', async () => {})
  test('generates visualization hints from output', async () => {})
})
```

#### Studio Query Library API
File: src/__tests__/api/studio-query-library.test.ts

```typescript
describe('POST /api/studio/query-library', () => {
  test('saves query to library', async () => {})
  test('lists saved queries for project', async () => {})
  test('increments use_count on execution', async () => {})
  test('deletes query from library', async () => {})
})
```

#### Studio Proactive API
File: src/__tests__/api/studio-proactive.test.ts

```typescript
describe('POST /api/studio/proactive', () => {
  test('generates proactive analysis suggestions', async () => {})
  test('suggestions based on data profile', async () => {})
})
```

#### Onboarding APIs
File: src/__tests__/api/onboarding.test.ts

```typescript
describe('POST /api/onboarding/complete', () => {
  test('creates org, workspace, and project', async () => {})
  test('assigns owner role to user', async () => {})
  test('stores uploaded files to correct path', async () => {})
  test('triggers initial profiling', async () => {})
})

describe('POST /api/onboarding/suggest-metrics', () => {
  test('returns AI metric suggestions from uploaded file', async () => {})
  test('detects business domain from column names', async () => {})
  test('returns dimensions and measures separately', async () => {})
})
```

### Supabase RLS integration tests
File: pipeline-service/tests/test_rls.py

```python
def test_user_cannot_access_other_org_data():
    # User A creates project
    # User B (different org) tries to query it
    # Assert: returns empty, not 403
    # (RLS silently filters, not errors)

def test_org_member_can_access_org_data():
    # Invite user to org
    # User can see org projects

def test_owner_can_delete_workspace():
def test_viewer_cannot_delete_workspace():
def test_storage_rls_enforced():
    # User cannot access other user's files
    # Even with direct storage URL
```

---

## Part 3 — E2E Tests (Playwright)

Location: tests/e2e/

Configuration: tests/e2e/playwright.config.ts
```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run sequentially to avoid Supabase conflicts
  retries: 2,
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
```

### Auth flows

#### Register
File: tests/e2e/auth/register.spec.ts

```typescript
test('complete registration flow', async ({ page }) => {
  // Go to /register
  // Fill email, password, name
  // Submit
  // Assert: redirect to /projects or onboarding
  // Assert: profile created in Supabase
  // Assert: confirmation email sent (mock)
})

test('register with existing email shows error', async ({ page }) => {})
test('weak password shows validation error', async ({ page }) => {})
test('all error messages appear in correct language', async ({ page }) => {})
```

#### Login
File: tests/e2e/auth/login.spec.ts

```typescript
test('login with valid credentials', async ({ page }) => {
  // Fill email and password
  // Submit
  // Assert: redirect to /projects
  // Assert: user session established
})

test('login with wrong password shows error', async ({ page }) => {})
test('login redirects to intended page after auth', async ({ page }) => {})
test('logout clears session', async ({ page }) => {})
test('protected routes redirect to login', async ({ page }) => {
  // Visit /projects without auth
  // Assert: redirect to /login
})
```

### Data source upload flows

#### CSV upload
File: tests/e2e/sources/upload_csv.spec.ts

```typescript
test('upload CSV and redirect to health page', async ({ page }) => {
  // Login
  // Go to /projects/[id]/sources
  // Click "Add data source"
  // Select "Upload file"
  // Upload titanic.csv
  // Assert: progress indicator shown
  // Assert: redirect to /health page
  // Assert: quality score displayed
  // Assert: column list shown
  // Assert: "Clean & prepare" CTA visible
})

test('upload CSV with German headers', async ({ page }) => {
  // Upload german_sales.csv
  // Assert: Umsatz detected as revenue measure
  // Assert: German templates suggested
})

test('upload invalid file type shows error', async ({ page }) => {
  // Try to upload .pdf
  // Assert: error message in correct language
})

test('upload oversized file shows error', async ({ page }) => {})
```

#### Excel upload
File: tests/e2e/sources/upload_excel.spec.ts

```typescript
test('upload Excel file successfully', async ({ page }) => {
  // Upload sample.xlsx
  // Assert: file processed correctly
  // Assert: sheet selection shown if multiple sheets
  // Assert: redirects to health page
})

test('Excel with multiple sheets prompts sheet selection', async ({ page }) => {})
```

#### JSON upload
File: tests/e2e/sources/upload_json.spec.ts

```typescript
test('upload JSON array file successfully', async ({ page }) => {
  // Upload sample.json
  // Assert: parsed correctly
  // Assert: columns detected
})

test('upload nested JSON shows flattening option', async ({ page }) => {})
```

#### Bulk upload
File: tests/e2e/sources/upload_bulk.spec.ts

```typescript
test('upload multiple files at once', async ({ page }) => {
  // Select 3 CSV files
  // Assert: all 3 processed
  // Assert: 3 data sources created
  // Assert: each has health page
})
```

#### Database connectors
File: tests/e2e/sources/connect_postgres.spec.ts

```typescript
test('connect PostgreSQL database', async ({ page }) => {
  // Click "Connect database"
  // Select PostgreSQL
  // Fill connection form:
  //   host, port, database, username, password
  // Click "Test connection"
  // Assert: success message
  // Click "Save"
  // Assert: source created with live DB type
  // Assert: pipeline_status = ready
  // Assert: schema detected
})

test('invalid PostgreSQL credentials shows error', async ({ page }) => {
  // Fill wrong password
  // Assert: "Connection failed" in correct language
  // Assert: no source created
})

test('connect MySQL database', async ({ page }) => {})
test('connect MongoDB database', async ({ page }) => {})

test('credentials encrypted in storage', async ({ page }) => {
  // After connecting DB
  // Query Supabase directly
  // Assert: credentials are encrypted string not plaintext
})
```

### Data health flow

File: tests/e2e/health/health_check.spec.ts

```typescript
test('health page shows complete profile', async ({ page }) => {
  // Navigate to /projects/[id]/sources/[id]/health
  // Assert: quality score displayed (0-100)
  // Assert: column-by-column breakdown shown
  // Assert: red/amber/green indicators correct
  // Assert: "Clean & prepare" CTA present
  // Assert: "Skip, explore as-is" CTA present
})

test('clean and prepare CTA navigates to prep wizard', async ({ page }) => {
  // Click "Clean & prepare"
  // Assert: navigates to /prep/[sourceId]
  // Assert: Step 1 (Profile) active
})

test('skip explore CTA navigates to Ask Data', async ({ page }) => {
  // Click "Skip, explore as-is"
  // Assert: navigates to /ask
})

test('quality score color coding correct', async ({ page }) => {
  // Score > 80 = green
  // Score 50-80 = amber
  // Score < 50 = red
})
```

### Data prep wizard — complete flow

File: tests/e2e/prep/complete_wizard.spec.ts

```typescript
test('complete 5-step wizard end to end', async ({ page }) => {
  // Navigate to /projects/[id]/prep/[sourceId]
  
  // STEP 1: Profile
  // Assert: step indicator shows Step 1 active
  // Assert: quality score displayed
  // Assert: column profiles shown
  // Assert: warnings listed
  // Click "Next"
  
  // STEP 2: Suggestions
  // Assert: AI suggestions listed with confidence scores
  // Assert: before/after preview available
  // Assert: each suggestion has accept/reject button
  // Accept 2 suggestions
  // Click "Next"
  
  // STEP 3: Transform
  // Assert: accepted suggestions shown as transform steps
  // Assert: manual transform operations available
  // Apply one manual transform (fill nulls with median)
  // Assert: preview updates correctly
  // Click "Apply & Continue"
  
  // STEP 4: Validate
  // Assert: 8 test categories shown
  // Assert: overall status shown
  // Assert: score improved from Step 1
  // Assert: no "issue" category failures remain
  // Click "Next"
  
  // STEP 5: Ready
  // Assert: success state shown
  // Assert: cleaned file saved (cleaned_file_path set)
  // Assert: pipeline_recipe saved
  // Assert: pipeline_status = ready
  // Assert: CTA to Ask Data present
})

test('each step validates before proceeding', async ({ page }) => {
  // Try to skip Step 1 by URL manipulation
  // Assert: redirected back to Step 1
})

test('wizard saves progress if user navigates away', async ({ page }) => {})

test('pipeline recipe saves correctly', async ({ page }) => {
  // Complete wizard
  // Assert: recipe in pipeline_recipes table
  // Assert: recipe can be re-run
})
```

Individual step tests:
File: tests/e2e/prep/profile_step.spec.ts
File: tests/e2e/prep/suggestions_step.spec.ts
File: tests/e2e/prep/transform_step.spec.ts
File: tests/e2e/prep/validate_step.spec.ts

### Ask Data — complete flow

File: tests/e2e/ask/ask_complete.spec.ts

```typescript
test('ask a simple question and get answer', async ({ page }) => {
  // Navigate to /projects/[id]/ask
  // Type: "What are the top 5 values by revenue?"
  // Submit
  // Assert: streaming indicator shown
  // Assert: response appears (streaming)
  // Assert: response contains specific numbers
  // Assert: response shows "Based on:" source attribution
  // Assert: conversation saved
})

test('ask question returns chart', async ({ page }) => {
  // Type: "Show me revenue by category as a bar chart"
  // Submit
  // Assert: [CHART] block rendered as Recharts component
  // Assert: chart is interactive (hover shows tooltip)
  // Assert: chart has correct title and labels
})

test('ask follow-up question maintains context', async ({ page }) => {
  // Ask first question
  // Ask follow-up: "What about just the top 3?"
  // Assert: response understands context from first question
})

test('source selector filters correctly', async ({ page }) => {
  // Multiple sources connected
  // Deselect one source
  // Ask question
  // Assert: only selected sources used in answer
})

test('conversation history persists across sessions', async ({ page }) => {
  // Ask question
  // Navigate away
  // Return to Ask page
  // Assert: previous conversation visible
})

test('CRITICAL: raw data never shown in response', async ({ page }) => {
  // Ask general question
  // Assert: individual customer names not in response
  // Assert: individual transaction IDs not in response
  // Assert: PII not in response
})
```

### Insights — complete flow

File: tests/e2e/insights/insights_complete.spec.ts

```typescript
test('insights page shows auto-generated briefing', async ({ page }) => {
  // Navigate to /projects/[id]/insights
  // Assert: briefing text present
  // Assert: specific numbers in briefing (not generic)
  // Assert: source attribution shown
  // Assert: timestamp shown
})

test('regenerate insights with specific sources', async ({ page }) => {
  // Click source selector
  // Deselect one source
  // Click "Regenerate"
  // Assert: new briefing generated
  // Assert: only selected sources referenced
})

test('insights contain verified numbers', async ({ page }) => {
  // Assert: at least one percentage in briefing
  // Assert: at least one specific metric mentioned
  // Not just: "revenue is good" 
  // But: "revenue up 14% vs yesterday"
})

test('24h auto-generation creates new insight', async ({ page }) => {
  // This tests the scheduled job
  // Mock: advance time by 24 hours
  // Assert: new insight_document created
  // Assert: previous insight preserved in history
})
```

### Studio — complete flow

File: tests/e2e/studio/studio_complete.spec.ts

```typescript
test('create new notebook', async ({ page }) => {
  // Navigate to /projects/[id]/studio
  // Click "New notebook"
  // Assert: notebook created with default title
  // Assert: navigates to /studio/[notebookId]
  // Assert: left panel (notebook) visible
  // Assert: right panel (report) visible
})

test('generate notebook from description', async ({ page }) => {
  // In Ask Claude input type:
  //   "Analyse the relationship between Fare and Pclass in the Titanic dataset"
  // Submit
  // Assert: minimum 14 cells generated
  // Assert: cells include: heading, text, python, text
  // Assert: python cells have minimum 10 lines each
  // Assert: imports present in first python cell
})

test('run single python cell', async ({ page }) => {
  // Click run button on a python cell
  // Assert: loading indicator shown
  // Assert: output appears below cell
  // Assert: output is not empty
  // Assert: no error in output
})

test('run all cells in sequence', async ({ page }) => {
  // Click "Run all"
  // Assert: cells execute in order
  // Assert: all cells complete
  // Assert: right panel updates with results
})

test('right panel renders as report', async ({ page }) => {
  // After running cells
  // Assert: headings render as prose headings
  // Assert: code hidden by default
  // Assert: outputs visible as formatted tables/charts
  // Assert: cover page present with notebook title
})

test('export as PDF', async ({ page }) => {
  // Click "Download PDF"
  // Assert: PDF download starts
  // Assert: PDF contains notebook title
})

test('export as Jupyter notebook', async ({ page }) => {
  // Click "Download .ipynb"
  // Assert: .ipynb file downloads
  // Assert: valid JSON structure
})

test('auto-save works', async ({ page }) => {
  // Type in a text cell
  // Wait 3 seconds (debounce)
  // Navigate away
  // Return to notebook
  // Assert: changes preserved
})

test('notebook works with live database source', async ({ page }) => {
  // Connect PostgreSQL source
  // Create notebook
  // Run SQL cell against live DB
  // Assert: results from fresh DB query
  // Assert: not from cached data
})
```

### Template detection flow

File: tests/e2e/templates/template_detection.spec.ts

```typescript
test('universal templates detected for any CSV', async ({ page }) => {
  // Upload simple_numeric.csv
  // Navigate to template page
  // Assert: T01-T04 all visible in applicable list
})

test('German templates detected for German headers', async ({ page }) => {
  // Upload german_sales.csv (Umsatz, Kosten, Kunde)
  // Assert: T09 Revenue Driver visible
  // Assert: T10 Profitability visible
  // Assert: T13 Customer Concentration visible
  // Assert: confidence scores shown
})

test('run template and see results', async ({ page }) => {
  // Click T10 (Profitability Analysis)
  // Click "Run"
  // Assert: loading indicator
  // Assert: results shown with specific numbers
  // Assert: chart rendered
  // Assert: findings list not generic (contains numbers)
})

test('manufacturing templates for manufacturing CSV', async ({ page }) => {
  // Upload manufacturing.csv (Ausschuss, Maschine, Lieferzeit)
  // Assert: T11 Production Efficiency visible
  // Assert: T12 Supply Chain Lead Time visible
  // Assert: T15 Defect Root Cause visible
})
```

### Team features

File: tests/e2e/team/invite_member.spec.ts

```typescript
test('invite member by email', async ({ page }) => {
  // As org owner
  // Go to org settings
  // Enter email address
  // Select role: Editor
  // Click "Send invitation"
  // Assert: invitation created in database
  // Assert: invitation email sent (mock)
  // Assert: pending invitation shown in UI
})

test('invited user can accept invitation', async ({ page }) => {
  // Use invitation token
  // Navigate to /invite/[token]
  // Assert: org name shown
  // Accept invitation
  // Assert: added to org_members
  // Assert: can access org workspace
})

test('viewer cannot delete sources', async ({ page }) => {
  // Login as viewer role user
  // Navigate to sources
  // Assert: delete button not visible or disabled
})

test('editor can create projects', async ({ page }) => {
  // Login as editor role user
  // Assert: "New project" button visible and functional
})

test('admin can invite members', async ({ page }) => {
  // Login as admin role user
  // Assert: can access member management
})
```

### Onboarding flow -- complete

File: tests/e2e/onboarding/complete_flow.spec.ts

```typescript
test('complete personal onboarding flow', async ({ page }) => {
  // Step 1: Setup - enter name, select "Just me"
  // Assert: redirects to /onboarding/project
  // Step 2: Project - enter name, pick icon and color
  // Assert: redirects to /onboarding/connect
  // Step 3: Connect - upload CSV file
  // Assert: file parsed, column count shown
  // Step 4: Intent - select columns, chart preferences
  // Assert: redirects to /onboarding/calibrate
  // Step 5: Calibrate - review metrics, set sync frequency
  // Click "Start analyzing"
  // Assert: redirects to project page
  // Assert: project created in database
  // Assert: data source created
  // Assert: initial profiling triggered
})

test('complete team onboarding flow', async ({ page }) => {
  // Step 1: Setup - enter name, select "My team"
  // Assert: redirects to /onboarding/org
  // Step 2: Org - enter org name, workspace name
  // Assert: redirects to /onboarding/project
  // Step 3-5: Same as personal flow
  // Assert: organization created
  // Assert: workspace created
  // Assert: user is org owner
})

test('onboarding step validation', async ({ page }) => {
  // Try to skip steps by URL manipulation
  // Assert: redirected back to correct step
  // Try to submit empty forms
  // Assert: validation errors shown in correct language
})
```

### Settings pages -- complete

File: tests/e2e/settings/personal_settings.spec.ts

```typescript
test('update project name', async ({ page }) => {})
test('update project description', async ({ page }) => {})
test('change project icon', async ({ page }) => {})
test('change project color', async ({ page }) => {})
test('change language preference', async ({ page }) => {
  // Switch to German
  // Assert: UI updates to German
  // Assert: cookie set
})
test('delete project with confirmation', async ({ page }) => {
  // Type project name to confirm
  // Assert: project deleted
  // Assert: redirects to /projects
})
```

File: tests/e2e/settings/api_keys.spec.ts

```typescript
test('generate new API key', async ({ page }) => {})
test('copy API key to clipboard', async ({ page }) => {})
test('revoke API key', async ({ page }) => {})
```

File: tests/e2e/settings/billing.spec.ts

```typescript
test('billing page loads correctly', async ({ page }) => {})
test('plan comparison displays correctly', async ({ page }) => {})
```

### Team workspace E2E

File: tests/e2e/team/workspace_management.spec.ts

```typescript
test('create new workspace in org', async ({ page }) => {
  // Navigate to /{orgSlug}
  // Click "New workspace"
  // Enter name
  // Assert: workspace created
  // Assert: navigates to workspace page
})

test('switch between workspaces', async ({ page }) => {
  // Navigate to org page
  // Click different workspace
  // Assert: correct workspace content loads
})

test('workspace settings update', async ({ page }) => {
  // Navigate to /{orgSlug}/{wsSlug}/settings
  // Update workspace name
  // Assert: name updated
})
```

File: tests/e2e/team/org_settings.spec.ts

```typescript
test('org settings displays org info', async ({ page }) => {})
test('member management lists all members', async ({ page }) => {})
test('change member role', async ({ page }) => {
  // As owner, change a member from Editor to Viewer
  // Assert: role updated
  // Login as that member
  // Assert: restricted permissions
})
```

### Navigation and locale E2E

File: tests/e2e/navigation/locale.spec.ts

```typescript
test('landing page loads in German at /de', async ({ page }) => {
  // Navigate to /de
  // Assert: German content visible
  // Assert: German nav labels
})

test('landing page loads in English at /en', async ({ page }) => {
  // Navigate to /en
  // Assert: English content visible
})

test('locale toggle switches language', async ({ page }) => {
  // Navigate to /en
  // Click locale toggle
  // Assert: redirects to /de
  // Assert: content switches to German
})

test('app pages use cookie-based locale', async ({ page }) => {
  // Login
  // Set locale cookie to 'de'
  // Navigate to /projects
  // Assert: German UI
})
```

File: tests/e2e/navigation/sidebar.spec.ts

```typescript
test('sidebar collapses and expands', async ({ page }) => {
  // Click collapse button
  // Assert: sidebar width changes to 52px
  // Assert: labels hidden, icons visible
  // Assert: tooltips appear on hover
  // Click expand
  // Assert: sidebar width changes to 260px
  // Assert: labels visible
})

test('sidebar persists collapse state', async ({ page }) => {
  // Collapse sidebar
  // Navigate to different page
  // Assert: sidebar still collapsed
  // Refresh page
  // Assert: sidebar still collapsed (localStorage)
})

test('sidebar nav highlights active page', async ({ page }) => {
  // Navigate to /projects/{id}/ask
  // Assert: Ask Data nav item has active indicator
  // Navigate to /projects/{id}/insights
  // Assert: Insights nav item has active indicator
})
```

### Source management E2E

File: tests/e2e/sources/source_settings.spec.ts

```typescript
test('rename data source', async ({ page }) => {})
test('delete data source with confirmation', async ({ page }) => {})
test('view source health report', async ({ page }) => {})
test('re-run pipeline from source settings', async ({ page }) => {})
```

### Analysis page E2E

File: tests/e2e/analysis/auto_analysis.spec.ts

```typescript
test('run auto-analysis on source', async ({ page }) => {
  // Navigate to /projects/{id}/sources/{id}/analysis
  // Click "Run Analysis"
  // Assert: loading indicator
  // Assert: 17 analyses complete
  // Assert: top insights shown
  // Assert: charts rendered
  // Assert: findings contain specific numbers
})

test('explore analysis in Studio', async ({ page }) => {
  // From analysis page, click "Explore in Studio"
  // Assert: Studio opens with pre-populated notebook
})
```

### Dashboard page E2E

File: tests/e2e/dashboard/dashboard.spec.ts

```typescript
test('dashboard page loads', async ({ page }) => {
  // Navigate to /projects/{id}/dashboard
  // Assert: page renders without error
  // Assert: coming soon or dashboard content visible
})
```

---

## Part 4 — Performance Tests

File: tests/performance/load.spec.ts

```typescript
test('CSV upload processes within 10 seconds for 1000 rows', async () => {})
test('Profile completes within 15 seconds for 10000 rows', async () => {})
test('Ask Data responds within 5 seconds (first token)', async () => {})
test('Template detection completes within 3 seconds', async () => {})
test('Template execution completes within 10 seconds', async () => {})
```

---

## Part 5 — GitHub Actions CI

Create .github/workflows/test.yml:

```yaml
name: Test Suite

on:
  push:
    branches: [main, navigation-v2]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run check-i18n  # Fail if translations missing

  pipeline-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r pipeline-service/requirements.txt --break-system-packages
      - run: cd pipeline-service && pytest tests/ -v --cov=. --cov-report=xml

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, pipeline-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npx playwright test
      env:
        TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
        TEST_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
        TEST_ANTHROPIC_API_KEY: ${{ secrets.TEST_ANTHROPIC_API_KEY }}
```

---

## Implementation Order

Implement tests in this exact order:

```
Day 1:  i18n key parity test (catches bugs immediately)
        Security sandbox tests (critical)
        sampler.ts raw data tests (privacy critical)
        formatNumber.ts locale tests

Day 2:  Template engine unit tests (all 42 templates)
        AutoAnalyzer unit tests (17 analyses)
        Findings quality tests (must contain numbers)
        findingsMap.ts regex translator tests (45+ patterns)

Day 3:  Middleware tests (locale, auth, redirects)
        Auth E2E (register + login + logout)
        Navigation and locale E2E

Day 4:  CSV/Excel/JSON upload E2E
        Health page E2E
        Source management E2E

Day 5:  Data prep wizard E2E (complete 5-step flow)
        Pipeline service: profiler, transformer, validator tests

Day 6:  Ask Data E2E
        Insights E2E
        Analysis page E2E

Day 7:  Studio E2E (notebook creation, cell execution, export)
        Template detection E2E

Day 8:  Pipeline service: analyst, suggester, joiner, file_handler tests
        Database connector E2E (PostgreSQL, MySQL)

Day 9:  Onboarding flow E2E (personal + team)
        Team workspace E2E (org, workspace, member management)
        Settings E2E (project, api-keys, billing)

Day 10: All missing API integration tests (13 endpoints)
        RLS integration tests
        Performance tests
        GitHub Actions CI setup

Total: 350+ test cases across 60+ test files
Target coverage: 85%+ on pipeline service
                 75%+ on Next.js routes
                 100% critical path E2E
                 100% privacy/security tests
```

---

## Test Count Summary

| Category | Files | Test Cases |
|---|---|---|
| Frontend unit (Vitest) | 15 | ~80 |
| Component tests (Vitest) | 8 | ~40 |
| Pipeline unit (pytest) | 12 | ~90 |
| Middleware tests | 1 | ~20 |
| API integration tests | 18 | ~60 |
| RLS integration tests | 1 | ~5 |
| E2E auth flows | 2 | ~10 |
| E2E data source flows | 5 | ~15 |
| E2E data prep flows | 5 | ~12 |
| E2E Ask Data flows | 1 | ~7 |
| E2E Insights flows | 1 | ~4 |
| E2E Studio flows | 1 | ~10 |
| E2E Template flows | 1 | ~4 |
| E2E Team/Org flows | 3 | ~10 |
| E2E Onboarding flows | 1 | ~3 |
| E2E Settings flows | 3 | ~8 |
| E2E Navigation/Locale | 2 | ~7 |
| Performance tests | 1 | ~5 |
| **Total** | **~80 files** | **~390 tests** |

---

## Critical Tests — Must Never Fail

These tests are non-negotiable. A failing CI build on any of these
blocks deployment:

```
 1. i18n key parity (en.json = de.json, no missing keys)
 2. Raw data never sent to Claude (buildDataContext privacy)
 3. Security sandbox blocks os/subprocess/sys
 4. RLS prevents cross-org data access
 5. Auth redirects work correctly (protected routes, locale)
 6. CSV upload saves to correct storage path
 7. Pipeline status updates after prep completion
 8. Template findings contain specific numbers (not generic)
 9. Middleware locale detection (cookie > Accept-Language > default)
10. Credential encryption round-trip (AES-256-GCM)
11. formatNumber locale correctness (de-DE vs en-US)
12. All 42 templates detect bilingual column patterns
13. AutoAnalyzer completes all 17 analyses with zero AI calls
14. Code execution sandbox enforces 30s timeout
15. Onboarding creates correct org/workspace/project hierarchy
```

---

Last updated: March 24, 2026
Run all tests: npm run test:all
Run E2E only: npx playwright test
Run unit only: npm run test:unit
Run pipeline: cd pipeline-service && pytest
Run middleware: npm run test -- middleware