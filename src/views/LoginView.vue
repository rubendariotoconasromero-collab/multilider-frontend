<script setup>
import { apiOrigin } from '@/api/config'
import { ref, onUnmounted, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCompanyStore } from '../stores/company'
import api from '../api/axios'

const router = useRouter()
const authStore = useAuthStore()
const companyStore = useCompanyStore()

const formulario = ref({ correo: '', password: '' })
const cargando = ref(false)
const errorMensaje = ref('')
const mostrarPassword = ref(false)

const baseUrl = apiOrigin

// === NUEVAS VARIABLES PARA EL TEMPORIZADOR ===
const segundosBloqueo = ref(0)
let intervaloBloqueo = null

// Función para iniciar la cuenta regresiva
const iniciarTemporizador = (segundos) => {
  segundosBloqueo.value = segundos

  // Limpiamos cualquier temporizador anterior por si acaso
  if (intervaloBloqueo) clearInterval(intervaloBloqueo)

  intervaloBloqueo = setInterval(() => {
    segundosBloqueo.value--

    // Cuando llegue a cero, detenemos el reloj y limpiamos el error
    if (segundosBloqueo.value <= 0) {
      clearInterval(intervaloBloqueo)
      errorMensaje.value = ''
    }
  }, 1000)
}

onMounted(() => {
  const notice = sessionStorage.getItem('auth_logout_notice')
  if (notice) { errorMensaje.value = notice; sessionStorage.removeItem('auth_logout_notice') }
  companyStore.fetchCompany()
})

// Limpiar el temporizador si el usuario cambia de página de repente
onUnmounted(() => {
  if (intervaloBloqueo) clearInterval(intervaloBloqueo)
})
// ===========================================

const iniciarSesion = async () => {
  // Evitar que envíen el formulario si están bloqueados
  if (segundosBloqueo.value > 0) return

  try {
    cargando.value = true
    errorMensaje.value = ''

    const respuesta = await api.post('/login', formulario.value)

    authStore.setAuth(respuesta.data.access_token, respuesta.data.user)

    const asignaciones = respuesta.data.user.roles_permisos || respuesta.data.user.rolesPermisos || []
    const esCliente = asignaciones.some(item => {
      const rol = item.rol_permiso?.rol || item.rolPermiso?.rol
      return rol?.nombre === 'Cliente'
    })
    router.push(esCliente ? '/mi-cartera' : '/admin')

  } catch (error) {
    if (error.response) {
      // CAPTURAMOS EL BLOQUEO (429) Y ACTIVAMOS EL TEMPORIZADOR
      if (error.response.status === 429) {
        errorMensaje.value = error.response.data.message

        // Obtenemos los segundos que mandó Laravel (o ponemos 60 por defecto)
        const segundos = error.response.data.seconds_remaining || 60
        iniciarTemporizador(segundos)
      }
      else if (error.response.data && error.response.data.message) {
        errorMensaje.value = error.response.data.message
      } else {
        errorMensaje.value = `Error del servidor (Código ${error.response.status})`
      }
    } else {
      errorMensaje.value = "Error de conexión con el servidor."
    }
    console.error("No se pudo iniciar sesión.")
  } finally {
    cargando.value = false
  }
}
</script>

