import { expect, test as base } from '@playwright/test'

/** Fails any test whose page logs an error or throws. */
const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
      await use(errors)
      expect(errors).toEqual([])
    },
    { auto: true },
  ],
})

const PAGES = [
  ['/', 'Learn poker by playing'],
  ['/play', 'Play'],
  ['/drills', 'Drills'],
  ['/drills/outs', 'Outs'],
  ['/hands', 'Hand histories'],
  ['/charts', 'Preflop charts'],
  ['/solver', 'River solver'],
  ['/progress', 'Progress'],
  ['/no-such-page', 'Page not found'],
] as const

// Skip the Play tour unless a test is about it.
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes('tour')) return
  await page.addInitScript(() => localStorage.setItem('poker-coach:tour:v1', '1'))
})

test('every page has its heading and fits the screen', async ({ page }) => {
  for (const [path, heading] of PAGES) {
    await page.goto(path)
    await expect(page.locator('main h1')).toContainText(heading)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow, `horizontal scroll on ${path}`).toBeLessThanOrEqual(0)
  }
})

test('links change the page in place and the back button works', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Browse drills/ }).click()
  await expect(page).toHaveURL('/drills')
  await expect(page).toHaveTitle('Drills · Poker Coach')
  // The new page's heading gets focus, for screen readers.
  await expect(page.locator('main h1')).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(page.locator('main h1')).toContainText('Learn poker')
})

test('old hash links still work', async ({ page }) => {
  await page.goto('/#/solver')
  await expect(page).toHaveURL('/solver')
  await expect(page.locator('main h1')).toHaveText('River solver')
})

test('dropdown menus open, close and navigate', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones use the menu button')
  await page.goto('/')
  const drills = page.getByRole('button', { name: 'Drills' })
  await drills.click()
  await expect(drills).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(drills).toHaveAttribute('aria-expanded', 'false')

  const study = page.getByRole('button', { name: 'Study' })
  await study.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#menu-study a').first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('#menu-study a').nth(1)).toBeFocused()
  await page.mouse.click(1000, 700)
  await expect(study).toHaveAttribute('aria-expanded', 'false')

  await drills.click()
  await page.locator('#menu-drills').getByRole('link', { name: /^Outs/ }).click()
  await expect(page).toHaveURL('/drills/outs')
  await expect(drills).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.prompt')).toBeVisible()
})

test('the phone menu covers the screen and navigates', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only')
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  const menu = page.locator('#mobile-menu')
  await expect(menu).toBeVisible()
  const box = await menu.boundingBox()
  expect(box!.height).toBeGreaterThan(400)
  await menu.getByRole('link', { name: 'Board texture' }).click()
  await expect(page).toHaveURL('/drills/texture')
  await expect(menu).toBeHidden()
})

test('the drill switcher moves between drills', async ({ page }) => {
  await page.goto('/drills/outs')
  await page.locator('.drill-switcher').getByRole('link', { name: 'Set mining' }).click()
  await expect(page).toHaveURL('/drills/setmine')
  await expect(page.locator('main h1')).toHaveText('Set mining')
})

test('the theme switch is remembered', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page
    .locator('.header-actions')
    .getByRole('button', { name: 'Switch to light theme' })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('the Play tour shows on the first visit only', async ({ page }) => {
  await page.goto('/play')
  const tour = page.getByRole('dialog')
  await expect(tour).toContainText('Your table')
  await tour.getByRole('button', { name: 'Next' }).click()
  await expect(tour).toContainText('Your decisions')
  await tour.getByRole('button', { name: 'Skip' }).click()
  await expect(tour).toBeHidden()
  await page.reload()
  await expect(page.locator('main h1')).toHaveText('Play')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: 'How it works' }).click()
  await expect(page.getByRole('dialog')).toContainText('Your table')
})

test('table settings fold into a popover on phones', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only')
  await page.goto('/play')
  const lineup = page.getByLabel('Opponent types')
  await expect(lineup).toBeHidden()
  await page.getByRole('button', { name: 'Table' }).click()
  await expect(lineup).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(lineup).toBeHidden()
})

test('progress backs up and restores', async ({ page }) => {
  await page.goto('/progress')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^poker-coach-backup-.*\.json$/)

  const input = page.locator('input[type=file]')
  await input.setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  })
  await expect(page.locator('.form-error')).toContainText('isn’t a Poker Coach backup')

  page.on('dialog', (d) => d.accept())
  const backup = { app: 'poker-coach', version: 1, data: { 'poker-coach:theme': 'light' } }
  await input.setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})
