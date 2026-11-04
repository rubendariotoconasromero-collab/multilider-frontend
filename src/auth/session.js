const clients = new Set()

export function readSession(storage = localStorage) {
  try {
    const token = storage.getItem('auth_token')
    const user = JSON.parse(storage.getItem('auth_user') || 'null')
    if (typeof token !== 'string' || !token || !user || typeof user !== 'object' || Array.isArray(user)) return { token: null, user: null }
    return { token, user }
  } catch {
    storage.removeItem('auth_token')
    storage.removeItem('auth_user')
    return { token: null, user: null }
  }
}

export function assignments(user) {
  return (user?.roles_permisos || user?.rolesPermisos || []).map(item => ({
    role: item.rol_permiso?.rol?.nombre || item.rolPermiso?.rol?.nombre || item.nombreRol,
    permission: item.rol_permiso?.permiso?.nombre || item.rolPermiso?.permiso?.nombre || item.nombrePermiso,
  }))
}

export function clearStoredSession(storage = localStorage) {
  storage.removeItem('auth_token')
  storage.removeItem('auth_user')
  for (const client of clients) delete client.defaults.headers.common.Authorization
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:cleared'))
}

export function installSessionInterceptors(client, router) {
  clients.add(client)
  client.interceptors.request.use(config => {
    const token = localStorage.getItem('auth_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    else delete config.headers.Authorization
    return config
  })
  client.interceptors.response.use(response => response, error => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
      clearStoredSession()
      if (router.currentRoute.value.name !== 'login') router.push({ name: 'login' })
    }
    // Components may log AxiosError. Preserve UI status/errors while omitting credentials.
    for (const config of [error.config, error.response?.config]) {
      if (!config) continue
      if (config.headers?.delete) config.headers.delete('Authorization')
      else if (config.headers) delete config.headers.Authorization
      if (config.data) config.data = '[request body omitted]'
    }
    return Promise.reject(error)
  })
  return client
}
