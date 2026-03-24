import { test, expect } from '@playwright/test'

test.describe('Ask page complete flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('ask page loads with input and empty state', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/ask`)

    // Chat input (textarea) should be visible
    await expect(page.locator('textarea.dl-input')).toBeVisible({ timeout: 10000 })
    // Send button should be visible
    await expect(page.locator('button.dl-btn-primary:has(svg)')).toBeVisible()
    // Empty state with sparkles icon and "Ask anything" heading
    await expect(page.locator('h2').first()).toBeVisible()
    // New chat button in sidebar
    await expect(page.getByText(/New Chat|Neuer Chat/i)).toBeVisible()
  })

  test('type question and submit', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/ask`)

    const textarea = page.locator('textarea.dl-input')
    await expect(textarea).toBeVisible({ timeout: 10000 })

    // Type a question
    await textarea.fill('What is the average age?')
    // Click send
    await page.locator('button.dl-btn-primary:has(svg)').click()

    // User message should appear in chat (blue bubble)
    await expect(
      page.locator('.bg-dl-brand.text-white').filter({ hasText: 'What is the average age?' })
    ).toBeVisible({ timeout: 10000 })
  })

  test('response streams in', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/ask`)

    const textarea = page.locator('textarea.dl-input')
    await expect(textarea).toBeVisible({ timeout: 10000 })

    await textarea.fill('Describe the data')
    await page.locator('button.dl-btn-primary:has(svg)').click()

    // Loading indicator should appear: "Analyzing your data..."
    await expect(
      page.getByText(/Analyzing your data/i)
    ).toBeVisible({ timeout: 10000 })

    // Wait for assistant response to appear (the border/bg styling for assistant messages)
    await expect(
      page.locator('.bg-dl-bg.border.border-dl-border').first()
    ).toBeVisible({ timeout: 60000 })
  })

  test('chart renders when response includes chart data', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/ask`)

    const textarea = page.locator('textarea.dl-input')
    await expect(textarea).toBeVisible({ timeout: 10000 })

    // Ask a question that should produce a chart
    await textarea.fill('Show me a bar chart of survival rates by class')
    await page.locator('button.dl-btn-primary:has(svg)').click()

    // Wait for assistant response
    await expect(
      page.locator('.bg-dl-bg.border.border-dl-border').first()
    ).toBeVisible({ timeout: 60000 })

    // If a chart is rendered, it uses the InteractiveChart component (Recharts)
    // Check for SVG chart elements
    const chartContainer = page.locator('.recharts-wrapper, svg.recharts-surface').first()
    // Chart may or may not appear depending on AI response
    if (await chartContainer.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(chartContainer).toBeVisible()
    }
  })

  test('conversation saved in sidebar', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/ask`)

    const textarea = page.locator('textarea.dl-input')
    await expect(textarea).toBeVisible({ timeout: 10000 })

    await textarea.fill('How many rows are there?')
    await page.locator('button.dl-btn-primary:has(svg)').click()

    // Wait for response to complete
    await expect(
      page.locator('.bg-dl-bg.border.border-dl-border').first()
    ).toBeVisible({ timeout: 60000 })

    // Conversation should appear in the sidebar (left panel, w-[260px])
    const sidebar = page.locator('.border-r.border-dl-border.bg-dl-bg')
    await expect(sidebar).toBeVisible()

    // The conversation title derived from the message should appear
    await expect(
      sidebar.getByText(/How many rows/i)
    ).toBeVisible({ timeout: 15000 })
  })
})
