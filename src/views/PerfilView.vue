<script setup>
import { ref, computed } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'
import { useAuthStore } from '../stores/auth'
import ProfileMailManager from '../components/ProfileMailManager.vue'

const authStore = useAuthStore()

// ==========================================
// INFO PERSONAL
// ==========================================
const guardandoInfo = ref(false)
const erroresInfo = ref({})

const infoForm = ref({
  nombre: authStore.user?.nombre || '',
  correo: authStore.user?.correo || '',
})

const guardarInfo = async () => {
  erroresInfo.value = {}
  guardandoInfo.value = true
  try {
    const res = await api.put('/perfil', infoForm.value)
    authStore.updateUser(res.data.data)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Perfil actualizado',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    if (error.response?.status === 422) {
      erroresInfo.value = error.response.data.errors
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo actualizar el perfil.',
        confirmButtonColor: '#0B2545'
      })
    }
  } finally {
    guardandoInfo.value = false
  }
}

// ==========================================
// CAMBIO DE CONTRASEÑA
// ==========================================
const guardandoPass = ref(false)
const erroresPass = ref({})
const mostrarActual = ref(false)
const mostrarNueva = ref(false)
const mostrarConfirmar = ref(false)

const passForm = ref({
  password_actual: '',
  password_nuevo: '',
  password_nuevo_confirmation: '',
})

const validacionPassword = computed(() => {
  const pass = passForm.value.password_nuevo || ''
  return {
    longitud:   pass.length >= 8,
    mayusculas: /[A-Z]/.test(pass),
    minusculas: /[a-z]/.test(pass),
    numeros:    /[0-9]/.test(pass),
    simbolos:   /[^A-Za-z0-9]/.test(pass),
  }
})

const cambiarPassword = async () => {
  erroresPass.value = {}
  guardandoPass.value = true
  try {
    await api.put('/perfil/cambiar-password', passForm.value)
    passForm.value = { password_actual: '', password_nuevo: '', password_nuevo_confirmation: '' }
    mostrarActual.value = false
    mostrarNueva.value = false
    mostrarConfirmar.value = false
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Contraseña actualizada',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    if (error.response?.status === 422) {
      erroresPass.value = error.response.data.errors
      const errs = error.response.data.errors
      let html = "<ul style='text-align:left;font-size:0.9rem;'>"
      for (const c in errs) html += `<li>${errs[c].join('</li><li>')}</li>`
      html += "</ul>"
      Swal.fire({ icon: 'warning', title: 'Verifica los datos', html, confirmButtonColor: '#0B2545' })
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'No se pudo cambiar la contraseña.',
        confirmButtonColor: '#0B2545'
      })
    }
  } finally {
    guardandoPass.value = false
  }
}

