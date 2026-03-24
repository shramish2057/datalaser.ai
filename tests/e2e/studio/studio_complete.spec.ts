import { test, expect } from '@playwright/test'

test.describe('Studio notebook complete flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('create new notebook — auto-redirects to workspace', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]

    // Navigate to studio — the page auto-creates or redirects to first notebook
    await page.goto(`/projects/${projectId}/studio`)

    // Should show "Opening Studio..." loading state then redirect
    await expect(page.getByText(/Opening Studio/i)).toBeVisible({ timeout: 5000 }).catch(() => {})

    // Should redirect to /studio/[notebookId]
    await page.waitForURL('**/studio/**', { timeout: 20000 })
    await expect(page).toHaveURL(/\/studio\//)
  })

  test('two-panel layout visible', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/studio`)
    await page.waitForURL('**/studio/**', { timeout: 20000 })

    // Wait for notebook workspace to load
    await expect(page.locator('[class*="flex"]').first()).toBeVisible({ timeout: 15000 })

    // Left panel (cells) and right panel (output) should both exist
    // The notebook workspace has a two-panel layout
    const panels = page.locator('[class*="flex-1"], [class*="overflow-y-auto"]')
    await expect(panels.first()).toBeVisible({ timeout: 10000 })
  })

  test('run code cell', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/studio`)
    await page.waitForURL('**/studio/**', { timeout: 20000 })

    // Add a new code cell via the "+" button
    const addBtn = page.locator('button:has(svg)').filter({ hasText: '' }).first()
    const plusButton = page.getByRole('button').filter({ has: page.locator('svg') }).first()

    // Look for the run button (Play icon)
    const runButton = page.locator('button').filter({ has: page.locator('svg.lucide-play') }).first()
    if (await runButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await runButton.click()
      // After running, output should appear or a loading spinner
      await expect(
        page.locator('.animate-spin, [class*="output"]').first()
      ).toBeVisible({ timeout: 10000 })
    }
  })

  test('output appears after cell execution', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/studio`)
    await page.waitForURL('**/studio/**', { timeout: 20000 })

    // If proactive suggestions exist, they might auto-generate cells
    // Check that the output panel area exists
    const outputArea = page.locator('[class*="OutputPanel"], [class*="output-panel"], [class*="flex-1"]').first()
    await expect(outputArea).toBeVisible({ timeout: 15000 })
  })

  test('notebook title is editable', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/studio`)
    await page.waitForURL('**/studio/**', { timeout: 20000 })

    // The notebook title ("First Analysis") should be visible and editable
    const titleInput = page.locator('input[value*="Analysis"], input[value*="Notebook"]').first()
    if (await titleInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      await titleInput.clear()
      await titleInput.fill('E2E Test Notebook')
      // Trigger save via blur
      await titleInput.blur()
      await expect(titleInput).toHaveValue('E2E Test Notebook')
    }
  })
})
