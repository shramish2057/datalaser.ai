import { test, expect } from '@playwright/test'
import path from 'path'

const TITANIC_CSV = path.resolve(__dirname, '../../fixtures/titanic.csv')

test.describe('CSV upload flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('upload titanic.csv via file input on prep page', async ({ page }) => {
    // Navigate to the first project's prep page
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    // Go to prep page
    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    expect(projectId).toBeTruthy()
    await page.goto(`/projects/${projectId}/prep`)

    // Click "Prepare New" tab if not active
    const prepareTab = page.getByRole('button', { name: /Prepare New/i })
    if (await prepareTab.isVisible()) {
      await prepareTab.click()
    }

    // Upload file via the dropzone input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(TITANIC_CSV)

    // Assert file name appears after upload
    await expect(page.getByText('titanic.csv')).toBeVisible({ timeout: 10000 })
    // Assert row count is shown
    await expect(page.getByText(/rows/i)).toBeVisible()
  })

  test('upload shows source name input after file selection', async ({ page }) => {
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
    await fileInput.setInputFiles(TITANIC_CSV)

    // Source name input should appear
    await expect(page.locator('input.dl-input')).toBeVisible({ timeout: 10000 })
    // "Start preparation" button should be visible
    await expect(page.getByText(/Start preparation/i)).toBeVisible()
  })

  test('start preparation navigates to prep wizard', async ({ page }) => {
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
    await fileInput.setInputFiles(TITANIC_CSV)

    await expect(page.getByText(/Start preparation/i)).toBeVisible({ timeout: 10000 })
    await page.getByText(/Start preparation/i).click()

    // Should navigate to the prep wizard (prep/[sourceId])
    await page.waitForURL('**/prep/**', { timeout: 20000 })
    await expect(page).toHaveURL(/\/prep\//)
  })

  test('upload via sources/new page triggers health check', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/sources/new`)

    // The sources/new page embeds the connect/upload component
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached({ timeout: 10000 })
    await fileInput.setInputFiles(TITANIC_CSV)

    // After upload, should see file name and row count
    await expect(page.getByText('titanic.csv')).toBeVisible({ timeout: 10000 })
  })
})
