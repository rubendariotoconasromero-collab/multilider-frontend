<script setup>
import { catalogCommand } from '../utils/catalogCommands'
import { ref, onMounted, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'
import LiveSearchSelect from '../components/LiveSearchSelect.vue'

const distritos = ref([])
const ciudades = ref([])
const cargando = ref(true)
const guardando = ref(false)
const guardandoCiudad = ref(false)

const pagination = ref({
  current_page: 1,
  last_page: 1,
  per_page: 10,
  total: 0
})

const filtros = ref({
  buscar: '',
  ciudad_id: ''
})

const isEditing = ref(false)
const distritoForm = ref({
  id: null,
  nombre: '',
  ciudad_id: null,
  estado: true
})
const btnCerrarModal = ref(null)
const erroresValidacion = ref({})

const ciudadForm = ref({ nombre: '', departamento: '' })
const btnCerrarModalCiudad = ref(null)
const erroresValidacionCiudad = ref({})

const distritoDetalle = ref(null)

const cargarDistritos = async (page = 1) => {
  try {
    cargando.value = true
    const params = {
      page,
      per_page: pagination.value.per_page,
      search: filtros.value.buscar,
      ciudad_id: filtros.value.ciudad_id
    }
    const res = await api.get('/distritos', { params })
    distritos.value = res.data.data
    pagination.value = {
      current_page: res.data.current_page,
      last_page: res.data.last_page,
      per_page: res.data.per_page,
      total: res.data.total
    }
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los distritos.', confirmButtonColor: 'var(--primary-color)' })
  } finally {
    cargando.value = false
  }
}

const cargarCiudades = async () => {
  try {
    const res = await api.get('/ciudades', { params: { per_page: 1000 } })
    ciudades.value = res.data.data
  } catch (error) {
    console.error('Error al cargar ciudades:', error)
  }
}

let timeoutBusqueda = null
watch(() => filtros.value.buscar, () => {
  if (timeoutBusqueda) clearTimeout(timeoutBusqueda)
  timeoutBusqueda = setTimeout(() => cargarDistritos(1), 500)
})
watch(() => filtros.value.ciudad_id, () => cargarDistritos(1))

const nuevoDistrito = () => {
  isEditing.value = false
  distritoForm.value = { id: null, nombre: '', ciudad_id: null, estado: true }
  erroresValidacion.value = {}
}

const editarDistrito = (item) => {
  isEditing.value = true
  distritoForm.value = {
    id: item.id,
    nombre: item.nombre,
    ciudad_id: item.ciudad_id,
    estado: item.estado == 1 || item.estado === true
  }
  erroresValidacion.value = {}
}

const verDistrito = (item) => {
  distritoDetalle.value = item
}

const guardarDistrito = async () => {
  erroresValidacion.value = {}
  guardando.value = true
  try {
    if (isEditing.value) {
      await catalogCommand(api, 'put', `/distritos/${distritoForm.value.id}`, distritoForm.value)
    } else {
      await catalogCommand(api, 'post', '/distritos', distritoForm.value)
    }
    await cargarDistritos(pagination.value.current_page)
    btnCerrarModal.value.click()
    Swal.fire({
      toast: true, position: 'top-end', icon: 'success',
      title: isEditing.value ? 'Distrito actualizado' : 'Distrito registrado',
      showConfirmButton: false, timer: 3000, timerProgressBar: true
    })
  } catch (error) {
    if (error.response?.status === 422) {
      erroresValidacion.value = error.response.data.errors
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al guardar el distrito.', confirmButtonColor: 'var(--primary-color)' })
    }
  } finally {
    guardando.value = false
  }
}

const toggleEstadoDistrito = (item) => {
  const isActivo = item.estado == 1 || item.estado === true
  const accion = isActivo ? 'Desactivar' : 'Activar'
  Swal.fire({
    title: `¿${accion} distrito?`,
    text: `¿Estás seguro de ${accion.toLowerCase()} "${item.nombre}"?`,
    icon: isActivo ? 'warning' : 'info',
    showCancelButton: true,
    confirmButtonColor: isActivo ? '#fb7185' : 'var(--primary-color)',
    cancelButtonColor: '#9ca3af',
    confirmButtonText: `Sí, ${accion.toLowerCase()}`,
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await catalogCommand(api, 'delete', `/distritos/${item.id}`)
        await cargarDistritos(pagination.value.current_page)
        Swal.fire({ title: `¡${isActivo ? 'Desactivado' : 'Activado'}!`, icon: 'success', confirmButtonColor: 'var(--primary-color)' })
      } catch {
        Swal.fire('Error', `No se pudo ${accion.toLowerCase()} el distrito.`, 'error')
      }
    }
  })
}

