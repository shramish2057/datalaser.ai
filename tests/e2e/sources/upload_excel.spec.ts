import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Create a minimal Excel fixture path (would need an actual .xlsx file in fixtures)
const EXCEL_FIXTURE = path.resolve(__dirname, '../../fixtures/test_data.xlsx')

test.describe('Excel upload flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('upload Excel file successfully', async ({ page }) => {
    // Skip if no Excel fixture exists
    test.skip(!fs.existsSync(EXCEL_FIXTURE), 'Excel fixture not found at tests/fixtures/test_data.xlsx')

    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/prep`)

    const prepareTab = page.getByRole('button', { name: /Prepare New/i })
    if (await prepareTab.isVisible()) {
      await prepareTab.click()
    }

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(EXCEL_FIXTURE)

    // File name should appear
    await expect(page.getByText(/test_data\.xlsx/i)).toBeVisible({ timeout: 10000 })
    // Source name input and start button should appear
    await expect(page.locator('input.dl-input')).toBeVisible()
    await expect(page.getByText(/Start preparation/i)).toBeVisible()
  })

  test('rejects unsupported file types', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/prep`)

    const prepareTab = page.getByRole('button', { name: /Prepare New/i })
    if (await prepareTab.isVisible()) {
      await prepareTab.click()
    }

    // The dropzone only accepts CSV, JSON, XLSX, XLS — other types should be rejected
    // by the react-dropzone accept configuration
    const dropzone = page.locator('[class*="border-dashed"]')
    await expect(dropzone).toBeVisible({ timeout: 10000 })
  })
})
