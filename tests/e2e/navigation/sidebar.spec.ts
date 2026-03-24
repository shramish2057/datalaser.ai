import { test, expect } from '@playwright/test'

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('sidebar collapses and expands', async ({ page }) => {
    // Navigate to an app page that has the sidebar
    await page.goto('/app/insights')
    await expect(page.locator('aside')).toBeVisible({ timeout: 10000 })

    // Sidebar should be expanded by default (w-[260px])
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // Find the collapse toggle button (ChevronLeft/ChevronRight)
    const toggleBtn = sidebar.locator('button').filter({ has: page.locator('svg') }).last()
    if (await toggleBtn.isVisible()) {
      // Click to collapse
      await toggleBtn.click()
      // After collapse, sidebar should be narrow (w-[52px])
      await expect(sidebar).toHaveCSS('width', /52px|3\.25rem/)

      // Click to expand
      await toggleBtn.click()
      // After expand, sidebar should be wide again
      await expect(sidebar).toHaveCSS('width', /260px|16\.25rem/)
    }
  })

  test('active page highlighted in sidebar', async ({ page }) => {
    await page.goto('/app/insights')
    await expect(page.locator('aside')).toBeVisible({ timeout: 10000 })

    // The "Insights" link should be active (has bg-dl-brand-hover and text-dl-brand classes)
    const insightsLink = page.locator('aside a[href="/app/insights"]')
    await expect(insightsLink).toBeVisible()
    const linkClass = await insightsLink.getAttribute('class')
    expect(linkClass).toContain('text-dl-brand')
    expect(linkClass).toContain('bg-dl-brand-hover')

    // Active indicator bar (3px blue bar on left)
    const activeBar = insightsLink.locator('.bg-dl-brand.rounded-r-sm')
    await expect(activeBar).toBeVisible()
  })

  test('navigation between pages updates active state', async ({ page }) => {
    await page.goto('/app/insights')
    await expect(page.locator('aside')).toBeVisible({ timeout: 10000 })

    // Click on "Ask Data" nav item
    const askLink = page.locator('aside a[href="/app/ask"]')
    await expect(askLink).toBeVisible()
    await askLink.click()
    await page.waitForURL('**/ask**', { timeout: 10000 })

    // Now "Ask Data" should be the active item
    const askLinkClass = await page.locator('aside a[href="/app/ask"]').getAttribute('class')
    expect(askLinkClass).toContain('text-dl-brand')

    // "Insights" should no longer be active
    const insightsLinkClass = await page.locator('aside a[href="/app/insights"]').getAttribute('class')
    expect(insightsLinkClass).not.toContain('text-dl-brand')
  })

  test('sidebar collapse state persists across navigation', async ({ page }) => {
    await page.goto('/app/insights')
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Collapse sidebar
    const toggleBtn = sidebar.locator('button').filter({ has: page.locator('svg') }).last()
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click()

      // Navigate to another page
      await page.goto('/app/ask')
      await expect(sidebar).toBeVisible({ timeout: 10000 })

      // Sidebar should still be collapsed (localStorage-persisted state)
      // The sidebar reads from localStorage('mb-sidebar')
      const sidebarState = await page.evaluate(() => localStorage.getItem('mb-sidebar'))
      expect(sidebarState).toBe('false')
    }
  })

  test('sidebar shows all navigation items', async ({ page }) => {
    await page.goto('/app/insights')
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Verify all expected nav items exist
    await expect(sidebar.locator('a[href="/app/insights"]')).toBeVisible()
    await expect(sidebar.locator('a[href="/app/ask"]')).toBeVisible()
    await expect(sidebar.locator('a[href="/app/dashboard"]')).toBeVisible()
    await expect(sidebar.locator('a[href="/app/sources"]')).toBeVisible()
    await expect(sidebar.locator('a[href="/app/settings"]')).toBeVisible()
  })
})
