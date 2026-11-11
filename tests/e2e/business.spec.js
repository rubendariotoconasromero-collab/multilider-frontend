import { chromium, test, expect } from '@playwright/test'
import { createHmac, randomUUID } from 'node:crypto'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
const variants = ['LOCAL', 'REMOTE', 'DIRECT'].map(name => ({ name, base: process.env['PHASE5_BASE_' + name], api: process.env['PHASE5_API_' + name] }))
const outsideLoopback = url => ['http:', 'https:'].includes(url.protocol) && url.hostname !== '127.0.0.1'
async function useLoopbackOnly(context) {
  await context.route(outsideLoopback, route => route.abort('blockedbyclient'))
}
test.beforeEach(async ({ context }) => useLoopbackOnly(context))
async function prepare({ page, request }, variant, correo = 'operator@example.test', moneda = 'BOB', precio = '12345.25') {
  const login = await request.post(variant.api + '/api/login', { data: { correo, password: 'Test-only-Password-42!' } })
  expect(login.status()).toBe(200)
  const session = await login.json(), headers = { Authorization: 'Bearer ' + session.access_token }
  const response = await request.get(variant.api + '/api/propiedades', { headers })
  expect(response.status()).toBe(200)
  const source = (await response.json()).data[0]
  const propertyResponse = await request.post(variant.api + '/api/propiedades', {
    headers: { ...headers, 'Idempotency-Key': randomUUID() },
    data: { propietario_ids: source.propietarios.map(p => p.id), sector_urbano_id: source.sector_urbano_id, tipo: 'Lote',
      precio_venta: precio, moneda, superficie_m2: '225.50', activo: true },
  })
  expect(propertyResponse.status()).toBe(201)
  const property = (await propertyResponse.json()).data
  await page.addInitScript(({ session }) => {
    if (sessionStorage.getItem('f5-fixture-session-initialized')) return
    sessionStorage.setItem('f5-fixture-session-initialized', '1')
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

for (const variant of variants.filter(v => v.name !== 'LOCAL')) {
  test(variant.name + ': la sesión vencida pide volver a ingresar y recupera el mismo UUID', async ({ page, request }) => {
    const { headers, property } = await prepare({ page, request }, variant)
    await fillSale(page, variant, property)
    const jwt = headers.Authorization.slice('Bearer '.length)
    const [header, original] = jwt.split('.')
    const claims = JSON.parse(Buffer.from(original, 'base64url'))
    claims.exp = Math.floor(Date.now() / 1000) - 3600
    const input = header + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url')
    const expired = input + '.' + createHmac('sha256', process.env.Jwt__Key).update(input).digest('base64url')
    let submissions = 0
    let operation
    await page.route(variant.api + '/api/ventas', async route => {
      if (route.request().method() !== 'POST') return route.continue()
      submissions++
      operation = route.request().postDataJSON().operacion_id
      const response = await route.fetch()
      expect(response.status()).toBe(202)
      await page.evaluate(token => localStorage.setItem('auth_token', token), expired)
      await route.fulfill({ response })
    })
    const rejected = page.waitForResponse(r => /\/api\/operaciones\/[a-f0-9-]{36}$/.test(r.url()) && r.status() === 401)
    await page.getByRole('button', { name: 'Confirmar Venta' }).click()
    expect((await rejected).url()).toBe(variant.api + '/api/operaciones/' + operation)
    await expect(page).toHaveURL(/\/login$/)
    const pending = page.getByRole('dialog').filter({ hasText: 'Operación en proceso' })
    await pending.getByRole('button', { name: 'OK', exact: true }).click()
    await page.getByLabel('Correo electrónico').fill('operator@example.test')
    await page.getByLabel('Contraseña', { exact: true }).fill('Test-only-Password-42!')
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await page.goto(variant.base + '/ventas/nueva', { waitUntil: 'domcontentloaded' })
    const recovered = page.waitForResponse(r => r.url() === variant.api + '/api/operaciones/' + operation && r.status() === 200)
    await page.getByRole('button', { name: 'Verificar resultado' }).click()
    expect((await (await recovered).json()).id).toBe(operation)
    await expect.poll(async () => {
      const history = await request.get(variant.api + '/api/ventas?tipo_venta=CONTADO&per_page=100', { headers })
      return (await history.json()).data.filter(s => s.propiedad_id === property.id).length
    }).toBe(1)
    expect(submissions).toBe(1)
  })
}

for (const variant of variants) {
  test(variant.name + ': reabre el navegador y recupera una venta sin repetirla', async ({ request }, info) => {
    const profile = info.outputPath('chromium-profile')
    await mkdir(profile, { recursive: true })
    let browser = await chromium.launchPersistentContext(profile, { headless: true })
    let operation, property, headers
    try {
      await useLoopbackOnly(browser)
      const page = browser.pages()[0]
      ;({ property, headers } = await prepare({ page, request }, variant))
      await fillSale(page, variant, property)
      await page.route(variant.api + '/api/ventas', async route => {
        operation = route.request().postDataJSON().operacion_id
        const response = await route.fetch()
        expect([201, 202]).toContain(response.status())
        await route.abort('failed')
      })
      await page.getByRole('button', { name: 'Confirmar Venta' }).click()
      await expect(page.getByText('Operación en proceso', { exact: true })).toBeVisible()
      const rows = await page.evaluate(() => Object.entries(localStorage)
        .filter(([key]) => key.startsWith('business_operations:')).flatMap(([, value]) => JSON.parse(value)))
      const stored = rows.find(row => row.id === operation)
      expect(stored).toBeTruthy()
      expect(Object.keys(stored).sort()).toEqual(['command', 'createdAt', 'id', 'path', 'reused', 'state'])
      expect(stored.reused).toBe(false)
      await page.evaluate(() => {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      })
    } finally {
      await browser.close()
    }
    browser = await chromium.launchPersistentContext(profile, { headless: true })
    try {
      await useLoopbackOnly(browser)
      const page = browser.pages()[0]
      await page.goto(variant.base + '/login')
      await page.getByLabel('Correo electrónico').fill('operator@example.test')
      await page.getByLabel('Contraseña', { exact: true }).fill('Test-only-Password-42!')
      await page.getByRole('button', { name: 'Ingresar al sistema' }).click()
      await expect(page).toHaveURL(/\/admin$/)
      await page.goto(variant.base + '/ventas/nueva')
      const result = page.waitForResponse(r => r.url() === variant.api + '/api/operaciones/' + operation)
      await page.getByRole('button', { name: 'Verificar resultado' }).click()
      expect((await result).status()).toBe(200)
      const sales = await request.get(variant.api + '/api/ventas?tipo_venta=CONTADO&per_page=100', { headers })
      expect((await sales.json()).data.filter(s => s.propiedad_id === property.id)).toHaveLength(1)
    } finally {
      await browser.close()
    }
  })

  test(variant.name + ': perfil, empresa y propiedades respetan el alcance de reportes', async ({ page, request }) => {
    const { headers } = await prepare({ page, request }, variant, 'f5-ui-fixture@tecnoweb.space')
    await page.goto(variant.base + '/perfil')
    const password = page.getByLabel('Contraseña del correo', { exact: true })
    await password.fill('Buzón sintético sin conexión')
    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click()
    await expect(password).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click()
    await expect(password).toHaveAttribute('type', 'password')
    await page.goto(variant.base + '/empresa')
    await expect(page.getByRole('button', { name: /Guardar Cambios$/ })).toBeVisible()
    const recipients = await request.get(variant.api + '/api/reportes/destinatarios', { headers })
    if (variant.name === 'LOCAL') {
      expect(recipients.status()).toBe(200)
      expect((await recipients.json()).data.map(row => row.correo)).toContain('f5-ui-fixture@tecnoweb.space')
      await page.goto(variant.base + '/reportes?r=inventario')
      await page.getByRole('button', { name: /Enviar$/ }).click()
      await expect(page.getByText('f5-ui-fixture@tecnoweb.space', { exact: true })).toBeVisible()
    } else {
      expect(recipients.status()).toBe(503)
      expect(await recipients.json()).toMatchObject({ code: 'INTEGRATION_NOT_READY' })
      const report = await request.get(variant.api + '/api/reportes/inventario-propiedades', { headers })
      expect(report.status()).toBe(503)
      expect(await report.json()).toMatchObject({ code: 'INTEGRATION_NOT_READY' })
    }
    await page.goto(variant.base + '/propiedades')
    await expect(page.getByRole('heading', { name: 'Catálogo de Propiedades' })).toBeVisible()
    await page.getByRole('button', { name: /Nueva/ }).click()
    const submissions = []
    page.on('request', req => {
      if (req.method() === 'POST' && req.url().endsWith('/api/propiedades')) submissions.push(req)
    })
    await page.getByRole('button', { name: 'Guardar Propiedad' }).click()
    const validation = page.getByRole('dialog', { name: 'Revisa el formulario' })
    await expect(validation).toContainText('Selecciona al menos un propietario')
    await expect(validation).toContainText('Completa precio de venta')
    await validation.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Guardar Propiedad' })).toBeVisible()
    expect(submissions).toHaveLength(0)
  })

  test(variant.name + ': la interfaz respeta permisos y muestra un error de CI', async ({ page, browser, request }) => {
    const denied = await browser.newContext()
    try {
      await useLoopbackOnly(denied)
      const login = await request.post(variant.api + '/api/login', {
        data: { correo: 'sales-only@example.test', password: 'Test-only-Password-42!' },
      })
      expect(login.status()).toBe(200)
      const session = await login.json()
      await denied.addInitScript(({ session }) => {
        localStorage.setItem('auth_token', session.access_token)
        localStorage.setItem('auth_user', JSON.stringify(session.user))
      }, { session })
      const limited = await denied.newPage()
      const refusal = limited.waitForEvent('dialog')
      const opened = limited.goto(variant.base + '/clientes')
      const dialog = await refusal
      expect(dialog.message()).toContain('Acceso denegado')
      await dialog.dismiss()
      await opened
      await expect(limited).toHaveURL(/\/admin$/)
    } finally {
      await denied.close()
    }
    const jsErrors = []
    page.on('pageerror', error => jsErrors.push(error.message))
    await prepare({ page, request }, variant)
    await page.goto(variant.base + '/clientes')
    await page.getByRole('button', { name: 'Nuevo Cliente' }).click()
    const form = page.locator('#modalCliente form')
    await page.getByPlaceholder('Ej. 1234567').fill('1'.repeat(51))
    await form.locator('select').selectOption('LP')
    await form.locator('input[type=text]').nth(1).fill('Cliente ficticio inválido')
    await page.getByPlaceholder('ejemplo@correo.com').fill('invalid-length@example.test')
    const rejected = page.waitForResponse(r => r.url() === variant.api + '/api/clientes' && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Registrar Cliente' }).click()
    expect((await rejected).status()).toBe(422)
    await expect(page.getByText('Verifica los datos', { exact: true })).toBeVisible()
    expect(jsErrors).toEqual([])
  })
}

for (const variant of variants.filter(v => v.name !== 'LOCAL')) {
  test(variant.name + ': no hay contrato ni pago accionable mientras la venta está pendiente', async ({ page, request }) => {
    const { headers, property } = await prepare({ page, request }, variant)
    await fillSale(page, variant, property)
    let marker, operation
    await page.route(variant.api + '/api/ventas', async route => {
      operation = route.request().postDataJSON().operacion_id
      expect(operation).toMatch(/^[a-f0-9-]{36}$/)
      const directory = process.env.MULTILIDER_F5_BOUNDARY_DIR
      expect(directory).toMatch(/f5-boundary-[a-f0-9]{32}$/)
      marker = join(directory, operation.replaceAll('-', '') + '-AutorizarConfirmacion-before')
      await writeFile(marker + '.arm', '')
      await route.continue()
    })
    try {
      const accepted = page.waitForResponse(r => r.request().method() === 'POST' && r.url() === variant.api + '/api/ventas')
      await page.getByRole('button', { name: 'Confirmar Venta' }).click()
      expect((await accepted).status()).toBe(202)
      await expect.poll(() => access(marker + '.hit').then(() => true, () => false)).toBe(true)
      const progress = await request.get(variant.api + '/api/operaciones/' + operation, { headers })
      const pending = await progress.json()
      expect(pending).toMatchObject({ state: 'Pendiente', step: 'AutorizarConfirmacion', venta_id: expect.any(Number) })
      await expect(page.getByText('¡Venta Registrada!', { exact: true })).toHaveCount(0)
      const other = await page.context().newPage()
      await other.goto(variant.base + '/contratos')
      await expect(other.getByRole('heading', { name: /Contratos/ }).first()).toBeVisible()
      await expect(other.locator('tr').filter({ hasText: property.codigo }).getByTitle('Gestionar contrato')).toHaveCount(0)
      await other.goto(variant.base + '/pagos')
      await expect(other.getByRole('heading', { name: /Pagos/ }).first()).toBeVisible()
      const saleCode = 'VTA-' + String(pending.venta_id).padStart(5, '0')
      await expect(other.locator('tr').filter({ hasText: saleCode }).getByTitle('Procesar cobro en efectivo')).toHaveCount(0)
    } finally {
      if (marker) await writeFile(marker + '.release', '')
    }
    await expect(page.getByText('¡Venta Registrada!', { exact: true })).toBeVisible({ timeout: 25000 })
  })
}

test('P01: parámetros de retorno falsificados solo consultan una orden pendiente', async ({ page, request }) => {
  const variant = variants[0]
  const { headers, property } = await prepare({ page, request }, variant)
  const cmd = randomUUID()
  const sale = await request.post(variant.api + '/api/ventas', {
    headers: { ...headers, 'Idempotency-Key': cmd },
    data: { operacion_id: cmd, command_id: cmd, cliente_id: 1, asesor_id: 1, propiedad_id: property.id,
      fecha: '2026-11-04', tipo_venta: 'CONTADO', monto_total: '12345.25', monto_liquido: '12345.25' },
  })
  expect(sale.status()).toBe(201)
  const id = (await sale.json()).data.id
  const obligations = await request.get(variant.api + '/api/pagos?nota_venta_id=' + id, { headers })
  const pending = (await obligations.json()).data.find(p => p.estado === 'PENDIENTE_PAGO')
  expect(pending).toBeTruthy()
  const order = randomUUID()
  const reference = 'TEMP-' + order
  const registered = await request.post(variant.api + '/api/public/pagos/procesar', { data: {
    operacion_id: order, cliente_id: 1, pago_ids: [pending.id], cuota_ids: [],
    ci_pagador: 'FICTICIO', telefono_pagador: '70000000', nombres_pagador: 'Cliente',
    apellidos_pagador: 'Ficticio', correo_pagador: 'browser@example.test',
  } })
  expect(registered.status()).toBe(200)
  const writes = []
  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/api/public/pagos/')) writes.push(req)
  })
  const verification = page.waitForResponse(r => r.url() === variant.api + '/api/public/pagos/confirmar-retorno')
  await page.goto(variant.base + '/pagar?txn=' + reference + '&estado=PAGADO_PRUEBA&pagado=true&monto=0.20')
  const result = await verification
  expect(result.status()).toBe(200)
  expect(result.request().postDataJSON()).toEqual({ id_transaccion: reference })
  expect(await result.json()).toMatchObject({ estado: 'PENDIENTE_PAGO', deuda_real_liquidada: false })
  await expect(page.getByText('La deuda real permanece pendiente;', { exact: false })).toHaveCount(0)
  expect(writes.map(r => r.url())).toEqual([variant.api + '/api/public/pagos/confirmar-retorno'])
  const unchanged = await request.get(variant.api + '/api/pagos/' + pending.id, { headers })
  expect(await unchanged.json()).toMatchObject({ estado: 'PENDIENTE_PAGO' })
})

test('LOCAL: sesión y formulario permiten registrar, editar y ocultar una propiedad', async ({ page, request }) => {
  const variant = variants[0]
  const { headers } = await prepare({ page, request }, variant)
  await page.goto(variant.base + '/propiedades')
  await page.getByRole('button', { name: /Nueva/ }).click()
  await page.getByPlaceholder('Buscar distrito...').click()
  await page.locator('.dropdown-menu.show li').filter({ hasText: 'Distrito' }).first().click()
  await page.getByLabel('Sector urbano', { exact: true }).selectOption({ index: 1 })
  await page.getByPlaceholder('Buscar por Nombre, Empresa o CI...').click()
  await page.locator('.dropdown-menu.show li').filter({ hasText: 'Propietario' }).first().click()
  await page.getByLabel('Precio de venta', { exact: true }).fill('1234.25')
  await page.getByLabel('Superficie del terreno', { exact: true }).fill('225.50')
  const registered = page.waitForResponse(r => r.url() === variant.api + '/api/propiedades' && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar Propiedad' }).click()
  const result = await registered
  expect(result.status()).toBe(201)
  const property = (await result.json()).data
  const row = page.locator('tr').filter({ hasText: property.codigo }).first()
  await row.getByTitle('Editar', { exact: true }).click()
  await page.getByLabel('Precio de venta', { exact: true }).fill('1254.75')
  const edited = page.waitForResponse(r => r.url() === variant.api + '/api/propiedades/' + property.id && r.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Actualizar Propiedad' }).click()
  expect((await edited).status()).toBe(200)
  await row.getByTitle('Ocultar', { exact: true }).click()
  await page.getByRole('button', { name: 'Sí, ocultar', exact: true }).click()
  await expect(row.getByTitle('Publicar', { exact: true })).toBeVisible()
  const saved = await request.get(variant.api + '/api/propiedades/' + property.id, { headers })
  const body = await saved.json()
  expect(Number(body.precio_venta)).toBe(1254.75)
  expect(Boolean(body.activo)).toBe(false)
})

for (const variant of variants) {
  test(variant.name + ': pago pendiente muestra la cuenta asignada a Efectivo', async ({ page, request }) => {
    const moneda = variant.name === 'LOCAL' ? 'BOB' : 'USD'
    const account = moneda === 'BOB' ? 1 : 2
    const amount = variant.name === 'LOCAL' ? '777.21' : variant.name === 'REMOTE' ? '777.22' : '777.23'
    const { headers, property } = await prepare({ page, request }, variant, 'operator@example.test', moneda, amount)
    const cmd = randomUUID()
    const mapping = await request.post(variant.api + '/api/mapeo-metodos-cuentas', {
      headers: { ...headers, 'Idempotency-Key': cmd }, data: { metodo_pago_id: 1, cuenta_bancaria_id: account },
    })
    expect([200, 201]).toContain(mapping.status())
    const operation = randomUUID()
    const sale = await request.post(variant.api + '/api/ventas', {
      headers: { ...headers, 'Idempotency-Key': operation },
      data: { operacion_id: operation, command_id: operation, cliente_id: 1, asesor_id: 1, propiedad_id: property.id,
        expected_version: property.version, fecha: '2026-11-04', tipo_venta: 'CONTADO', monto_total: amount, monto_liquido: amount },
    })
    expect([201, 202]).toContain(sale.status())
    if (sale.status() === 202) {
      await expect.poll(async () => {
        const response = await request.get(variant.api + '/api/operaciones/' + operation, { headers })
        return (await response.json()).state
      }, { timeout: 20000 }).toBe('Completada')
    }
    const company = await request.get(variant.api + '/api/empresa/datos')
    expect(company.status()).toBe(200)
    await page.goto(variant.base + '/pagos')
    const payment = page.locator('tr').filter({ hasText: new RegExp(amount.replace('.', '[,.]')) })
    await payment.getByTitle('Procesar cobro en efectivo').click()
    await expect(page.locator('.modal-overlay input[disabled]').nth(1)).toHaveValue('Caja ' + moneda)
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  })
}
