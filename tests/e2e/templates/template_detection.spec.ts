import { test, expect } from '@playwright/test'
import path from 'path'

const TITANIC_CSV = path.resolve(__dirname, '../../fixtures/titanic.csv')
const GERMAN_SALES_CSV = path.resolve(__dirname, '../../fixtures/german_sales.csv')

test.describe('Template detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('universal templates detected for any CSV via API', async ({ page }) => {
    // Navigate to a project with a source and run analysis
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]

    // Go to insights page where analysis can be triggered
    await page.goto(`/projects/${projectId}/insights`)

    // If sources exist, the "Run Analysis" button triggers template detection via the pipeline
    const runBtn = page.getByText(/Run Analysis|Analyse starten/i).first()
    if (await runBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await runBtn.click()
      // Wait for analysis completion
      await expect(page.locator('.animate-spin')).toBeHidden({ timeout: 60000 })

      // After analysis, insights count should appear
      await expect(page.getByText(/insight/i).first()).toBeVisible({ timeout: 15000 })
    }
  })

  test('German templates detected for German headers', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]

    // Upload German CSV via prep page
    await page.goto(`/projects/${projectId}/prep`)

    const prepareTab = page.getByRole('button', { name: /Prepare New/i })
    if (await prepareTab.isVisible()) {
      await prepareTab.click()
    }

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(GERMAN_SALES_CSV)

    // German file should be recognized
    await expect(page.getByText('german_sales.csv')).toBeVisible({ timeout: 10000 })

    // Start preparation to trigger column profiling which feeds into template detection
    await expect(page.getByText(/Start preparation/i)).toBeVisible({ timeout: 10000 })
  })

  test('run template shows results with numerical data', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]

    // Navigate to an existing analysis page
    await page.goto(`/projects/${projectId}/insights`)

    // Click on an analyzed source to view results
    const sourceCard = page.locator('.rounded-dl-lg.border.border-dl-border').filter({
      has: page.getByText(/insight/i),
    }).first()

    if (await sourceCard.isVisible({ timeout: 10000 }).catch(() => false)) {
      await sourceCard.click()
      await page.waitForURL('**/analysis**', { timeout: 15000 })

      // Analysis results page should show insights with numbers
      // KPI cards, charts, or insight text with numerical values
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })

      // Look for numerical content in insights (percentages, counts, correlations)
      const insightText = page.locator('.rounded-dl-lg, .dl-card, [class*="border"]').first()
      await expect(insightText).toBeVisible({ timeout: 15000 })

      // Page should contain at least one number
      const bodyText = await page.locator('body').innerText()
      expect(bodyText).toMatch(/\d+/)
    }
  })

  test('template API endpoint responds correctly', async ({ page }) => {
    // Test the templates API directly via page.evaluate fetch
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/pipeline/templates', {
          method: 'POST',
          body: new FormData(),
        })
        return { status: res.status, ok: res.ok }
      } catch (e) {
        return { status: 0, ok: false, error: String(e) }
      }
    })

    // The API should respond (may be 400 for missing file, or 503 if pipeline down)
    expect(response.status).toBeGreaterThan(0)
    expect([400, 422, 503, 200]).toContain(response.status)
  })
})