<template>
  <div class="login-wrapper d-flex align-items-center justify-content-center min-vh-100 p-3">

    <div class="card card-custom border-0 shadow-lg login-card overflow-hidden">
      <div class="row g-0">

        <div class="col-md-5 d-none d-md-flex flex-column justify-content-center align-items-center p-5 brand-section">
          <div class="text-center text-white z-2 w-100">
            <template v-if="companyStore.company?.logo_login || companyStore.company?.logo">
              <img :src="baseUrl + (companyStore.company.logo_login || companyStore.company.logo)" 
                   class="img-fluid mb-4 animate__animated animate__zoomIn" 
                   style="max-height: 120px; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));">
            </template>
            <template v-else>
              <i class="bi bi-house-door display-1 mb-3"></i>
            </template>
            <h2 class="fw-bold mb-2">{{ companyStore.company?.nombre || 'MultiLider' }}</h2>
            <p class="opacity-75 fs-6">{{ companyStore.company?.eslogan || 'Gestión Empresarial' }}</p>
          </div>
          <div class="brand-overlay"></div>
        </div>

        <div class="col-md-7 p-4 p-md-5 d-flex flex-column justify-content-center">

          <div class="mb-4 text-center text-md-start">
            <h3 class="fw-bold" style="color: var(--text-main);">Bienvenido de nuevo</h3>
            <p class="text-muted">Ingresa tus credenciales para continuar.</p>
          </div>

          <div v-if="errorMensaje"
            class="alert alert-danger d-flex align-items-center py-2 px-3 mb-4 rounded-3 border-0 bg-danger bg-opacity-10 text-danger"
            role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <small>{{ errorMensaje }}</small>
          </div>

          <form @submit.prevent="iniciarSesion">

            <div class="form-floating mb-3">
              <input type="email" class="form-control custom-input" id="correo" placeholder="nombre@ejemplo.com"
                v-model="formulario.correo" required autofocus>
              <label for="correo" class="text-muted">Correo electrónico</label>
            </div>

            <div class="form-floating mb-4 position-relative">
              <input 
                :type="mostrarPassword ? 'text' : 'password'" 
                class="form-control custom-input" 
                id="password" 
                placeholder="Contraseña"
                v-model="formulario.password" 
                required>
              <label for="password" class="text-muted">Contraseña</label>
              
              <!-- Botón para mostrar/ocultar -->
              <button 
                type="button" 
                class="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted border-0 p-2"
                @click="mostrarPassword = !mostrarPassword"
                tabindex="-1">
                <i :class="mostrarPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>

            <!-- <div class="d-flex justify-content-between align-items-center mb-4">
              <div class="form-check">
                <input class="form-check-input custom-checkbox shadow-none" type="checkbox" id="recordarme">
                <label class="form-check-label text-muted small" for="recordarme">Recordarme</label>
              </div>
              <a href="#" class="small text-decoration-none fw-medium" style="color: var(--primary-color);">¿Olvidaste
                tu contraseña?</a>
            </div> -->

            <button type="submit" class="btn btn-primary w-100 py-3 fw-bold border-0 shadow-sm transition-all"
              :style="segundosBloqueo > 0 ? 'background-color: var(--secondary-color);' : 'background-color: var(--primary-color);'"
              :disabled="cargando || segundosBloqueo > 0">

              <span v-if="cargando" class="spinner-border spinner-border-sm me-2" role="status"
                aria-hidden="true"></span>
              <i v-if="segundosBloqueo > 0" class="bi bi-lock-fill me-2"></i>

              {{
                segundosBloqueo > 0
                  ? `Intenta de nuevo en ${segundosBloqueo}s`
                  : (cargando ? 'Iniciando sesión...' : 'Ingresar al sistema')
              }}
            </button>

          </form>

        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* Botón de mostrar/ocultar contraseña */
.btn-link:hover {
  color: var(--primary-color) !important;
}

.form-floating {
  position: relative;
}

.form-floating .btn-link {
  z-index: 10;
}
/* Fondo de pantalla completa */
.login-wrapper {
  background-color: var(--bg-body);
  background-image: radial-gradient(circle at top right, rgba(162, 139, 250, 0.1), transparent 40%),
    radial-gradient(circle at bottom left, rgba(162, 139, 250, 0.05), transparent 40%);
}

/* Tarjeta principal */
.login-card {
  max-width: 900px;
  width: 100%;
  border-radius: 20px;
}

/* Sección de Branding (Lila oscuro/degradado) */
.brand-section {
  position: relative;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  min-height: 500px;
}

.brand-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.1)" stroke-width="2" fill="none"/></svg>') repeat;
  opacity: 0.5;
  z-index: 1;
}

/* Estilos de inputs consistentes con el resto de la app */
.custom-input {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  border-radius: 10px;
}

.custom-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 0.25rem rgba(162, 139, 250, 0.25);
  background-color: var(--bg-card);
}

/* Checkbox lila */
.custom-checkbox:checked {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(162, 139, 250, 0.3) !important;
}
</style>
