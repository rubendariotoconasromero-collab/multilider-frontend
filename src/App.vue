<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import { useAuthStore } from './stores/auth'

const isCompact = ref(false)
const isOpenMobile = ref(false)
const route = useRoute()
const authStore = useAuthStore()

const toggleCompact = () => { isCompact.value = !isCompact.value }
const toggleMobile = () => { isOpenMobile.value = !isOpenMobile.value }
const closeMobile = () => { isOpenMobile.value = false }

// Lógica del Tema — automático por horario local (19:00–06:00 = oscuro)
const isDark = ref(false)
const isAutoMode = ref(true)
let themeTimer = null

function isDarkHour() {
  const h = new Date().getHours()
  return h >= 19 || h < 6
}

function applyTheme(dark) {
  isDark.value = dark
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

const toggleTheme = () => {
  if (isAutoMode.value) {
    isAutoMode.value = false
    applyTheme(!isDark.value)
    localStorage.setItem('theme-override', isDark.value ? 'dark' : 'light')
  } else {
    isAutoMode.value = true
    localStorage.removeItem('theme-override')
    applyTheme(isDarkHour())
  }
}

const layout = computed(() => route.meta.layout || 'public')

onMounted(() => {
  const saved = localStorage.getItem('theme-override')
  if (saved) {
    isAutoMode.value = false
    applyTheme(saved === 'dark')
  } else {
    applyTheme(isDarkHour())
  }

  // Cada 60 s: si hay override manual lo respeta; si está en auto, ajusta por hora
  themeTimer = setInterval(() => {
    const override = localStorage.getItem('theme-override')
    if (override) {
      isAutoMode.value = false
      if (isDark.value !== (override === 'dark')) applyTheme(override === 'dark')
    } else if (isAutoMode.value) {
      applyTheme(isDarkHour())
    }
  }, 60_000)
})

onUnmounted(() => clearInterval(themeTimer))
</script>

<template>
  <div v-if="authStore.sessionUnavailable" class="alert alert-warning mb-0" role="status">
    No se pudo comprobar tu sesión. El servicio de acceso está temporalmente indisponible.
    <button class="btn btn-sm btn-outline-secondary ms-2" @click="authStore.restoreSession(true)">Reintentar</button>
  </div>
  <!-- Layout Público (Landing) -->
  <div v-if="layout === 'public'" class="public-layout">
    <RouterView />
  </div>

  <!-- Layout Auth (Login) -->
  <div v-else-if="layout === 'auth'" class="auth-layout">
    <RouterView />
  </div>

  <!-- Layout Cliente (Portal de cartera) -->
  <div v-else-if="layout === 'cliente'" class="cliente-layout">
    <header class="cliente-topbar d-flex align-items-center justify-content-between px-4 border-bottom shadow-sm">
      <div class="d-flex align-items-center gap-3">
        <i class="bi bi-house-door-fill fs-4" style="color:var(--primary-color)"></i>
        <span class="fw-bold" style="color:var(--text-main)">Mi Portal</span>
      </div>
      <div class="d-flex align-items-center gap-3">
        <div class="d-flex align-items-center gap-2">
          <img :src="`https://ui-avatars.com/api/?name=${authStore.user?.nombre}&background=0B2545&color=fff`"
               class="rounded-circle" width="34" height="34">
          <span class="d-none d-sm-inline small fw-semibold" style="color:var(--text-main)">
            {{ authStore.user?.nombre }}
          </span>
        </div>
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3"
                @click="authStore.logout">
          <i class="bi bi-box-arrow-right me-1"></i>Salir
        </button>
      </div>
    </header>
    <main class="p-3 p-md-4">
      <RouterView />
    </main>
  </div>

  <!-- Layout Admin (Dashboard) -->
  <div v-else class="app-wrapper">
    <Sidebar :isCompact="isCompact" :isOpenMobile="isOpenMobile" @toggle-compact="toggleCompact" @close-mobile="closeMobile" />

    <div :class="['main-content', { 'is-compact': isCompact }]">
      
      <header class="topbar d-flex align-items-center justify-content-between px-4 border-bottom shadow-sm">
        <div class="d-flex align-items-center">
          <button class="btn btn-link d-md-none p-0 me-3 text-dark" @click="toggleMobile">
            <i class="bi bi-list fs-2"></i>
          </button>
          <button class="btn btn-link d-none d-md-block p-0 me-4 text-muted" @click="toggleCompact">
            <i class="bi" :class="isCompact ? 'bi-chevron-double-right' : 'bi-chevron-double-left'"></i>
          </button>
          <h4 class="m-0 fw-bold text-capitalize" style="color: var(--text-main)">
            {{ route.name || 'Dashboard' }}
          </h4>
        </div>

        <div class="d-flex align-items-center gap-3">
          <!-- Reportes Dropdown -->
          <div class="dropdown me-1">
            <div class="reports-dropdown-label d-flex align-items-center px-3 py-1 rounded-pill cursor-pointer border" 
                 data-bs-toggle="dropdown" 
                 aria-expanded="false">
              <i class="bi bi-file-earmark-bar-graph me-2"></i>
              <span class="d-none d-sm-inline fw-medium small">Reportes</span>
              <i class="bi bi-chevron-down ms-2 small opacity-75"></i>
            </div>
            <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2 p-2" style="min-width: 240px;">
              <li class="dropdown-header text-uppercase fw-bold small opacity-50 px-3 py-2">Generar Reportes</li>
              <li>
                <RouterLink class="dropdown-item rounded-2 py-2" :to="{ name: 'Reportes', query: { r: 'ventas-cobros' } }">
                  <i class="bi bi-graph-up-arrow me-2 text-success"></i> Ventas y Cobros
                </RouterLink>
              </li>
              <li>
                <RouterLink class="dropdown-item rounded-2 py-2" :to="{ name: 'Reportes', query: { r: 'cartera-mora' } }">
                  <i class="bi bi-exclamation-triangle me-2 text-danger"></i> Cartera y Mora
                </RouterLink>
              </li>
              <li>
                <RouterLink class="dropdown-item rounded-2 py-2" :to="{ name: 'Reportes', query: { r: 'comisiones' } }">
                  <i class="bi bi-cash-coin me-2 text-warning"></i> Comisiones
                </RouterLink>
              </li>
              <li>
                <RouterLink class="dropdown-item rounded-2 py-2" :to="{ name: 'Reportes', query: { r: 'desempeno-asesores' } }">
                  <i class="bi bi-person-badge me-2 text-primary"></i> Desempeño Asesores
                </RouterLink>
              </li>
              <li>
                <RouterLink class="dropdown-item rounded-2 py-2" :to="{ name: 'Reportes', query: { r: 'inventario' } }">
                  <i class="bi bi-houses me-2 text-info"></i> Inventario Propiedades
                </RouterLink>
              </li>
            </ul>
          </div>

          <div class="position-relative theme-toggle-wrap" :title="isAutoMode ? 'Automático por horario (clic para control manual)' : 'Manual (clic para volver a automático)'">
            <button @click="toggleTheme" class="btn btn-link p-0 text-decoration-none text-muted">
              <i class="fs-4" :class="isDark ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-stars-fill'"></i>
            </button>
            <span v-if="isAutoMode" class="auto-badge">auto</span>
          </div>

          <div class="dropdown">
            <div class="d-flex align-items-center ms-2 border-start ps-3 cursor-pointer" data-bs-toggle="dropdown" style="border-color: var(--border-color) !important;">
              <img :src="`https://ui-avatars.com/api/?name=${authStore.user?.nombre}&background=0B2545&color=fff`" class="rounded-circle me-2" width="36" height="36">
              
              <div class="d-none d-lg-block text-start lh-1">
                <span class="d-block fw-semibold text-truncate" style="color: var(--text-main); font-size: 0.9rem; max-width: 120px;">
                  {{ authStore.user?.nombre }}
                </span>
                <small class="text-muted" style="font-size: 0.75rem;">Sesión Activa</small>
              </div>
              <i class="bi bi-chevron-down ms-2 fs-6 text-muted"></i>
            </div>
            
            <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
              <li>
                <RouterLink class="dropdown-item py-2" :to="{ name: 'Perfil' }">
                  <i class="bi bi-person me-2"></i> Mi Perfil
                </RouterLink>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <a class="dropdown-item py-2 text-danger" href="#" @click.prevent="authStore.logout">
                  <i class="bi bi-box-arrow-right me-2"></i> Cerrar Sesión
                </a>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <main class="content-area p-4">
        <div v-if="route.name === 'Dashboard'" class="mb-4">
            <h1 class="h3 fw-bold">¡Bienvenido de nuevo, {{ authStore.user?.nombre.split(' ')[0] }}! 👋</h1>
            <p class="text-muted">Aquí tienes un resumen de lo que sucede en el sistema hoy.</p>
        </div>
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.main-content {
  margin-left: var(--sidebar-width);
  min-height: 100vh;
  background-color: var(--bg-body);
  transition: margin-left 0.3s ease;
}

.main-content.is-compact {
  margin-left: var(--sidebar-compact-width);
}

.topbar {
  height: var(--topbar-height);
  background-color: var(--bg-sidebar);
  position: sticky;
  top: 0;
  z-index: 1020;
}

.cursor-pointer {
  cursor: pointer;
}

.theme-toggle-wrap {
  display: inline-flex;
  align-items: center;
}

.auto-badge {
  position: absolute;
  top: -4px;
  right: -10px;
  font-size: 0.45rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  background: #22c55e;
  color: #fff;
  border-radius: 20px;
  padding: 1px 4px;
  line-height: 1.4;
  pointer-events: none;
}

.reports-dropdown-label {
  background-color: var(--bg-body);
  border-color: var(--border-color) !important;
  color: var(--text-main);
  transition: all 0.2s ease;
}

.reports-dropdown-label:hover {
  background-color: var(--border-color);
}

.dropdown-item:hover {
  background-color: var(--border-color);
  color: var(--text-main);
}

@media (max-width: 768px) {
  .main-content { margin-left: 0 !important; }
}

.cliente-layout {
  min-height: 100vh;
  background-color: var(--bg-body);
}

.cliente-topbar {
  height: var(--topbar-height);
  background-color: var(--bg-sidebar);
  position: sticky;
  top: 0;
  z-index: 1020;
}
</style>
