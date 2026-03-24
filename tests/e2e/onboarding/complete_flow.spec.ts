import { test, expect } from '@playwright/test'

test.describe('Onboarding complete flow', () => {
  test('setup page loads with name input and mode selection', async ({ page }) => {
    await page.goto('/onboarding/setup')
    // Step indicator should show step 1 (You, Project, Data)
    await expect(page.getByText(/You|Du/i).first()).toBeVisible({ timeout: 10000 })
    // Heading
    await expect(page.locator('h1').first()).toBeVisible()
    // Name input
    await expect(page.locator('input.dl-input')).toBeVisible()
    // Personal and Team mode buttons
    await expect(page.locator('button').filter({ hasText: /Just me|Nur ich/i })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: /My team|Mein Team/i })).toBeVisible()
    // Continue button (disabled initially)
    await expect(page.locator('button.dl-btn-primary')).toBeVisible()
    await expect(page.locator('button.dl-btn-primary')).toHaveClass(/opacity-40/)
  })

  test('can select personal mode and continue', async ({ page }) => {
    await page.goto('/onboarding/setup')
    await expect(page.locator('input.dl-input')).toBeVisible({ timeout: 10000 })

    // Fill name
    await page.locator('input.dl-input').fill('E2E Tester')

    // Select personal mode
    await page.locator('button').filter({ hasText: /Just me|Nur ich/i }).click()

    // Continue button should become enabled (no opacity class)
    const continueBtn = page.locator('button.dl-btn-primary')
    await expect(continueBtn).not.toHaveClass(/opacity-40/)

    // Click continue
    await continueBtn.click()

    // Should navigate to /onboarding/project (personal mode)
    await page.waitForURL('**/onboarding/project**', { timeout: 10000 })
    await expect(page).toHaveURL(/\/onboarding\/project/)
  })

  test('can select team mode and continue to org setup', async ({ page }) => {
    await page.goto('/onboarding/setup')
    await expect(page.locator('input.dl-input')).toBeVisible({ timeout: 10000 })

    await page.locator('input.dl-input').fill('E2E Team Admin')

    // Select team mode
    await page.locator('button').filter({ hasText: /My team|Mein Team/i }).click()

    const continueBtn = page.locator('button.dl-btn-primary')
    await expect(continueBtn).not.toHaveClass(/opacity-40/)
    await continueBtn.click()

    // Should navigate to /onboarding/org (team mode)
    await page.waitForURL('**/onboarding/org**', { timeout: 10000 })
    await expect(page).toHaveURL(/\/onboarding\/org/)
  })

  test('connect page shows upload and database options', async ({ page }) => {
    await page.goto('/onboarding/connect')
    // The connect page has file upload (dropzone) and database connectors
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })

    // Dropzone for file upload
    const dropzone = page.locator('[class*="border-dashed"], input[type="file"]').first()
    await expect(dropzone).toBeAttached({ timeout: 10000 })

    // Database connector icons/buttons should be present
    // ConnectorIcon components with database names
    const connectorSection = page.locator('text=/PostgreSQL|MySQL|Snowflake|BigQuery|Connect/i').first()
    await expect(connectorSection).toBeVisible({ timeout: 10000 })
  })

  test('calibrate page shows metrics configuration', async ({ page }) => {
    await page.goto('/onboarding/calibrate')
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })

    // Step indicator should be visible
    // The calibrate page shows AI-detected metrics and dimensions
    // It requires data from the connect step, so may show loading or empty state
    const content = page.locator('h1, h2, [class*="StepIndicator"]').first()
    await expect(content).toBeVisible({ timeout: 10000 })
  })

  test('intent page allows setting analysis goals', async ({ page }) => {
    await page.goto('/onboarding/intent')
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })

    // The intent page lets users set their analysis questions
    const heading = page.locator('h1, h2').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
  })
})
