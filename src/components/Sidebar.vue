<script setup>
import { apiOrigin } from '@/api/config'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCompanyStore } from '../stores/company'

defineProps({
  isCompact: Boolean,
  isOpenMobile: Boolean
})

const emit = defineEmits(['toggle-compact', 'close-mobile'])
const authStore = useAuthStore()
const companyStore = useCompanyStore()

const baseUrl = apiOrigin

// Estado para controlar qué menú desplegable está abierto
const openSubmenu = ref(null)

const toggleSubmenu = (menuName) => {
  // Si se hace clic en el mismo, se cierra. Si es otro, se abre.
  openSubmenu.value = openSubmenu.value === menuName ? null : menuName
}
</script>

<template>
  <aside :class="['sidebar sidebar-theme-dark shadow-sm border-end', { 'is-compact': isCompact, 'is-open-mobile': isOpenMobile }]">
    <div class="sidebar-brand d-flex align-items-center justify-content-center border-bottom" style="height: var(--topbar-height);">
        <template v-if="!isCompact">
          <img v-if="companyStore.company?.logo_sidebar || companyStore.company?.logo" 
               :src="baseUrl + (companyStore.company.logo_sidebar || companyStore.company.logo)" 
               alt="Logo" class="w-100 p-2" style="max-height: 63px; object-fit: contain;">
          <span v-else class="fw-bold fs-4">{{ companyStore.company?.nombre || 'Multilider' }}</span>
        </template>
        <template v-else>
          <img v-if="companyStore.company?.logo_sidebar_compact || companyStore.company?.logo" 
               :src="baseUrl + (companyStore.company.logo_sidebar_compact || companyStore.company.logo)" 
               alt="Logo Compact" style="max-height: 40px; object-fit: contain;">
          <i v-else class="bi bi-hexagon-fill fs-3" style="color: var(--primary-color);"></i>
        </template>
    </div>

    <ul class="nav flex-column px-2 mt-3 gap-1 flex-grow-1 overflow-auto">
      
      <li class="nav-item">
        <RouterLink to="/admin" class="nav-link custom-link d-flex align-items-center" active-class="active" :title="isCompact ? 'Dashboard' : ''">
          <i class="bi bi-house-door fs-5"></i>
          <span v-if="!isCompact" class="ms-3 fw-medium">Dashboard</span>
        </RouterLink>
      </li>

      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_usuarios') || authStore.hasPermission('acceso_roles') || authStore.hasPermission('acceso_permisos')">
        
        <a href="#" class="nav-link custom-link d-flex align-items-center justify-content-between"
           @click.prevent="toggleSubmenu('seguridad')"
           :aria-expanded="openSubmenu === 'seguridad'"
           :title="isCompact ? 'Seguridad' : ''">
          <div class="d-flex align-items-center">
            <i class="bi bi-shield-lock fs-5"></i>
            <span v-if="!isCompact" class="ms-3 fw-medium">Adm. Usuarios</span>
          </div>
          <i v-if="!isCompact" class="bi transition-icon" :class="openSubmenu === 'seguridad' ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
        </a>
        
        <ul v-show="!isCompact && openSubmenu === 'seguridad'" class="nav flex-column ms-3 mt-1 gap-1 border-start ms-4 ps-2">
          
          <li class="nav-item" v-if="authStore.hasPermission('acceso_usuarios')">
            <RouterLink to="/usuarios" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-people me-2 fs-6"></i> Usuarios
            </RouterLink>
          </li>
          
          <li class="nav-item" v-if="authStore.hasPermission('acceso_roles')">
            <RouterLink to="/roles" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-person-badge me-2 fs-6"></i> Roles
            </RouterLink>
          </li>
          
          <li class="nav-item" v-if="authStore.hasPermission('acceso_permisos')">
            <RouterLink to="/permisos" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-key me-2 fs-6"></i> Permisos
            </RouterLink>
          </li>

          </ul>
          </li>


      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_propietarios') || authStore.hasPermission('acceso_propiedades') || authStore.hasPermission('acceso_ciudades') || authStore.hasPermission('acceso_zonas') || authStore.hasPermission('acceso_caracteristicas')">
        
        <a href="#" class="nav-link custom-link d-flex align-items-center justify-content-between"
           @click.prevent="toggleSubmenu('operativa')"
           :aria-expanded="openSubmenu === 'operativa'"
           :title="isCompact ? 'Gestión Operativa' : ''">
          <div class="d-flex align-items-center">
            <i class="bi bi-building fs-5"></i>
            <span v-if="!isCompact" class="ms-3 fw-medium">Gestión Propiedades</span>
          </div>
          <i v-if="!isCompact" class="bi transition-icon" :class="openSubmenu === 'operativa' ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
        </a>
        
        <ul v-show="!isCompact && openSubmenu === 'operativa'" class="nav flex-column ms-3 mt-1 gap-1 border-start ms-4 ps-2">
          
          <li class="nav-item" v-if="authStore.hasPermission('acceso_propietarios')">
            <RouterLink to="/propietarios" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-person-lines-fill me-2 fs-6"></i> Propietarios
            </RouterLink>
          </li>
          
          <li class="nav-item" v-if="authStore.hasPermission('acceso_propiedades')">
            <RouterLink to="/propiedades" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-houses-fill me-2 fs-6"></i> Propiedades
            </RouterLink>
          </li>

          <li class="nav-item" v-if="authStore.hasPermission('acceso_ciudades')">
            <RouterLink to="/ciudades" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-geo-alt-fill me-2 fs-6"></i> Ciudades
            </RouterLink>
          </li>

          <li class="nav-item" v-if="authStore.hasPermission('acceso_zonas')">
            <RouterLink to="/distritos" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-pin-map-fill me-2 fs-6"></i> Distritos
            </RouterLink>
          </li>

          <li class="nav-item" v-if="authStore.hasPermission('acceso_zonas')">
            <RouterLink to="/sectores-urbanos" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-buildings-fill me-2 fs-6"></i> Sectores Urbanos
            </RouterLink>
          </li>

          <li class="nav-item" v-if="authStore.hasPermission('acceso_caracteristicas')">
            <RouterLink to="/caracteristicas" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-tags-fill me-2 fs-6"></i> Características
            </RouterLink>
          </li>

        </ul>
      </li>

      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_asesores') || authStore.hasPermission('acceso_ventas') || authStore.hasPermission('acceso_historial_ventas') || authStore.hasPermission('acceso_clientes')">
        <a href="#" class="nav-link custom-link d-flex align-items-center justify-content-between"
           @click.prevent="toggleSubmenu('comercial')"
           :aria-expanded="openSubmenu === 'comercial'"
           :title="isCompact ? 'Gestión Comercial' : ''">
          <div class="d-flex align-items-center">
            <i class="bi bi-briefcase fs-5"></i>
            <span v-if="!isCompact" class="ms-3 fw-medium">Gestión Comercial</span>
          </div>
          <i v-if="!isCompact" class="bi transition-icon" :class="openSubmenu === 'comercial' ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
        </a>
        
        <ul v-show="!isCompact && openSubmenu === 'comercial'" class="nav flex-column ms-3 mt-1 gap-1 border-start ms-4 ps-2">
          <li class="nav-item" v-if="authStore.hasPermission('acceso_ventas')">
            <RouterLink to="/ventas/nueva" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-cart-check-fill me-2 fs-6"></i> Nueva Venta
            </RouterLink>
          </li>

          <li class="nav-item" v-if="authStore.hasPermission('acceso_historial_ventas')">
            <RouterLink to="/ventas/historial" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-clock-history me-2 fs-6"></i> Historial de Ventas
            </RouterLink>
          </li>
          
          <li class="nav-item" v-if="authStore.hasPermission('acceso_asesores')">
            <RouterLink to="/asesores" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-person-badge me-2 fs-6"></i> Asesores
            </RouterLink>
          </li>

          <li class="nav-item" v-if="authStore.hasPermission('acceso_clientes')">
            <RouterLink to="/clientes" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-people-fill me-2 fs-6"></i> Clientes
            </RouterLink>
          </li>

        </ul>
      </li>

      <!-- Grupo Contratos y Entregas -->
      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_contratos') || authStore.hasPermission('acceso_entregas')">
        <a href="#" class="nav-link custom-link d-flex align-items-center justify-content-between"
           @click.prevent="toggleSubmenu('contratos')"
           :aria-expanded="openSubmenu === 'contratos'"
           :title="isCompact ? 'Contratos y Entregas' : ''">
          <div class="d-flex align-items-center">
            <i class="bi bi-file-earmark-text fs-5"></i>
            <span v-if="!isCompact" class="ms-3 fw-medium">Contratos y Entregas</span>
          </div>
          <i v-if="!isCompact" class="bi transition-icon" :class="openSubmenu === 'contratos' ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
        </a>

        <ul v-show="!isCompact && openSubmenu === 'contratos'" class="nav flex-column ms-3 mt-1 gap-1 border-start ms-4 ps-2">
          <li class="nav-item" v-if="authStore.hasPermission('acceso_contratos')">
            <RouterLink to="/contratos" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-file-earmark-check me-2 fs-6"></i> Contratos
            </RouterLink>
          </li>
          <li class="nav-item" v-if="authStore.hasPermission('acceso_entregas')">
            <RouterLink to="/entregas" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-house-check me-2 fs-6"></i> Entregas
            </RouterLink>
          </li>
        </ul>
      </li>

      <!-- Grupo Cobranzas -->
      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_pagos')">
        <a href="#" class="nav-link custom-link d-flex align-items-center justify-content-between"
           @click.prevent="toggleSubmenu('cobranzas')"
           :aria-expanded="openSubmenu === 'cobranzas'"
           :title="isCompact ? 'Cobranzas' : ''">
          <div class="d-flex align-items-center">
            <i class="bi bi-cash-coin fs-5"></i>
            <span v-if="!isCompact" class="ms-3 fw-medium">Cobranzas</span>
          </div>
          <i v-if="!isCompact" class="bi transition-icon" :class="openSubmenu === 'cobranzas' ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
        </a>
        
        <ul v-show="!isCompact && openSubmenu === 'cobranzas'" class="nav flex-column ms-3 mt-1 gap-1 border-start ms-4 ps-2">
          <li class="nav-item" v-if="authStore.hasPermission('acceso_pagos')">
            <RouterLink to="/pagos" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-cash-stack me-2 fs-6"></i> Pagos al Contado
            </RouterLink>
          </li>
          <li class="nav-item" v-if="authStore.hasPermission('acceso_pagos')">
            <RouterLink to="/pagos-credito" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-calendar-check me-2 fs-6"></i> Pagos al Crédito
            </RouterLink>
          </li>
        </ul>
      </li>

      <!-- Grupo Finanzas -->
      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_ingresos') || authStore.hasPermission('acceso_egresos')">
        <a href="#" class="nav-link custom-link d-flex align-items-center justify-content-between"
           @click.prevent="toggleSubmenu('finanzas')"
           :aria-expanded="openSubmenu === 'finanzas'"
           :title="isCompact ? 'Finanzas' : ''">
          <div class="d-flex align-items-center">
            <i class="bi bi-graph-up-arrow fs-5"></i>
            <span v-if="!isCompact" class="ms-3 fw-medium">Finanzas</span>
          </div>
          <i v-if="!isCompact" class="bi transition-icon" :class="openSubmenu === 'finanzas' ? 'bi-chevron-down' : 'bi-chevron-right'"></i>
        </a>

        <ul v-show="!isCompact && openSubmenu === 'finanzas'" class="nav flex-column ms-3 mt-1 gap-1 border-start ms-4 ps-2">
          <li class="nav-item" v-if="authStore.hasPermission('acceso_ingresos')">
            <RouterLink to="/ingresos" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-arrow-down-circle-fill me-2 fs-6 text-success"></i> Ingresos
            </RouterLink>
          </li>
          <li class="nav-item" v-if="authStore.hasPermission('acceso_egresos')">
            <RouterLink to="/egresos" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-arrow-up-circle-fill me-2 fs-6 text-danger"></i> Egresos
            </RouterLink>
          </li>
          <li class="nav-item" v-if="authStore.hasPermission('acceso_egresos')">
            <RouterLink to="/comisiones-asesores" class="nav-link custom-link sub-link d-flex align-items-center" active-class="active">
              <i class="bi bi-cash-coin me-2 fs-6 text-warning"></i> Comisiones
            </RouterLink>
          </li>
        </ul>
      </li>

      <!-- Correo Masivo -->
      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_correo_masivo')">
        <RouterLink to="/correo-masivo" class="nav-link custom-link d-flex align-items-center" active-class="active" :title="isCompact ? 'Correo Masivo' : ''">
          <i class="bi bi-envelope-paper fs-5"></i>
          <span v-if="!isCompact" class="ms-3 fw-medium">Correo Masivo</span>
        </RouterLink>
      </li>

      <li class="nav-item mt-2" v-if="authStore.hasPermission('acceso_empresa')">
        <RouterLink to="/empresa" class="nav-link custom-link d-flex align-items-center" active-class="active" :title="isCompact ? 'Configuración' : ''">
          <i class="bi bi-gear fs-5"></i>
          <span v-if="!isCompact" class="ms-3 fw-medium">Configuración</span>
        </RouterLink>
      </li>

    </ul>
  </aside>

  <div v-if="isOpenMobile" class="sidebar-backdrop d-md-none" @click="emit('close-mobile')"></div>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background-color: var(--bg-sidebar);
  border-color: var(--border-sidebar) !important;
  color: var(--text-sidebar-main);
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  z-index: 1040;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}

