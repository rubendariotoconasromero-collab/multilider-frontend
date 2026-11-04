import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'Landing',
      component: () => import('../views/LandingView.vue'),
      meta: { layout: 'public' }
    },
    {
      path: '/propiedades-venta',
      name: 'PropiedadesLanding',
      component: () => import('../views/landing/PropiedadesLandingView.vue'),
      meta: { layout: 'public' }
    },
    {
      path: '/propiedades-venta/:id',
      name: 'PropiedadDetalle',
      component: () => import('../views/landing/PropiedadDetailView.vue'),
      meta: { layout: 'public' }
    },
    {
      path: '/pagar',
      name: 'PagoPublico',
      component: () => import('../views/landing/PagoPublicoView.vue'),
      meta: { layout: 'public' }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresGuest: true, layout: 'auth' }
    },
    {
      path: '/admin',
      name: 'Dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true, layout: 'admin' }
    },
    {
      path: '/empresa',
      name: 'Empresa',
      component: () => import('../views/EmpresaView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_empresa', layout: 'admin' }
    },

    {
      path: '/usuarios',
      name: 'Usuarios',
      component: () => import('../views/UsuariosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_usuarios', layout: 'admin' }
    },
    {
      path: '/ciudades',
      name: 'Ciudades',
      component: () => import('../views/CiudadesView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_ciudades', layout: 'admin' }
    },
    {
      path: '/distritos',
      name: 'Distritos',
      component: () => import('../views/DistritosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_zonas', layout: 'admin' }
    },
    {
      path: '/sectores-urbanos',
      name: 'SectoresUrbanos',
      component: () => import('../views/SectoresUrbanosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_zonas', layout: 'admin' }
    },
    {
      path: '/caracteristicas',
      name: 'Caracteristicas',
      component: () => import('../views/CaracteristicasView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_caracteristicas', layout: 'admin' }
    },
    {
      path: '/roles',
      name: 'Roles',
      component: () => import('../views/RolesView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_roles', layout: 'admin' }
    },
    {
      path: '/permisos',
      name: 'Permisos',
      component: () => import('../views/PermisosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_permisos', layout: 'admin' }
    },
    {
      path: '/propietarios',
      name: 'Propietarios',
      component: () => import('../views/PropietariosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_propietarios', layout: 'admin' }
    },
    {
      path: '/propiedades',
      name: 'Propiedades',
      component: () => import('../views/PropiedadesView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_propiedades', layout: 'admin' }
    },
    {
      path: '/asesores',
      name: 'Asesores',
      component: () => import('../views/AsesoresView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_asesores', layout: 'admin' }
    },
    {
      path: '/clientes',
      name: 'Clientes',
      component: () => import('../views/ClientesView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_clientes', layout: 'admin' }
    },
    {
      path: '/ventas/nueva',
      name: 'NuevaVenta',
      component: () => import('../views/NuevaVentaView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_ventas', layout: 'admin' }
    },
    {
      path: '/ventas/historial',
      name: 'HistorialVentas',
      component: () => import('../views/HistorialVentasView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_historial_ventas', layout: 'admin' }
    },
    {
      path: '/pagos',
      name: 'Pagos',
      component: () => import('../views/PagosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_pagos', layout: 'admin' }
    },
    {
      path: '/pagos-credito',
      name: 'PagosCredito',
      component: () => import('../views/PagosCreditoView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_pagos', layout: 'admin' }
    },
    {
      path: '/contratos',
      name: 'Contratos',
      component: () => import('../views/ContratosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_contratos', layout: 'admin' }
    },
    {
      path: '/entregas',
      name: 'Entregas',
      component: () => import('../views/EntregasView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_entregas', layout: 'admin' }
    },
    {
      path: '/ingresos',
      name: 'Ingresos',
      component: () => import('../views/IngresosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_ingresos', layout: 'admin' }
    },
    {
      path: '/egresos',
      name: 'Egresos',
      component: () => import('../views/EgresosView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_egresos', layout: 'admin' }
    },
    {
      path: '/comisiones-asesores',
      name: 'ComisionesAsesores',
      component: () => import('../views/ComisionesAsesoresView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_egresos', layout: 'admin' }
    },
    {
      path: '/reportes',
      name: 'Reportes',
      component: () => import('../views/ReportesView.vue'),
      meta: { requiresAuth: true, layout: 'admin' }
    },
    {
      path: '/perfil',
      name: 'Perfil',
      component: () => import('../views/PerfilView.vue'),
      meta: { requiresAuth: true, layout: 'admin' }
    },
    {
      path: '/correo-masivo',
      name: 'CorreoMasivo',
      component: () => import('../views/CorreoMasivoView.vue'),
      meta: { requiresAuth: true, permission: 'acceso_correo_masivo', layout: 'admin' }
    },
    {
      path: '/mi-cartera',
      name: 'MiCartera',
      component: () => import('../views/ClientePortalView.vue'),
      meta: { requiresAuth: true, requiresCliente: true, layout: 'cliente' }
    },
  ]
})

// GUARDIA DE NAVEGACIÓN
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.restoreSession()
  const isAuthenticated = !!authStore.token
  const esCliente = authStore.isCliente

  // 1. Si requiere autenticación y NO está logueado
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  }

  // 2. Si es una ruta para "invitados" (login) y YA está logueado
  if (to.meta.requiresGuest && isAuthenticated) {
    return esCliente ? { name: 'MiCartera' } : { name: 'Dashboard' }
  }

  // 3. Clientes solo pueden ver su portal
  if (isAuthenticated && esCliente && to.meta.layout === 'admin') {
    return { name: 'MiCartera' }
  }

  // 4. No clientes no pueden acceder al portal de cliente
  if (isAuthenticated && !esCliente && to.meta.requiresCliente) {
    return { name: 'Dashboard' }
  }

  // 5. SEGURIDAD DE PERMISOS
  if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    alert("Acceso denegado: No tienes los permisos necesarios para ver este módulo.")
    return { name: 'Dashboard' }
  }

  return true
})

export default router
