// A command key survives an uncertain response and a page reload, scoped to the signed-in identity.
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]))
  return value
}
export async function fingerprint(body) {
  let value = body
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    value = []
    for (const [name, file] of body.entries()) value.push([name, typeof file === 'string' ? file : Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())))])
    value.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  }
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical(value)))))).map(b => b.toString(16).padStart(2, '0')).join('')
}
export async function loadOptions(api, kind) {
  let page = 1, last = 1, rows = [], capabilities = {}
  do {
    const response = await api.get('/catalogo/opciones-propiedad', { params: { kind, page, per_page: 1000 } })
    const result = response.data.opciones
    if (!Array.isArray(result?.data) || result.current_page !== page || !Number.isInteger(result.last_page) || result.last_page < page) throw new Error('Respuesta de selector inválida')
    rows.push(...result.data); last = result.last_page; capabilities = response.data.capabilities
    page++
  } while (page <= last)
  return { data: { data: rows }, capabilities }
}
export async function catalogCommand(api, method, path, body, version, storage = localStorage) {
  const user = JSON.parse(localStorage.getItem('auth_user') || 'null')
  if (!user?.id || !localStorage.getItem('auth_token')) throw new Error('Inicia sesión para guardar.')
  const token = localStorage.getItem('auth_token')
  let identity = `local|${user.id}`
  if (token.split('.').length === 3) {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')))
    if (typeof claims.iss !== 'string' || typeof claims.sub !== 'string') throw new Error('Vuelve a iniciar sesión.')
    identity = `${claims.iss}|${claims.sub}`
  }
  const scope = `${api.defaults.baseURL}|${identity}`
  const slot = `catalog-command:${scope}:${method}:${path}`
  const hash = await fingerprint([body instanceof FormData ? await fingerprint(body) : body, version])
  let pending = JSON.parse(storage.getItem(slot) || 'null')
  if (pending) {
    try {
      const known = await api.get(`/catalogo/operaciones/${pending.id}`)
      storage.removeItem(slot)
      if (pending.hash !== hash) throw new Error('La operación anterior fue guardada. Recarga la propiedad antes de cambiar los datos.')
      return { status: known.data.status, data: known.data.result, headers: { etag: known.data.etag } }
    } catch (error) {
      if (error.response?.status !== 404) throw error
      if (pending.hash !== hash) throw new Error('Hay un guardado con resultado pendiente. Reintenta los mismos datos antes de modificarlos.')
    }
  } else {
    pending = { id: crypto.randomUUID(), hash }; storage.setItem(slot, JSON.stringify(pending))
  }
  const headers = { 'Idempotency-Key': pending.id }
  if (version) headers['If-Match'] = `"${version}"`
  try {
    const result = await api.request({ method, url: path, data: body, headers: body instanceof FormData ? { ...headers, 'Content-Type': undefined } : headers })
    storage.removeItem(slot); return result
  } catch (error) {
    if (error.response && error.response.status < 500) storage.removeItem(slot)
    throw error
  }
}
