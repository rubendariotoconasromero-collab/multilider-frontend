import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const local = process.argv[2] === 'local'
const base = process.env.PHASE8_FRONTEND
const api = process.env[local ? 'PHASE5_API_LOCAL' : 'PHASE5_API']
assert.equal(process.env.MULTILIDER_TEST_ISOLATED, '1')
for (const origin of [base, api]) assert.equal(new URL(origin).hostname, '127.0.0.1')

const browser = await chromium.launch()
try {
  const context = await browser.newContext()
  await context.addInitScript(origin => { window.MULTILIDER_CONFIG = { apiOrigin: origin } }, api)
  const apiOrigins = new Set()
  await context.route('**/*', route => {
    const request = route.request()
    const { origin } = new URL(request.url())
    if (['fetch', 'xhr'].includes(request.resourceType())) apiOrigins.add(origin)
    return origin === base || origin === api ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#correo').fill('operator-f8@example.test')
  await page.locator('#password').fill('Test-only-Password-42!')
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto(base + '/pagos', { waitUntil: 'domcontentloaded' })
  const pending = page.getByRole('row').filter({ hasText: /USD/ }).filter({ has: page.getByRole('button', { name: 'Cobrar' }) })
  await expect(pending).toHaveCount(2)
  await pending.first().getByRole('button', { name: 'Cobrar' }).click()
  const accounts = page.getByLabel('Cuenta Destino')
  await expect(accounts).toBeEnabled()
  if (!local) await expect(accounts.locator('option')).toHaveCount(2)
  await accounts.selectOption({ label: 'Caja USD ensayo F8' })
  await expect(accounts.locator('option:checked')).toHaveText('Caja USD ensayo F8')
  await expect(page.getByRole('button', { name: 'Confirmar Cobro' })).toBeEnabled()
  assert.deepEqual([...apiOrigins], [api])
  console.log(`F8 navegador (${local ? 'local' : 'microservices'}): importes USD y selección de la cuenta de ensayo por Laravel.`)
} finally {
  await browser.close()
}
