import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readSession, assignments, clearStoredSession, installSessionInterceptors } from '../src/auth/session.js'

beforeEach(() => {
  const values = new Map()
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
})
test('invalid persisted user cannot break application startup', () => {
  localStorage.setItem('auth_token', 'fixture'); localStorage.setItem('auth_user', '{broken')
  assert.deepEqual(readSession(), { token: null, user: null })
  assert.equal(localStorage.getItem('auth_token'), null)
})
test('local and direct microservice assignment contracts remain usable', () => {
  const local = { roles_permisos: [{ rol_permiso: { rol: { nombre: 'Cliente' }, permiso: { nombre: 'acceso_pagos' } } }] }
  const remote = { rolesPermisos: [{ nombreRol: 'Cliente', nombrePermiso: 'acceso_pagos' }] }
  assert.deepEqual(assignments(local), assignments(remote))
})
test('401 clears every registered client and 403/503 preserve session', async () => {
  const callbacks = []
  const client = () => ({ defaults: { headers: { common: { Authorization: 'Bearer fixture' } } }, interceptors: { request: { use() {} }, response: { use: (_, handler) => callbacks.push(handler) } } })
  const a = client(), b = client()
  const router = { currentRoute: { value: { name: 'login' } } }
  installSessionInterceptors(a, router); installSessionInterceptors(b, router)
  localStorage.setItem('auth_token', 'fixture'); localStorage.setItem('auth_user', '{}')
  for (const status of [403, 503]) {
    await assert.rejects(callbacks[0]({ response: { status }, config: { url: '/me' } }))
    assert.equal(localStorage.getItem('auth_token'), 'fixture')
  }
  await assert.rejects(callbacks[0]({ response: { status: 401 }, config: { url: '/me' } }))
  assert.equal(localStorage.getItem('auth_token'), null)
  assert.equal(a.defaults.headers.common.Authorization, undefined)
  assert.equal(b.defaults.headers.common.Authorization, undefined)
})
test('clearing an empty session is idempotent', () => {
  clearStoredSession(); clearStoredSession(); assert.deepEqual(readSession(), { token: null, user: null })
})
test('errors keep validation status while omitting credentials from loggable config', async () => {
  let callback
  const client = { defaults: { headers: { common: {} } }, interceptors: { request: { use() {} }, response: { use: (_, handler) => { callback = handler } } } }
  installSessionInterceptors(client, {})
  const error = { response: { status: 422, data: { errors: { password_actual: ['Invalid'] } } }, config: { url: '/perfil/cambiar-password', headers: { Authorization: 'Bearer sensitive-fixture' }, data: '{"password_actual":"sensitive-fixture"}' } }
  await assert.rejects(callback(error))
  assert.equal(error.response.status, 422)
  assert.equal(error.config.headers.Authorization, undefined)
  assert.equal(error.config.data, '[request body omitted]')
})
