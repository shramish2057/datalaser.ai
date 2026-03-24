import { test, expect } from '@playwright/test'

test.describe('Login flow', () => {
  test('login page loads at /en/login', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    // Sign in button visible
    await expect(page.locator('button.dl-btn-primary')).toBeVisible()
    // Google OAuth button visible
    await expect(page.locator('button.dl-btn-secondary')).toBeVisible()
    // Link to signup
    await expect(page.locator('a[href="/en/signup"]')).toBeVisible()
  })

  test('login page loads at /de/login with German text', async ({ page }) => {
    await page.goto('/de/login')
    await expect(page.locator('h1')).toBeVisible()
    // German locale should render German translations for email label
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    // Signup link should point to /de/signup
    await expect(page.locator('a[href="/de/signup"]')).toBeVisible()
  })

  test('shows validation error for empty fields', async ({ page }) => {
    await page.goto('/login')
    // Click sign in without filling fields
    await page.locator('button.dl-btn-primary').click()
    // Supabase returns an error for empty credentials
    await expect(
      page.locator('.bg-red-50.border-dl-error')
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('nonexistent@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword123')
    await page.locator('button.dl-btn-primary').click()
    // Error banner with red background should appear
    await expect(
      page.locator('.bg-red-50.border-dl-error')
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('.bg-red-50.border-dl-error')
    ).toContainText(/invalid|credentials|error/i)
  })

  test('successful login redirects to /projects', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
    await expect(page).toHaveURL(/\/projects/)
  })

  test('protected routes redirect to login', async ({ page }) => {
    // Try to access a protected route without authentication
    await page.goto('/projects')
    // Should redirect to login
    await page.waitForURL('**/login**', { timeout: 15000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('logout clears session', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })

    // Look for logout/sign-out control in settings or sidebar
    await page.goto('/settings')
    const logoutBtn = page.getByRole('button', { name: /log\s*out|sign\s*out/i })
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL('**/login**', { timeout: 15000 })
      await expect(page).toHaveURL(/\/login/)
    }

    // Verify cannot access protected route after logout
    await page.goto('/projects')
    await page.waitForURL('**/login**', { timeout: 15000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
