import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const local = process.argv[2] === 'local'
const rollback = process.argv[2] === 'rollback'
const base = process.env.PHASE6_FRONTEND
const api = process.env[local ? 'PHASE5_API_LOCAL' : 'PHASE5_API']
assert.equal(process.env.MULTILIDER_TEST_ISOLATED, '1')
for (const address of [base, api]) assert.equal(new URL(address).hostname, '127.0.0.1')
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ acceptDownloads: true })
  await context.addInitScript(apiOrigin => { window.MULTILIDER_CONFIG = { apiOrigin } }, api)
  const calls = []
  const unexpected = []
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === api && url.pathname.startsWith('/api/')) calls.push(url.pathname)
    if (url.origin !== api && url.origin !== base) {
      if (url.hostname === '127.0.0.1' || ['fetch', 'xhr'].includes(request.resourceType())) unexpected.push(url.origin)
      return route.abort()
    }
    return route.continue()
  })
  const page = await context.newPage()
  const response = (path, status = 200) => page.waitForResponse(r => new URL(r.url()).pathname === path && r.status() === status)
  await Promise.all([response('/api/landing', rollback ? 503 : 200), page.goto(base, { waitUntil: 'domcontentloaded' })])
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#correo').fill('operator@example.test')
  await page.locator('#password').fill('Test-only-Password-42!')
  await Promise.all([response('/api/login'), page.locator('button[type=submit]').click()])
  await expect(page).toHaveURL(/\/admin$/)
  if (!rollback) await expect(page.locator('.kpi-val').first()).toBeVisible()
  await Promise.all([response('/api/propiedades'), page.goto(base + '/propiedades', { waitUntil: 'domcontentloaded' })])
  if (rollback) {
    assert.deepEqual(unexpected, [])
    console.log('F6-A19: restored F5 build authenticated and read the same catalog with F6 disabled.')
  } else {
    await Promise.all([response('/api/reportes/inventario-propiedades'), page.goto(base + '/reportes?r=inventario', { waitUntil: 'domcontentloaded' })])
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /PDF/ }).first().click()
    assert.match((await download).suggestedFilename(), /\.pdf$/)
    await Promise.all([response('/api/correo-masivo/grupos'), page.goto(base + '/correo-masivo', { waitUntil: 'domcontentloaded' })])
    await Promise.all([response('/api/me'), page.goto(base + '/perfil', { waitUntil: 'domcontentloaded' })])
    await expect(page.getByText('Correo Electrónico', { exact: false }).first()).toBeVisible()
    assert.equal(calls.includes('/api/dashboard/admin'), true)
    assert.deepEqual(unexpected, [])
    console.log(`F6-A01/A03: same built frontend, ${local ? 'local' : 'microservices'}, ${new Set(calls).size} Laravel endpoints.`)
  }
} finally {
  await browser.close()
}