.sidebar .fw-bold {
  color: var(--text-sidebar-main) !important;
}

.sidebar.is-compact { width: var(--sidebar-compact-width); }

@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.is-open-mobile { transform: translateX(0); }
  .sidebar.is-compact { width: var(--sidebar-width); }
}

.custom-link {
  border-radius: 8px;
  padding: 0.6rem 1rem;
  transition: all 0.2s ease;
  white-space: nowrap;
  color: var(--text-sidebar-muted);
}

.custom-link:hover {
  background-color: rgba(128, 128, 128, 0.1); /* Fondo translúcido para que funcione en oscuro y claro */
  color: var(--text-sidebar-main);
}

.custom-link.active {
  background-color: var(--primary-color);
  color: #ffffff !important;
}

.sub-link {
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
}

.sidebar-backdrop {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.5); z-index: 1030;
}


/* Bloquea el azul de Bootstrap en todos los estados interactivos */
.custom-link:hover,
.custom-link:focus,
.custom-link:active {
  color: var(--text-sidebar-main) !important;
}

/* Muestra outline solo al navegar con teclado, no con mouse */
.custom-link:focus:not(:focus-visible) {
  outline: none;
}

.custom-link:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.35);
  outline-offset: 1px;
}

/* Ítem activo: blanco en todos los estados sin excepción */
.custom-link.active,
.custom-link.active:hover,
.custom-link.active:focus,
.custom-link.active:active,
.custom-link.active:focus-visible {
  background-color: var(--primary-color) !important;
  color: #ffffff !important;
  outline: none;
}

/* Toggle de submenú expandido: highlight sutil sin texto azul */
.custom-link[aria-expanded="true"] {
  color: var(--text-sidebar-main) !important;
  background-color: rgba(255, 255, 255, 0.07);
}


</style>
