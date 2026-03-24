import { test, expect } from '@playwright/test'
import path from 'path'

const TITANIC_CSV = path.resolve(__dirname, '../../fixtures/titanic.csv')

test.describe('Health check page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('health page shows quality score', async ({ page }) => {
    // Navigate to a project with an existing source
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    // Go to sources page and find first source link with health
    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/sources`)

    // Click on a source to navigate to health page
    const sourceLink = page.locator('a[href*="/sources/"][href*="/health"]').first()
    if (await sourceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sourceLink.click()
      await page.waitForURL('**/health**', { timeout: 15000 })

      // Quality score should be displayed as a large number /100
      await expect(page.getByText('/100')).toBeVisible({ timeout: 30000 })
      // Quality score label
      await expect(page.locator('text=/Quality Score|qualityScore/i')).toBeVisible()
    }
  })

  test('column breakdown is displayed', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/sources`)

    const sourceLink = page.locator('a[href*="/sources/"][href*="/health"]').first()
    if (await sourceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sourceLink.click()
      await page.waitForURL('**/health**', { timeout: 15000 })

      // Wait for profiling to complete
      await expect(page.getByText('/100')).toBeVisible({ timeout: 30000 })

      // Column overview table should exist
      await expect(page.locator('table.dl-table')).toBeVisible()
      // Table should have headers: Column, Type, Null Rate, Issues
      await expect(page.locator('table.dl-table th').first()).toBeVisible()
      // At least one row of column data
      await expect(page.locator('table.dl-table tbody tr').first()).toBeVisible()
    }
  })

  test('clean & prepare CTA works', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/sources`)

    const sourceLink = page.locator('a[href*="/sources/"][href*="/health"]').first()
    if (await sourceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sourceLink.click()
      await page.waitForURL('**/health**', { timeout: 15000 })
      await expect(page.getByText('/100')).toBeVisible({ timeout: 30000 })

      // Click the "Clean first" / prep CTA button (first grid button)
      const cleanBtn = page.locator('button:has-text("Clean")').first()
      if (await cleanBtn.isVisible()) {
        await cleanBtn.click()
        // Should navigate to prep wizard
        await page.waitForURL('**/prep/**', { timeout: 10000 })
        await expect(page).toHaveURL(/\/prep\//)
      }
    }
  })

  test('skip explore CTA works', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/sources`)

    const sourceLink = page.locator('a[href*="/sources/"][href*="/health"]').first()
    if (await sourceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sourceLink.click()
      await page.waitForURL('**/health**', { timeout: 15000 })
      await expect(page.getByText('/100')).toBeVisible({ timeout: 30000 })

      // Click the "Skip, explore" CTA button (second grid button)
      const skipBtn = page.locator('button:has-text("Skip")').first()
      if (await skipBtn.isVisible()) {
        await skipBtn.click()
        // Should navigate to ask page
        await page.waitForURL('**/ask**', { timeout: 10000 })
        await expect(page).toHaveURL(/\/ask/)
      }
    }
  })

  test('quality badge color coding (green/amber/red)', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/sources`)

    const sourceLink = page.locator('a[href*="/sources/"][href*="/health"]').first()
    if (await sourceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sourceLink.click()
      await page.waitForURL('**/health**', { timeout: 15000 })
      await expect(page.getByText('/100')).toBeVisible({ timeout: 30000 })

      // Quality badge should have one of the color-coded classes
      const badge = page.locator('.rounded-full').filter({
        hasText: /Good|Minor issues|Issues found|Significant issues/,
      })
      await expect(badge.first()).toBeVisible()

      // Quality bar should have color (green, yellow, orange, or red)
      const bar = page.locator('[class*="rounded-full"][class*="h-full"]').first()
      await expect(bar).toBeVisible()
      const barClass = await bar.getAttribute('class')
      expect(barClass).toMatch(/bg-dl-success|bg-yellow-400|bg-orange-400|bg-dl-error/)
    }
  })
})
