import { test, expect } from '@playwright/test'

test.describe('Signup flow', () => {
  test('signup page loads at /en/signup', async ({ page }) => {
    await page.goto('/en/signup')
    await expect(page.locator('h1')).toBeVisible()
    // Name, email, and password fields
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    // Sign up button
    await expect(page.locator('button.dl-btn-primary')).toBeVisible()
    // Google OAuth button
    await expect(page.locator('button.dl-btn-secondary')).toBeVisible()
    // Link to login
    await expect(page.locator('a[href="/en/login"]')).toBeVisible()
  })

  test('signup page loads at /de/signup with German text', async ({ page }) => {
    await page.goto('/de/signup')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    // Login link should point to /de/login
    await expect(page.locator('a[href="/de/login"]')).toBeVisible()
  })

  test('also loads at /signup (non-locale path)', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('input[type="text"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('shows validation error for empty fields', async ({ page }) => {
    await page.goto('/signup')
    // Click sign up without filling fields
    await page.locator('button.dl-btn-primary').click()
    // Supabase should return an error
    await expect(
      page.locator('.bg-red-50.border-dl-error')
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows error for invalid email format', async ({ page }) => {
    await page.goto('/signup')
    await page.locator('input[type="text"]').fill('Test User')
    await page.locator('input[type="email"]').fill('not-an-email')
    await page.locator('input[type="password"]').fill('password123')
    await page.locator('button.dl-btn-primary').click()
    await expect(
      page.locator('.bg-red-50.border-dl-error')
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows error for short password', async ({ page }) => {
    await page.goto('/signup')
    await page.locator('input[type="text"]').fill('Test User')
    await page.locator('input[type="email"]').fill('short-pw-test@example.com')
    await page.locator('input[type="password"]').fill('12')
    await page.locator('button.dl-btn-primary').click()
    await expect(
      page.locator('.bg-red-50.border-dl-error')
    ).toBeVisible({ timeout: 10000 })
  })

  test('successful signup redirects to onboarding', async ({ page }) => {
    const uniqueEmail = `e2e-test-${Date.now()}@example.com`
    await page.goto('/signup')
    await page.locator('input[type="text"]').fill('E2E Test User')
    await page.locator('input[type="email"]').fill(uniqueEmail)
    await page.locator('input[type="password"]').fill('TestPassword123!')
    await page.locator('button.dl-btn-primary').click()
    // Successful signup redirects to /onboarding/setup
    await page.waitForURL('**/onboarding/setup**', { timeout: 15000 })
    await expect(page).toHaveURL(/\/onboarding\/setup/)
  })
})
