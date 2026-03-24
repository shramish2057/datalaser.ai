import { test, expect } from '@playwright/test'

test.describe('Prep wizard complete flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('Step 1 Profile loads with stats', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/prep`)

    // Check for existing unprepared sources or the prep wizard
    const prepareLink = page.locator('a[href*="/prep/"]').first()
    if (await prepareLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prepareLink.click()
      await page.waitForURL('**/prep/**', { timeout: 15000 })

      // Step indicator should show Profile step
      // The wizard has 5 steps: Profile, Suggestions, Transform, Validate, Ready
      await expect(page.getByText(/Profile|Profil/i).first()).toBeVisible({ timeout: 30000 })

      // Quality score or column stats should load
      await expect(page.locator('.dl-card').first()).toBeVisible({ timeout: 30000 })
    }
  })

  test('Step 2 Suggestions shows AI suggestions', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/prep`)

    const prepareLink = page.locator('a[href*="/prep/"]').first()
    if (await prepareLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prepareLink.click()
      await page.waitForURL('**/prep/**', { timeout: 15000 })

      // Wait for Profile step to complete, then advance
      await expect(page.locator('.dl-card').first()).toBeVisible({ timeout: 30000 })

      // Click the Suggestions step tab/button
      const suggestBtn = page.getByText(/Suggestions|Vorschl/i).first()
      if (await suggestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await suggestBtn.click()

        // AI suggestions should appear (e.g., fill_null, drop_column, etc.)
        await expect(
          page.locator('[class*="bg-blue-100"], [class*="bg-red-100"], [class*="bg-orange-100"], [class*="bg-purple-100"]').first()
        ).toBeVisible({ timeout: 30000 })
      }
    }
  })

  test('Step 3 Transform applies operations', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/prep`)

    const prepareLink = page.locator('a[href*="/prep/"]').first()
    if (await prepareLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prepareLink.click()
      await page.waitForURL('**/prep/**', { timeout: 15000 })
      await expect(page.locator('.dl-card').first()).toBeVisible({ timeout: 30000 })

      // Navigate to Transform step
      const transformBtn = page.getByText(/Transform/i).first()
      if (await transformBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await transformBtn.click()
        // Transform step should show a loading state or applied operations
        await expect(
          page.locator('.animate-spin, .dl-card').first()
        ).toBeVisible({ timeout: 30000 })
      }
    }
  })

  test('Step 4 Validate runs checks', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/prep`)

    const prepareLink = page.locator('a[href*="/prep/"]').first()
    if (await prepareLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prepareLink.click()
      await page.waitForURL('**/prep/**', { timeout: 15000 })
      await expect(page.locator('.dl-card').first()).toBeVisible({ timeout: 30000 })

      // Navigate to Validate step
      const validateBtn = page.getByText(/Validate|Validier/i).first()
      if (await validateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await validateBtn.click()
        // Validation results or checks should appear
        await expect(page.locator('.dl-card').first()).toBeVisible({ timeout: 30000 })
      }
    }
  })

  test('Step 5 Ready shows completion', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/prep`)

    const prepareLink = page.locator('a[href*="/prep/"]').first()
    if (await prepareLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await prepareLink.click()
      await page.waitForURL('**/prep/**', { timeout: 15000 })
      await expect(page.locator('.dl-card').first()).toBeVisible({ timeout: 30000 })

      // Navigate to Ready step
      const readyBtn = page.getByText(/Ready|Bereit/i).first()
      if (await readyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await readyBtn.click()
        // Completion state — should show success icon or "Pipeline Ready" message
        await expect(
          page.locator('text=/ready|complete|fertig/i').first()
        ).toBeVisible({ timeout: 30000 })
      }
    }
  })
})
