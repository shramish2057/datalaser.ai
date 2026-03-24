import { test, expect } from '@playwright/test'

test.describe('Insights page complete flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('insights page loads with title', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/insights`)

    // Page title should be visible
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
    // Subtitle text should be visible
    await expect(page.locator('h1 + p, h1 ~ p').first()).toBeVisible()
  })

  test('source cards are displayed', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/insights`)

    // Either source cards or empty state should appear
    const hasSourceCards = page.locator('.rounded-dl-lg.border.border-dl-border').first()
    const emptyState = page.locator('text=/No sources|Add a data source/i').first()

    await expect(hasSourceCards.or(emptyState)).toBeVisible({ timeout: 15000 })

    if (await hasSourceCards.isVisible().catch(() => false)) {
      // Source name and type should be displayed
      await expect(page.locator('.rounded-dl-lg.border').first()).toBeVisible()
      // Row count should be displayed
      await expect(page.getByText(/rows/i).first()).toBeVisible()
    }
  })

  test('run analysis button works', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/insights`)

    // Look for "Run Analysis" button on pending sources
    const runBtn = page.getByText(/Run Analysis|Analyse starten/i).first()
    if (await runBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await runBtn.click()

      // Should show "Analyzing..." spinner state
      await expect(
        page.locator('.animate-spin').first()
      ).toBeVisible({ timeout: 5000 })

      // Wait for analysis to complete (may take time)
      await expect(
        page.locator('.animate-spin')
      ).toBeHidden({ timeout: 60000 })
    }
  })

  test('analyzed results contain insight counts', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/insights`)

    // Check for analyzed section with insight counts
    const analyzedSection = page.locator('text=/Analyzed|Analysiert/i').first()
    if (await analyzedSection.isVisible({ timeout: 10000 }).catch(() => false)) {
      // Insight count badge should show a number (e.g., "5 insights")
      await expect(
        page.getByText(/\d+\s+insight/i).first()
      ).toBeVisible({ timeout: 10000 })

      // Click on an analyzed source to see full results
      const sourceCard = page.locator('.rounded-dl-lg.border').first()
      await sourceCard.click()

      // Should navigate to analysis detail page
      await page.waitForURL('**/analysis**', { timeout: 10000 })
      await expect(page).toHaveURL(/\/analysis/)
    }
  })
})
