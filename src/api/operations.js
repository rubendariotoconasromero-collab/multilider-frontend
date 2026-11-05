const family = /^(ventas|clientes|asesores|contratos|entregas|pagos|planes-pago|metodos-pago|cuentas-bancarias|mapeo-metodos-cuentas|ingresos|egresos)(\/|$)/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function key(storage, api) {
  let user
  try { user = JSON.parse(storage.getItem('auth_user') || 'null') } catch { user = null }
  let issuer = user?.issuer || user?.identity_origin || ''
  try { issuer = JSON.parse(atob((storage.getItem('auth_token') || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).iss || issuer } catch { /* partition only; authentication still belongs to the server */ }
  return 'business_operations:' + JSON.stringify([api?.defaults?.baseURL || '', issuer, user?.id || 'anonymous'])
}
function notify() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('business-operations')) }
export function pendingOperations(api, storage = localStorage) {
  try {
    const rows = JSON.parse(storage.getItem(key(storage, api)) || '[]')
    return Array.isArray(rows) ? rows.filter(r => r && uuid.test(r.id)).slice(-100) : []
  } catch { return [] }
}
function save(api, row, storage) {
  const rows = pendingOperations(api, storage).filter(r => r.id !== row.id)
  rows.push(row)
  try { storage.setItem(key(storage, api), JSON.stringify(rows.slice(-100))) } catch { /* network operation remains recoverable in server */ }
  notify()
}
export function forgetOperation(api, id, storage = localStorage) {
  try { storage.setItem(key(storage, api), JSON.stringify(pendingOperations(api, storage).filter(r => r.id !== id))) } catch { /* storage unavailable */ }
  notify()
}
export class OperationPending extends Error {
  constructor(id) { super('La operación sigue en proceso. Consúltala antes de volver a enviarla.'); this.operationPending = true; this.operationId = id }
}
export async function consultOperation(api, id, storage = localStorage) {
  if (!uuid.test(id)) throw new Error('Operación inválida')
  const response = await api.get('/operaciones/' + id, { _operationPoll: true })
  const state = response.data?.state || response.data?.estado_operacion
  if (['Completada', 'Compensada', 'Rechazada'].includes(state)) forgetOperation(api, id, storage)
  return response.data
}
export function installBusinessInterceptors(api, options = {}) {
  const storage = options.storage || localStorage
  const newId = options.newId || (() => crypto.randomUUID())
  const delay = options.delay || (ms => new Promise(resolve => setTimeout(resolve, ms)))
  api.interceptors.request.use(config => {
    const path = String(config.url || '').replace(/^\/?api\//, '').replace(/^\//, '').split('?')[0]
    if (!family.test(path) || ['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) return config
    const multipart = typeof FormData !== 'undefined' && config.data instanceof FormData
    let data = config.data
    if (!multipart) {
      if (typeof data === 'string') { try { data = JSON.parse(data) } catch { return config } }
      data = data && typeof data === 'object' ? { ...data } : {}
    }
    const existing = multipart ? data.get('operacion_id') : data.operacion_id
    const command = multipart ? data.get('command_id') : data.command_id
    const pending = pendingOperations(api, storage).find(row => row.path === path)
    const id = existing || pending?.id || newId()
    const cmd = command || pending?.command || newId()
    if (!uuid.test(id) || !uuid.test(cmd)) throw new Error('Identificador de operación inválido')
    if (multipart) {
      if (!existing) data.append('operacion_id', id)
      if (!command) data.append('command_id', cmd)
    } else { data.operacion_id = id; data.command_id = cmd }
    config.data = data
    config.headers = config.headers || {}
    config.headers['Idempotency-Key'] = cmd
    config._businessOperation = { id, command: cmd, path, reused: !!pending }
    save(api, { id, command: cmd, path, state: 'Enviando', createdAt: new Date().toISOString() }, storage)
    return config
  })
  api.interceptors.response.use(async response => {
    const operation = response.config?._businessOperation
    if (!operation) return response
    if (response.status !== 202) {
      forgetOperation(api, operation.id, storage)
      return response
    }
    save(api, { ...operation, state: 'Pendiente', createdAt: new Date().toISOString() }, storage)
    for (let i = 0; i < (options.polls ?? 15); i++) {
      await delay(1000)
      let current
      try { current = await consultOperation(api, operation.id, storage) }
      catch { throw new OperationPending(operation.id) }
      const state = current.state || current.estado_operacion
      if (state === 'Completada') {
        let body = current.resultado
        if (!body && current.venta_id && current.kind === 'venta') body = { data: (await api.get('/ventas/' + current.venta_id)).data }
        if (!body && current.resource_id && ['cliente', 'asesor'].includes(current.kind)) {
          body = { data: (await api.get('/' + (current.kind === 'cliente' ? 'clientes' : 'asesores') + '/' + current.resource_id)).data }
        }
        return { ...response, status: 200, data: body || { message: 'Operación completada.', operacion_id: operation.id, data: current } }
      }
      if (['Compensada', 'Rechazada'].includes(state)) {
        const error = new Error('La operación no se completó y sus cambios fueron cancelados.')
        error.response = { status: 409, data: { message: error.message } }
        throw error
      }
      if (['REAUTHORIZATION_REQUIRED', 'CREDENTIAL_REQUIRED', 'IDENTITY_CONFLICT'].includes(current.error_code) || state === 'RequiereRevision') throw new OperationPending(operation.id)
    }
    throw new OperationPending(operation.id)
  }, error => {
    const operation = error.config?._businessOperation
    if (operation && !operation.reused && error.response && [400, 401, 403, 404, 409, 412, 413, 422].includes(error.response.status)) {
      forgetOperation(api, operation.id, storage)
    }
    if (operation && (!error.response || error.response.status >= 500)) {
      save(api, { ...operation, state: 'ResultadoIncierto', createdAt: new Date().toISOString() }, storage)
      return Promise.reject(new OperationPending(operation.id))
    }
    return Promise.reject(error)
  })
  return api
}
