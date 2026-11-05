import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const variants = ['LOCAL', 'REMOTE', 'DIRECT'].map(name => ({ name, base: process.env['PHASE5_BASE_' + name], api: process.env['PHASE5_API_' + name] }))
async function prepare({ page, request }, variant) {
  const login = await request.post(variant.api + '/api/login', { data: { correo: 'operator@example.test', password: 'Test-only-Password-42!' } })
  expect(login.status()).toBe(200)
  const session = await login.json(), headers = { Authorization: 'Bearer ' + session.access_token }
  const response = await request.get(variant.api + '/api/propiedades', { headers })
  expect(response.status()).toBe(200)
  const source = (await response.json()).data[0]
  const propertyResponse = await request.post(variant.api + '/api/propiedades', {
    headers: { ...headers, 'Idempotency-Key': randomUUID() },
    data: { propietario_ids: source.propietarios.map(p => p.id), sector_urbano_id: source.sector_urbano_id, tipo: 'Lote',
      precio_venta: '12345.25', moneda: 'BOB', superficie_m2: '225.50', activo: true },
  })
  expect(propertyResponse.status()).toBe(201)
  const property = (await propertyResponse.json()).data
  await page.addInitScript(({ session }) => {
    localStorage.setItem('auth_token', session.access_token); localStorage.setItem('auth_user', JSON.stringify(session.user))
  }, { session })
  return { headers, property }
}
async function fillSale(page, variant, property) {
  await page.goto(variant.base + '/ventas/nueva', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Registro de Nueva Venta' })).toBeVisible()
  await page.getByPlaceholder('Busca por Nombre o CI...').click()
  await page.locator('.dropdown-menu.show li a').first().click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByPlaceholder('Busca por Código de Propiedad...').fill(property.codigo)
  await page.locator('.dropdown-menu.show li a').filter({ hasText: property.codigo }).first().click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByPlaceholder('Busca por nombre o correo...').click()
  await page.locator('.dropdown-menu.show li a').first().click()
}
for (const variant of variants) {
  test(`${variant.name}: venta desde UI con resultado y lecturas de sus autoridades`, async ({ page, request }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    const { headers, property } = await prepare({ page, request }, variant)
    await fillSale(page, variant, property)
    const admitted = page.waitForResponse(r => r.request().method() === 'POST' && r.url() === variant.api + '/api/ventas')
    await page.getByRole('button', { name: 'Confirmar Venta' }).click()
    expect([200, 201, 202]).toContain((await admitted).status())
    await expect(page.getByText('¡Venta Registrada!', { exact: true })).toBeVisible({ timeout: 25000 })
    const history = await request.get(variant.api + '/api/ventas?tipo_venta=CONTADO', { headers })
    expect(history.status()).toBe(200)
    const sale = (await history.json()).data.find(s => s.propiedad_id === property.id)
    expect(sale.estado).toBe('Completada'); expect(Number(sale.monto_liquido)).toBe(12345.25)
    expect(sale.propiedad.codigo).toBe(property.codigo)
    await page.getByRole('button', { name: 'OK', exact: true }).click()
    await page.goto(variant.base + '/contratos', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('td span.fw-semibold').filter({ hasText: new RegExp('^' + property.codigo + '$') }).first()).toBeVisible()
    expect(errors).toEqual([])
  })
}
test('REMOTE: pérdida real del acuse se recupera tras recargar sin reenviar la venta', async ({ page, request }) => {
  const variant = variants.find(v => v.name === 'REMOTE')
  const { headers, property } = await prepare({ page, request }, variant)
  await fillSale(page, variant, property)
  let submitted = 0
  await page.route(variant.api + '/api/ventas', async route => { submitted++; await route.fetch(); await route.abort('failed') })
  await page.getByRole('button', { name: 'Confirmar Venta' }).click()
  await expect(page.getByText('Operación en proceso', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Verificar resultado' })).toBeVisible()
  for (let i = 0; i < 10; i++) {
    const response = page.waitForResponse(r => r.request().method() === 'GET' && /\/api\/operaciones\/[a-f0-9-]{36}$/.test(r.url()))
    await page.getByRole('button', { name: 'Verificar resultado' }).click()
    await response
    await expect.poll(async () => await page.getByText('Operación completada. Puedes actualizar la vista.', { exact: true }).isVisible() || await page.getByRole('button', { name: 'Verificar resultado' }).isEnabled().catch(() => false)).toBe(true)
    if (await page.getByText('Operación completada. Puedes actualizar la vista.', { exact: true }).isVisible()) break
    await page.waitForTimeout(500)
  }
  await expect(page.getByText('Operación completada. Puedes actualizar la vista.', { exact: true })).toBeVisible()
  expect(submitted).toBe(1)
  const history = await request.get(variant.api + '/api/ventas?tipo_venta=CONTADO', { headers })
  expect((await history.json()).data.filter(s => s.propiedad_id === property.id)).toHaveLength(1)
})
