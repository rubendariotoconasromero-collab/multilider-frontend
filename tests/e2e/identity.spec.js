import { test, expect } from '@playwright/test'
const variants = [
  { name: 'Laravel local', base: process.env.PHASE3_BASE_LOCAL, api: process.env.PHASE3_API_LOCAL, direct: false },
  { name: 'Laravel microservices', base: process.env.PHASE3_BASE_REMOTE, api: process.env.PHASE3_API_REMOTE, direct: false },
  { name: 'Cliente directo microservices', base: process.env.PHASE3_BASE_LEGACY, api: process.env.PHASE3_SECURITY, direct: true },
]
for (const variant of variants) {
  test.describe(variant.name, () => {
    test('login, perfil, restauración y logout revocan la sesión real', async ({ page, request }) => {
      await page.goto(`${variant.base}/login`, { waitUntil: 'domcontentloaded' })
      await page.locator('#correo').fill('operator@example.test')
      await page.locator('#password').fill('Test-only-Password-42!')
      await page.getByRole('button', { name: 'Ingresar al sistema' }).click()
      await expect(page).toHaveURL(/\/admin$/)
      await page.goto(`${variant.base}/perfil`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Mi Perfil', exact: true })).toBeVisible()
      await expect(page.locator('input[type="email"]').first()).toHaveValue('operator@example.test')
      await page.reload()
      await expect(page.locator('input[type="email"]').first()).toHaveValue('operator@example.test')
      const otherTab = await page.context().newPage()
      await otherTab.goto(`${variant.base}/perfil`, { waitUntil: 'domcontentloaded' })
      await expect(otherTab.getByRole('heading', { name: 'Mi Perfil', exact: true })).toBeVisible()
      const token = await page.evaluate(() => localStorage.getItem('auth_token'))
      await page.locator('[data-bs-toggle="dropdown"]').filter({ hasText: 'Sesión Activa' }).click()
      await page.getByRole('link', { name: /Cerrar sesión/i }).click()
      await expect(page).toHaveURL(/\/login$/)
      await expect(otherTab).toHaveURL(/\/login$/)
      expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull()
      const me = await request.get(`${variant.api}${variant.direct ? '/api/auth/me' : '/api/me'}`, { headers: { Authorization: `Bearer ${token}` } })
      expect(me.status()).toBe(401)
    })
    test('una sesión almacenada inválida vuelve al login sin bucles', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'invalid-fixture-token')
        localStorage.setItem('auth_user', JSON.stringify({ id: 1, nombre: 'Fixture', correo: 'operator@example.test' }))
      })
      await page.goto(`${variant.base}/perfil`, { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/login$/)
      expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull()
    })
    test('503 al restaurar conserva la credencial y ofrece reintento', async ({ page, request }) => {
      const response = await request.post(`${variant.api}${variant.direct ? '/api/auth/login' : '/api/login'}`, { data: { correo: 'operator@example.test', password: 'Test-only-Password-42!' } })
      expect(response.status()).toBe(200)
      const login = await response.json()
      const token = login.access_token || login.accessToken
      await page.addInitScript(({ token, user }) => { localStorage.setItem('auth_token', token); localStorage.setItem('auth_user', JSON.stringify(user)) }, { token, user: login.user })
      await page.route(`${variant.api}${variant.direct ? '/api/auth/me' : '/api/me'}`, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Servicio temporalmente indisponible."}' }))
      await page.goto(`${variant.base}/perfil`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('No se pudo comprobar tu sesión.', { exact: false })).toBeVisible()
      expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBe(token)
    })
  })
}