const nuevaCiudadRapida = () => {
  ciudadForm.value = { nombre: '', departamento: '' }
  erroresValidacionCiudad.value = {}
}

const guardarCiudadRapida = async () => {
  erroresValidacionCiudad.value = {}
  guardandoCiudad.value = true
  try {
    const res = await catalogCommand(api, 'post', '/ciudades', ciudadForm.value)
    await cargarCiudades()
    distritoForm.value.ciudad_id = res.data.data.id
    btnCerrarModalCiudad.value.click()
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Ciudad creada y seleccionada', showConfirmButton: false, timer: 3000, timerProgressBar: true })
  } catch (error) {
    if (error.response?.status === 422) {
      erroresValidacionCiudad.value = error.response.data.errors
    } else {
      Swal.fire('Error', 'No se pudo crear la ciudad.', 'error')
    }
  } finally {
    guardandoCiudad.value = false
  }
}

onMounted(() => {
  cargarDistritos()
  cargarCiudades()
})
</script>

<template>
  <div class="container-fluid py-4 pb-5">

    <!-- Cabecera -->
    <div class="row align-items-center mb-4">
      <div class="col-md-5 mb-3 mb-md-0">
        <h2 class="h4 mb-0 fw-bold" style="color: var(--text-main);">Gestión de Distritos</h2>
        <p class="text-muted small mb-0">Administra los distritos y zonas de cada ciudad.</p>
      </div>
      <div class="col-md-7 d-flex justify-content-md-end gap-2">
        <div class="input-group" style="max-width: 480px;">
          <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
          <input type="text" class="form-control border-start-0 border-end-0 ps-0 shadow-none"
                 v-model="filtros.buscar" @keyup.enter="cargarDistritos(1)" placeholder="Buscar distrito o ciudad...">
          <span class="input-group-text bg-white border-start-0 cursor-pointer" v-if="filtros.buscar" @click="filtros.buscar = ''" title="Limpiar">
            <i class="bi bi-x-circle-fill text-muted hover-danger transition-all"></i>
          </span>
          <span class="input-group-text bg-white border-start-0" v-else></span>
          <button class="btn btn-secondary shadow-none px-3" @click="cargarDistritos(1)" type="button">Buscar</button>
        </div>
        <button class="btn btn-primary d-flex align-items-center gap-2 border-0 shadow-sm px-3"
                style="background-color: var(--primary-color);"
                data-bs-toggle="modal" data-bs-target="#modalDistrito" @click="nuevoDistrito">
          <i class="bi bi-plus-lg"></i> Nuevo
        </button>
      </div>
    </div>

    <!-- Tarjeta de Listado -->
    <div class="card card-custom border-0 shadow-sm overflow-hidden mb-3">
      <div class="card-body p-0">
        <div v-if="cargando" class="text-center p-5">
          <div class="spinner-border text-primary" role="status"></div>
          <div class="mt-2 text-muted small">Cargando distritos...</div>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th class="ps-4">ID</th>
                <th>Nombre del Distrito</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th class="text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="distrito in distritos" :key="distrito.id">
                <td class="ps-4 fw-medium text-muted">#{{ distrito.id }}</td>
                <td><span class="fw-bold" style="color: var(--text-main);">{{ distrito.nombre }}</span></td>
                <td>
                  <div class="d-flex align-items-center">
                    <!-- <i class="bi bi-geo-alt text-primary me-2"></i> -->
                    <div>
                      <div class="fw-medium">{{ distrito.ciudad?.nombre }}</div>
                      <div class="smaller text-muted">{{ distrito.ciudad?.departamento }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span v-if="distrito.estado == 1 || distrito.estado === true" class="badge-status badge-status-active">Activo</span>
                  <span v-else class="badge-status badge-status-inactive">Inactivo</span>
                </td>
                <td class="text-end pe-4">
                  <button class="btn btn-sm btn-light me-2 custom-action-btn" title="Ver Detalles"
                          data-bs-toggle="modal" data-bs-target="#modalDetalle" @click="verDistrito(distrito)">
                    <i class="bi bi-eye text-primary"></i>
                  </button>
                  <button class="btn btn-sm btn-light me-2 custom-action-btn" title="Editar"
                          data-bs-toggle="modal" data-bs-target="#modalDistrito" @click="editarDistrito(distrito)">
                    <i class="bi bi-pencil-square text-info"></i>
                  </button>
                  <button class="btn btn-sm btn-light custom-action-btn"
                          @click="toggleEstadoDistrito(distrito)"
                          :title="distrito.estado == 1 || distrito.estado === true ? 'Desactivar' : 'Activar'">
                    <i class="bi" :class="distrito.estado == 1 || distrito.estado === true ? 'bi-trash text-danger' : 'bi-check-circle text-success'"></i>
                  </button>
                </td>
              </tr>
              <tr v-if="distritos.length === 0">
                <td colspan="5" class="text-center py-5 text-muted">No se encontraron distritos.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-footer bg-transparent border-top p-4">
        <div class="d-flex justify-content-between align-items-center">
          <div class="small text-muted">Mostrando {{ distritos.length }} de {{ pagination.total }} registros</div>
          <nav v-if="pagination.last_page > 1">
            <ul class="pagination pagination-sm mb-0 shadow-sm">
              <li class="page-item" :class="{ disabled: pagination.current_page === 1 }">
                <button class="page-link shadow-none" @click="cargarDistritos(pagination.current_page - 1)"><i class="bi bi-chevron-left"></i></button>
              </li>
              <li v-for="page in pagination.last_page" :key="page" class="page-item" :class="{ active: pagination.current_page === page }">
                <button class="page-link shadow-none custom-page-btn" @click="cargarDistritos(page)">{{ page }}</button>
              </li>
              <li class="page-item" :class="{ disabled: pagination.current_page === pagination.last_page }">
                <button class="page-link shadow-none" @click="cargarDistritos(pagination.current_page + 1)"><i class="bi bi-chevron-right"></i></button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>

    <!-- Modal CRUD Distrito -->
    <div class="modal fade" id="modalDistrito" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold" style="color: var(--text-main);">
              <!-- <i class="bi bi-pin-map-fill me-2 text-primary"></i> -->
              {{ isEditing ? 'Editar Distrito' : 'Registrar Nuevo Distrito' }}
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" ref="btnCerrarModal"></button>
          </div>
          <div class="modal-body p-4">
            <form @submit.prevent="guardarDistrito">
              <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label small fw-bold text-muted mb-0">Seleccionar Ciudad *</label>
                  <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none fw-bold"
                          data-bs-toggle="modal" data-bs-target="#modalNuevaCiudad" @click="nuevaCiudadRapida">
                    <i class="bi bi-plus-circle me-1"></i> Nueva Ciudad
                  </button>
                </div>
                <LiveSearchSelect
                  v-model="distritoForm.ciudad_id"
                  :options="ciudades"
                  displayKey="nombre"
                  subKey="departamento"
                  valueKey="id"
                  placeholder="Escribe para buscar ciudad..."
                  :hasError="!!erroresValidacion.ciudad_id"
                />
                <div class="text-danger smaller mt-1" v-if="erroresValidacion.ciudad_id">{{ erroresValidacion.ciudad_id[0] }}</div>
              </div>

              <div class="mb-4">
                <label class="form-label small fw-bold text-muted mb-1">Nombre del Distrito *</label>
                <input type="text" class="form-control bg-light border-0 shadow-none"
                       v-model="distritoForm.nombre" :class="{ 'is-invalid': erroresValidacion.nombre }" required
                       placeholder="Ej: Distrito 5, Zona Norte">
                <div class="invalid-feedback" v-if="erroresValidacion.nombre">{{ erroresValidacion.nombre[0] }}</div>
              </div>

              <div class="d-flex justify-content-end gap-2 mt-4">
                <button type="button" class="btn btn-light shadow-none border" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary shadow-sm border-0 px-4"
                        style="background-color: var(--primary-color);" :disabled="guardando">
                  <span v-if="guardando" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  {{ guardando ? 'Guardando...' : (isEditing ? 'Actualizar Distrito' : 'Guardar Distrito') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Nueva Ciudad (Acceso Rápido) -->
    <div class="modal fade" id="modalNuevaCiudad" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow-lg">
          <div class="modal-header bg-light border-bottom-0 pb-2">
            <h6 class="modal-title fw-bold">Nueva Ciudad</h6>
            <button type="button" class="btn-close shadow-none" data-bs-toggle="modal" data-bs-target="#modalDistrito" ref="btnCerrarModalCiudad"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="guardarCiudadRapida">
              <div class="mb-3">
                <label class="form-label smaller fw-bold text-muted mb-1">Nombre</label>
                <input type="text" class="form-control form-control-sm bg-light border-0" v-model="ciudadForm.nombre" required>
                <div class="text-danger smaller" v-if="erroresValidacionCiudad.nombre">{{ erroresValidacionCiudad.nombre[0] }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label smaller fw-bold text-muted mb-1">Departamento</label>
                <select class="form-select form-select-sm bg-light border-0" v-model="ciudadForm.departamento" required>
                  <option value="" disabled>Seleccionar departamento...</option>
                  <option value="Beni">Beni</option>
                  <option value="Chuquisaca">Chuquisaca</option>
                  <option value="Cochabamba">Cochabamba</option>
                  <option value="La Paz">La Paz</option>
                  <option value="Oruro">Oruro</option>
                  <option value="Pando">Pando</option>
                  <option value="Potosí">Potosí</option>
                  <option value="Santa Cruz">Santa Cruz</option>
                  <option value="Tarija">Tarija</option>
                </select>
                <div class="text-danger smaller" v-if="erroresValidacionCiudad.departamento">{{ erroresValidacionCiudad.departamento[0] }}</div>
              </div>
              <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary btn-sm border-0" style="background-color: var(--primary-color);" :disabled="guardandoCiudad">
                  <span v-if="guardandoCiudad" class="spinner-border spinner-border-sm me-1"></span>
                  Guardar y Seleccionar
                </button>
                <button type="button" class="btn btn-light btn-sm border" data-bs-toggle="modal" data-bs-target="#modalDistrito">Volver</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Ver Detalles -->
    <div class="modal fade" id="modalDetalle" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <div class="modal-header bg-light border-bottom-0">
            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Información del Distrito</h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4" v-if="distritoDetalle">
            <div class="d-flex align-items-center mb-4">
              <div class="bg-primary bg-opacity-10 p-3 rounded-circle me-3">
                <i class="bi bi-pin-map-fill fs-3 text-primary"></i>
              </div>
              <div>
                <h4 class="mb-0 fw-bold">{{ distritoDetalle.nombre }}</h4>
                <p class="text-muted mb-0">Distrito</p>
              </div>
            </div>
            <hr class="text-muted opacity-25">
            <div class="row g-4">
              <div class="col-12">
                <div class="p-3 rounded bg-light border-start border-4 border-primary">
                  <label class="smaller text-muted d-block text-uppercase fw-bold mb-1">Ubicación Geográfica</label>
                  <div class="d-flex align-items-center">
                    <i class="bi bi-building me-2 text-primary"></i>
                    <span class="fw-bold fs-5">{{ distritoDetalle.ciudad?.nombre }}</span>
                  </div>
                  <div class="ms-4 text-muted small">{{ distritoDetalle.ciudad?.departamento }}, Bolivia</div>
                </div>
              </div>
              <div class="col-6">
                <label class="smaller text-muted d-block">ID Registro</label>
                <span class="fw-semibold">#{{ distritoDetalle.id }}</span>
              </div>
              <div class="col-6 text-end">
                <label class="smaller text-muted d-block">Fecha de Registro</label>
                <span class="small text-muted">{{ new Date(distritoDetalle.created_at).toLocaleDateString() }}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer border-top-0">
            <button type="button" class="btn btn-primary w-100 shadow-sm border-0"
                    style="background-color: var(--primary-color);" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.custom-action-btn { background-color: transparent; border: 1px solid transparent; transition: all 0.2s; }
.custom-action-btn:hover { background-color: var(--border-color); }

.smaller { font-size: 0.75rem; }
.cursor-pointer { cursor: pointer; }
.hover-danger:hover { color: #dc3545 !important; }
.transition-all { transition: all 0.2s ease-in-out; }
.page-item.active .custom-page-btn { background-color: var(--primary-color) !important; border-color: var(--primary-color) !important; color: white !important; }
.custom-page-btn { color: var(--text-main); font-weight: 500; }
</style>
