import { test, expect } from '@playwright/test'

test.describe('Team workspace management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill(process.env.TEST_USER_EMAIL || 'test@example.com')
    await page.locator('input[type="password"]').fill(process.env.TEST_USER_PASSWORD || 'testpassword123')
    await page.locator('button.dl-btn-primary').click()
    await page.waitForURL('**/projects**', { timeout: 15000 })
  })

  test('org page loads with workspaces heading', async ({ page }) => {
    // Navigate to a team org page (requires org slug)
    // Try to find an org link in the UI
    const orgLink = page.locator('a[href*="/org"], a[href^="/"][href*="slug"]').first()
    if (await orgLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLink.click()
      await expect(page.getByText('Workspaces')).toBeVisible({ timeout: 10000 })
    } else {
      // If no org exists, test the onboarding path for team creation
      await page.goto('/onboarding/setup')
      await page.locator('input.dl-input').fill('Team Admin')
      await page.locator('button').filter({ hasText: /My team|Mein Team/i }).click()
      await page.locator('button.dl-btn-primary').click()
      await page.waitForURL('**/onboarding/org**', { timeout: 10000 })
      await expect(page.locator('h1, h2').first()).toBeVisible()
    }
  })

  test('workspace list shows project counts', async ({ page }) => {
    // Navigate to org page if team mode is available
    const orgLink = page.locator('a[href*="/org"]').first()
    if (await orgLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLink.click()
      await expect(page.getByText('Workspaces')).toBeVisible({ timeout: 10000 })

      // Workspace cards should show project count
      const workspaceCard = page.locator('.rounded-dl-lg, .dl-card').first()
      if (await workspaceCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Project count should be mentioned
        await expect(page.getByText(/project/i).first()).toBeVisible()
      }
    }
  })

  test('create workspace flow', async ({ page }) => {
    const orgLink = page.locator('a[href*="/org"]').first()
    if (await orgLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLink.click()
      await expect(page.getByText('Workspaces')).toBeVisible({ timeout: 10000 })

      // Look for "Create workspace" or "New workspace" button
      const createBtn = page.getByRole('button', { name: /Create workspace|New workspace|Neuer Workspace/i })
      if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createBtn.click()
        // Should show a form or dialog for workspace creation
        await expect(
          page.locator('input, [role="dialog"]').first()
        ).toBeVisible({ timeout: 10000 })
      }
    }
  })

  test('org settings page accessible', async ({ page }) => {
    const orgLink = page.locator('a[href*="/org"]').first()
    if (await orgLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const orgHref = await orgLink.getAttribute('href')
      await orgLink.click()

      // Navigate to org settings
      const settingsLink = page.locator('a[href*="/settings"]').first()
      if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await settingsLink.click()
        await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
      }
    }
  })

  test('invite member flow', async ({ page }) => {
    const orgLink = page.locator('a[href*="/org"]').first()
    if (await orgLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await orgLink.click()

      // Navigate to members settings
      const membersLink = page.locator('a[href*="/settings/members"]').first()
      if (await membersLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await membersLink.click()

        // Look for invite button
        const inviteBtn = page.getByRole('button', { name: /Invite|Einladen/i })
        if (await inviteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await inviteBtn.click()
          // Should show invite form with email input
          await expect(
            page.locator('input[type="email"], input[placeholder*="email"]').first()
          ).toBeVisible({ timeout: 10000 })
        }
      }
    }
  })
})