const avatarUrl = computed(() =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(authStore.user?.nombre || 'U')}&background=0B2545&color=fff&size=128`
)
</script>

<template>
  <div class="perfil-container pb-5">

    <!-- Encabezado -->
    <div class="mb-4">
      <h2 class="h4 mb-0 fw-bold" style="color: var(--text-main);">Mi Perfil</h2>
      <p class="text-muted mb-0 fs-6">Gestiona tu información personal y credenciales de acceso.</p>
    </div>

    <div class="row g-4">

      <!-- Columna izquierda: avatar + info personal -->
      <div class="col-12 col-lg-5">

        <!-- Tarjeta de avatar -->
        <div class="card card-custom border-0 shadow-sm mb-4 text-center p-4">
          <div class="mb-3">
            <img :src="avatarUrl" class="rounded-circle shadow" width="100" height="100" alt="Avatar">
          </div>
          <h5 class="fw-bold mb-0" style="color: var(--text-main);">{{ authStore.user?.nombre }}</h5>
          <p class="text-muted small mb-0">{{ authStore.user?.correo }}</p>
          <span class="badge mt-2 px-3 py-2 rounded-pill"
            style="background-color: rgba(11,37,69,0.1); color: var(--primary-color); font-size: 0.75rem;">
            Sesión Activa
          </span>
        </div>

        <!-- Tarjeta de información personal -->
        <div class="card card-custom border-0 shadow-sm" style="border-top: 3px solid var(--primary-color) !important;">
          <div class="card-body p-4">
            <h6 class="fw-bold mb-4" style="color: var(--text-main);">
              <i class="bi bi-person-circle me-2" style="color: var(--primary-color);"></i>
              Información Personal
            </h6>

            <form @submit.prevent="guardarInfo">
              <div class="mb-3">
                <label class="form-label text-muted fw-medium fs-6">Nombre Completo *</label>
                <input
                  type="text"
                  class="form-control shadow-none bg-light border-0"
                  :class="{ 'is-invalid border-danger': erroresInfo.nombre }"
                  v-model="infoForm.nombre"
                  required
                />
                <div v-if="erroresInfo.nombre" class="invalid-feedback d-block fw-medium">
                  {{ erroresInfo.nombre[0] }}
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label text-muted fw-medium fs-6">Correo Electrónico *</label>
                <input
                  type="email"
                  class="form-control shadow-none bg-light border-0"
                  :class="{ 'is-invalid border-danger': erroresInfo.correo }"
                  v-model="infoForm.correo"
                  required
                />
                <div v-if="erroresInfo.correo" class="invalid-feedback d-block fw-medium">
                  {{ erroresInfo.correo[0] }}
                </div>
              </div>

              <div class="d-flex justify-content-end">
                <button
                  type="submit"
                  class="btn btn-primary border-0 shadow-sm px-4"
                  style="background-color: var(--primary-color);"
                  :disabled="guardandoInfo"
                >
                  <span v-if="guardandoInfo" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  {{ guardandoInfo ? 'Guardando...' : 'Guardar Cambios' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Columna derecha: cambiar contraseña -->
      <div class="col-12 col-lg-7">
        <div class="card card-custom border-0 shadow-sm h-100" style="border-top: 3px solid var(--primary-color) !important;">
          <div class="card-body p-4">
            <h6 class="fw-bold mb-4" style="color: var(--text-main);">
              <i class="bi bi-shield-lock me-2" style="color: var(--primary-color);"></i>
              Cambiar Contraseña
            </h6>

            <form @submit.prevent="cambiarPassword">

              <!-- Contraseña actual -->
              <div class="mb-3">
                <label class="form-label text-muted fw-medium fs-6">Contraseña Actual *</label>
                <div class="input-group has-validation">
                  <input
                    :type="mostrarActual ? 'text' : 'password'"
                    class="form-control shadow-none bg-light border-0 no-validation-icon"
                    :class="{ 'is-invalid border-danger': erroresPass.password_actual }"
                    v-model="passForm.password_actual"
                    required
                  />
                  <button
                    type="button"
                    class="btn btn-light bg-light border-0"
                    :class="{ 'border-danger border-top border-bottom border-end': erroresPass.password_actual }"
                    @click="mostrarActual = !mostrarActual"
                  >
                    <i class="bi fs-5" :class="mostrarActual ? 'bi-eye-slash-fill text-primary' : 'bi-eye-fill text-muted'"></i>
                  </button>
                  <div v-if="erroresPass.password_actual" class="invalid-feedback fw-medium mt-1">
                    {{ erroresPass.password_actual[0] }}
                  </div>
                </div>
              </div>

              <!-- Nueva contraseña -->
              <div class="mb-3">
                <label class="form-label text-muted fw-medium fs-6">Nueva Contraseña *</label>
                <div class="input-group has-validation">
                  <input
                    :type="mostrarNueva ? 'text' : 'password'"
                    class="form-control shadow-none bg-light border-0 no-validation-icon"
                    :class="{ 'is-invalid border-danger': erroresPass.password_nuevo }"
                    v-model="passForm.password_nuevo"
                    required
                  />
                  <button
                    type="button"
                    class="btn btn-light bg-light border-0"
                    :class="{ 'border-danger border-top border-bottom border-end': erroresPass.password_nuevo }"
                    @click="mostrarNueva = !mostrarNueva"
                  >
                    <i class="bi fs-5" :class="mostrarNueva ? 'bi-eye-slash-fill text-primary' : 'bi-eye-fill text-muted'"></i>
                  </button>
                  <div v-if="erroresPass.password_nuevo" class="invalid-feedback fw-medium mt-1">
                    <div v-for="(err, i) in erroresPass.password_nuevo" :key="i">{{ err }}</div>
                  </div>
                </div>

                <!-- Indicador de fortaleza -->
                <div v-if="passForm.password_nuevo.length > 0" class="mt-2 p-2 rounded bg-light bg-opacity-50">
                  <ul class="list-unstyled mb-0" style="font-size: 0.8rem;">
                    <li :class="validacionPassword.longitud ? 'text-success fw-bold' : 'text-muted'" class="mb-1 transition-colors">
                      <i class="bi me-1" :class="validacionPassword.longitud ? 'bi-check-circle-fill' : 'bi-circle'"></i>
                      Mínimo 8 caracteres
                    </li>
                    <li :class="validacionPassword.mayusculas && validacionPassword.minusculas ? 'text-success fw-bold' : 'text-muted'" class="mb-1 transition-colors">
                      <i class="bi me-1" :class="validacionPassword.mayusculas && validacionPassword.minusculas ? 'bi-check-circle-fill' : 'bi-circle'"></i>
                      Al menos una mayúscula y una minúscula
                    </li>
                    <li :class="validacionPassword.numeros ? 'text-success fw-bold' : 'text-muted'" class="mb-1 transition-colors">
                      <i class="bi me-1" :class="validacionPassword.numeros ? 'bi-check-circle-fill' : 'bi-circle'"></i>
                      Al menos un número
                    </li>
                    <li :class="validacionPassword.simbolos ? 'text-success fw-bold' : 'text-muted'" class="transition-colors">
                      <i class="bi me-1" :class="validacionPassword.simbolos ? 'bi-check-circle-fill' : 'bi-circle'"></i>
                      Al menos un símbolo (ej. !@#$%)
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Confirmar nueva contraseña -->
              <div class="mb-4">
                <label class="form-label text-muted fw-medium fs-6">Confirmar Nueva Contraseña *</label>
                <div class="input-group has-validation">
                  <input
                    :type="mostrarConfirmar ? 'text' : 'password'"
                    class="form-control shadow-none bg-light border-0 no-validation-icon"
                    :class="{ 'is-invalid border-danger': erroresPass.password_nuevo_confirmation }"
                    v-model="passForm.password_nuevo_confirmation"
                    required
                  />
                  <button
                    type="button"
                    class="btn btn-light bg-light border-0"
                    :class="{ 'border-danger border-top border-bottom border-end': erroresPass.password_nuevo_confirmation }"
                    @click="mostrarConfirmar = !mostrarConfirmar"
                  >
                    <i class="bi fs-5" :class="mostrarConfirmar ? 'bi-eye-slash-fill text-primary' : 'bi-eye-fill text-muted'"></i>
                  </button>
                  <div v-if="erroresPass.password_nuevo_confirmation" class="invalid-feedback fw-medium mt-1">
                    {{ erroresPass.password_nuevo_confirmation[0] }}
                  </div>
                </div>

                <!-- Indicador de coincidencia -->
                <div v-if="passForm.password_nuevo_confirmation.length > 0" class="mt-2" style="font-size: 0.8rem;">
                  <span
                    :class="passForm.password_nuevo === passForm.password_nuevo_confirmation ? 'text-success fw-bold' : 'text-danger fw-bold'"
                  >
                    <i class="bi me-1" :class="passForm.password_nuevo === passForm.password_nuevo_confirmation ? 'bi-check-circle-fill' : 'bi-x-circle-fill'"></i>
                    {{ passForm.password_nuevo === passForm.password_nuevo_confirmation ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden' }}
                  </span>
                </div>
              </div>

              <div class="d-flex justify-content-end">
                <button
                  type="submit"
                  class="btn btn-primary border-0 shadow-sm px-4"
                  style="background-color: var(--primary-color);"
                  :disabled="guardandoPass"
                >
                  <span v-if="guardandoPass" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  {{ guardandoPass ? 'Actualizando...' : 'Actualizar Contraseña' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

    </div>
    <ProfileMailManager :email="authStore.user?.correo || ''" />
  </div>
</template>

<style scoped>
.form-control:focus {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--primary-color) !important;
  box-shadow: 0 0 0 0.25rem rgba(162, 139, 250, 0.25) !important;
}

.no-validation-icon {
  background-image: none !important;
}

.transition-colors {
  transition: color 0.3s ease;
}
</style>
