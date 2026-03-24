import { test, expect } from '@playwright/test'

test.describe('Personal settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('update project name', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/settings`)

    // Settings page title
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

    // Project name input should be visible and pre-filled
    const nameInput = page.locator('input.dl-input').first()
    await expect(nameInput).toBeVisible()
    const originalName = await nameInput.inputValue()

    // Update the name
    await nameInput.clear()
    await nameInput.fill('E2E Updated Project')

    // Click save
    const saveBtn = page.locator('button.dl-btn-primary').filter({ hasText: /Save|Speichern/i })
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    // "Saved" confirmation should appear briefly
    await expect(
      page.getByText(/Saved|Gespeichert/i).first()
    ).toBeVisible({ timeout: 5000 })

    // Restore original name
    await nameInput.clear()
    await nameInput.fill(originalName)
    await saveBtn.click()
  })

  test('change language preference', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/settings`)

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

    // Language selection buttons (Deutsch and English)
    const deutschBtn = page.locator('button').filter({ hasText: 'Deutsch' })
    const englishBtn = page.locator('button').filter({ hasText: 'English' })

    await expect(deutschBtn).toBeVisible()
    await expect(englishBtn).toBeVisible()

    // Click Deutsch to switch language
    await deutschBtn.click()

    // The description text should change to German
    await expect(
      page.getByText(/Alle Oberflächen|auf Deutsch/i).first()
    ).toBeVisible({ timeout: 10000 })

    // Switch back to English
    await englishBtn.click()
    await expect(
      page.getByText(/All UI|in English/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('delete project with confirmation', async ({ page }) => {
    // Create a throwaway project first, or just test the dialog mechanism
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/settings`)

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

    // Danger zone section
    await expect(page.getByText(/Danger Zone|Gefahrenzone/i)).toBeVisible()

    // Click delete project button
    const deleteBtn = page.locator('button.dl-btn-danger').first()
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Confirmation dialog should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    // Dialog should ask to type project name
    await expect(page.getByText(/confirm deletion|bestätigen/i)).toBeVisible()
    // Confirmation input
    const confirmInput = page.locator('[role="dialog"] input.dl-input')
    await expect(confirmInput).toBeVisible()

    // Delete button in dialog should be disabled without matching name
    const dialogDeleteBtn = page.locator('[role="dialog"] button.dl-btn-danger')
    await expect(dialogDeleteBtn).toHaveClass(/opacity-40/)

    // Cancel and close dialog without deleting
    const cancelBtn = page.locator('[role="dialog"] button.dl-btn-secondary')
    await cancelBtn.click()
    await expect(page.locator('[role="dialog"]')).toBeHidden()
  })

  test('project icon and color selection', async ({ page }) => {
    const projectLink = page.locator('a[href*="/projects/"]').first()
    await projectLink.click()
    await page.waitForURL('**/projects/**', { timeout: 10000 })

    const projectUrl = page.url()
    const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1]
    await page.goto(`/projects/${projectId}/settings`)

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

    // Color picker — 9 circular color buttons
    const colorBtns = page.locator('button.rounded-full[style*="background-color"]')
    await expect(colorBtns.first()).toBeVisible()
    const colorCount = await colorBtns.count()
    expect(colorCount).toBe(9)

    // Click a different color
    await colorBtns.nth(2).click()
    // The clicked button should get the active border class
    await expect(colorBtns.nth(2)).toHaveClass(/border-dl-text-dark/)
  })
})
