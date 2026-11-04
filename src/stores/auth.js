import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../api/axios'
import { useRouter } from 'vue-router'
import { readSession, assignments, clearStoredSession } from '../auth/session'

export const useAuthStore = defineStore('auth', () => {
  const saved = readSession()
  const token = ref(saved.token)
  const user = ref(saved.user)
  const sessionChecked = ref(false)
  const sessionUnavailable = ref(false)
  const router = useRouter()
  let restoring = null
  const clearAuth = () => { token.value = null; user.value = null; sessionChecked.value = true; sessionUnavailable.value = false }
  window.addEventListener('auth:cleared', clearAuth)
  window.addEventListener('storage', event => {
    if (event.key === 'auth_token' || event.key === 'auth_user') {
      const next = readSession(); token.value = next.token; user.value = next.user; sessionChecked.value = false
      if (!next.token) { clearStoredSession(); router.push({ name: 'login' }) }
    }
  })
  const setAuth = (newToken, newUser) => {
    token.value = newToken; user.value = newUser
    localStorage.setItem('auth_token', newToken); localStorage.setItem('auth_user', JSON.stringify(newUser))
    sessionChecked.value = true; sessionUnavailable.value = false
  }
  const updateUser = updated => { user.value = updated; localStorage.setItem('auth_user', JSON.stringify(updated)) }
  const restoreSession = async (force = false) => {
    if (!token.value || (sessionChecked.value && !force)) return
    if (restoring) return restoring
    const restoringToken = token.value
    restoring = (async () => {
      try { const response = await api.get('/me'); if (token.value === restoringToken) { updateUser(response.data); sessionUnavailable.value = false } }
      catch (error) {
        if (error.response?.status === 401) clearStoredSession()
        else sessionUnavailable.value = true
      } finally { sessionChecked.value = true; restoring = null }
    })()
    return restoring
  }
  const logout = async () => {
    try { await api.post('/logout') }
    catch (error) {
      sessionStorage.setItem('auth_logout_notice', error.response?.data?.code === 'REVOCATION_PENDING'
        ? 'Sesión cerrada en este equipo. La revocación global está pendiente de confirmación.'
        : 'Sesión cerrada en este equipo. No se pudo confirmar el cierre en el servidor.')
    } finally { clearStoredSession(); await router.push({ name: 'login' }) }
  }
  const requireReauthentication = async () => {
    sessionStorage.setItem('auth_logout_notice', 'Contraseña actualizada. Vuelve a iniciar sesión.')
    clearStoredSession(); await router.push({ name: 'login' })
  }
  const isCliente = computed(() => assignments(user.value).some(item => item.role === 'Cliente'))
  const hasPermission = permission => assignments(user.value).some(item => item.permission === permission)
  return { token, user, isCliente, setAuth, logout, hasPermission, updateUser, restoreSession, requireReauthentication, sessionChecked, sessionUnavailable }
})
