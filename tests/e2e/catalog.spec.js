import { test, expect } from '@playwright/test'
const variants = [
  { name: 'local', base: process.env.PHASE3_BASE_LOCAL, login: process.env.PHASE3_API_LOCAL, catalog: process.env.PHASE3_API_LOCAL },
  { name: 'gateway', base: process.env.PHASE3_BASE_REMOTE, login: process.env.PHASE3_API_REMOTE, catalog: process.env.PHASE3_API_REMOTE },
  { name: 'directo', base: process.env.PHASE3_BASE_LEGACY, login: process.env.PHASE3_SECURITY, catalog: process.env.PHASE3_PROPERTIES, direct: true },
]
for (const variant of variants) {
  test(`${variant.name}: formulario agregado, versión obsoleta y galería real`, async ({ page, request }) => {
    const login = await request.post(`${variant.login}${variant.direct ? '/api/auth/login' : '/api/login'}`, { data: { correo: 'operator@example.test', password: 'Test-only-Password-42!' } })
    expect(login.status()).toBe(200)
    const session = await login.json()
    await page.addInitScript(({ session }) => { localStorage.setItem('auth_token', session.access_token || session.accessToken); localStorage.setItem('auth_user', JSON.stringify(session.user)) }, { session })
    await page.addInitScript(() => { window.__revokedImages = 0; const original = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = url => { window.__revokedImages++; original(url) } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${variant.base}/propiedades`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Catálogo de Propiedades' })).toBeVisible()
    await page.getByRole('button', { name: /Nueva/ }).click()
    await page.getByPlaceholder('Buscar distrito...').click()
    await page.locator('.dropdown-menu.show li').filter({ hasText: 'Distrito' }).first().click()
    const sector = page.getByLabel('Sector urbano', { exact: true })
    await expect(sector.locator('option')).toHaveCount(2)
    await sector.selectOption({ index: 1 })
    await page.getByPlaceholder('Buscar por Nombre, Empresa o CI...').click()
    await page.locator('.dropdown-menu.show li').filter({ hasText: 'Propietario' }).first().click()
    await page.getByLabel('Precio de venta', { exact: true }).fill('12345.25')
    await page.getByLabel('Superficie del terreno', { exact: true }).fill('225.50')
    const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url() === `${variant.catalog}/api/propiedades`)
    await page.getByRole('button', { name: 'Guardar Propiedad' }).click()
    const response = await saved
    expect(response.status()).toBe(201)
    const property = (await response.json()).data
    expect(property.ubicacion?.id).toBeTruthy()
    expect(response.request().headers()['idempotency-key']).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Catálogo de Propiedades' })).toBeVisible()
    const row = page.locator('tr').filter({ hasText: property.codigo }).first()
    await row.getByTitle('Editar', { exact: true }).click()
    const token = session.access_token || session.accessToken
    const current = await request.get(`${variant.catalog}/api/propiedades/${property.id}`, { headers: { Authorization: `Bearer ${token}` } })
    const fresh = await current.json()
    const external = { propietario_ids: fresh.propietarios.map(p => p.id), sector_urbano_id: fresh.sector_urbano_id, tipo: fresh.tipo, moneda: fresh.moneda, precio_venta: '12000.00', superficie_m2: '225.50', activo: true }
    const updated = await request.put(`${variant.catalog}/api/propiedades/${property.id}`, { headers: { Authorization: `Bearer ${token}`, 'If-Match': `"${fresh.version}"` }, data: external })
    expect(updated.status()).toBe(200)
    const stale = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/propiedades/${property.id}`))
    await page.getByRole('button', { name: 'Actualizar Propiedad' }).click()
    expect((await stale).status()).toBe(412)
    await expect(page.getByText('La propiedad cambió o tiene una reserva vigente.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'OK', exact: true }).click()
    await page.goto(`${variant.base}/propiedades`, { waitUntil: 'domcontentloaded' })
    const imageRow = page.locator('tr').filter({ hasText: property.codigo }).first()
    await imageRow.getByTitle('Imágenes', { exact: true }).click()
    const uploaded = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/propiedades/${property.id}/imagenes`))
    await page.locator('input[type=file]').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64') })
    expect([200, 201]).toContain((await uploaded).status())
    await expect(page.locator('.image-manager img').first()).toBeVisible()
    await expect.poll(() => page.locator('.image-manager img').first().evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
    {
      const hidden = await request.delete(`${variant.catalog}/api/propiedades/${property.id}`, { headers: { Authorization: `Bearer ${token}` } })
      expect(hidden.status()).toBe(200)
      await page.goto(`${variant.base}/propiedades`, { waitUntil: 'domcontentloaded' })
      await page.locator('tr').filter({ hasText: property.codigo }).first().getByTitle('Imágenes', { exact: true }).click()
      await expect(page.locator('.image-manager img').first()).toHaveAttribute('src', /^blob:/)
      await page.locator('[data-bs-toggle="dropdown"]').filter({ hasText: 'Sesión Activa' }).click()
      await page.getByRole('link', { name: /Cerrar sesión/i }).click()
      await expect(page).toHaveURL(/\/login$/)
      expect(await page.evaluate(() => window.__revokedImages)).toBeGreaterThan(0)
    }
    expect(errors).toEqual([])
  })
}
