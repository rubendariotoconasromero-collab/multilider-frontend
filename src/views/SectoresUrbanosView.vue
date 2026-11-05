<script setup>
import { catalogCommand } from '../utils/catalogCommands'
import { ref, onMounted, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'
import LiveSearchSelect from '../components/LiveSearchSelect.vue'

const sectores = ref([])
const ciudades = ref([])
const distritos = ref([])
const distritosForm = ref([])
const cargando = ref(true)
const guardando = ref(false)

const TIPOS = ['Barrio', 'Urbanización', 'Condominio']

const pagination = ref({
  current_page: 1,
  last_page: 1,
  per_page: 10,
  total: 0
})

const filtros = ref({
  buscar: '',
  distrito_id: ''
})

const isEditing = ref(false)
const sectorForm = ref({
  id: null,
  distrito_id: null,
  nombre: '',
  tipo: 'Barrio',
  uv: '',
  manzano: '',
  estado: true
})
const btnCerrarModal = ref(null)
const erroresValidacion = ref({})

const sectorDetalle = ref(null)

// Para el selector en cascada en el formulario
const formCiudadId = ref('')
const targetDistritoId = ref(null)

// Selector de ciudad en el filtro (local, no enviado al backend)
const filtroCiudadId = ref('')

const cargarSectores = async (page = 1) => {
  try {
    cargando.value = true
    const params = {
      page,
      per_page: pagination.value.per_page,
      search: filtros.value.buscar,
      distrito_id: filtros.value.distrito_id
    }
    const res = await api.get('/sectores-urbanos', { params })
    sectores.value = res.data.data
    pagination.value = {
      current_page: res.data.current_page,
      last_page: res.data.last_page,
      per_page: res.data.per_page,
      total: res.data.total
    }
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los sectores urbanos.', confirmButtonColor: 'var(--primary-color)' })
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

const cargarDistritos = async (ciudadId = null) => {
  try {
    const params = { per_page: 1000 }
    if (ciudadId) params.ciudad_id = ciudadId
    const res = await api.get('/distritos', { params })
    distritos.value = res.data.data.filter(d => d.estado)
  } catch (error) {
    console.error('Error al cargar distritos:', error)
  }
}

const cargarDistritosFormulario = async (ciudadId = null) => {
  if (!ciudadId) {
    distritosForm.value = []
    return
  }
  try {
    const res = await api.get('/distritos', { params: { per_page: 1000, ciudad_id: ciudadId } })
    distritosForm.value = res.data.data.filter(d => d.estado)
  } catch (error) {
    console.error('Error al cargar distritos para formulario:', error)
    distritosForm.value = []
  }
}

// Watcher para selector en cascada en el formulario (Ciudad -> Distrito)
watch(formCiudadId, async (newVal) => {
  const savedId = targetDistritoId.value
  targetDistritoId.value = null
  if (!savedId) sectorForm.value.distrito_id = null
  await cargarDistritosFormulario(newVal)
  if (savedId) sectorForm.value.distrito_id = savedId
})

// Filtros en cascada: ciudad → distritos del filtro
watch(filtroCiudadId, (newVal) => {
  filtros.value.distrito_id = ''
  cargarDistritos(newVal || null)
})

let timeoutBusqueda = null
watch(() => filtros.value.buscar, () => {
  if (timeoutBusqueda) clearTimeout(timeoutBusqueda)
  timeoutBusqueda = setTimeout(() => cargarSectores(1), 500)
})
watch(() => filtros.value.distrito_id, () => cargarSectores(1))

const nuevoSector = () => {
  isEditing.value = false
  formCiudadId.value = ''
  targetDistritoId.value = null
  distritosForm.value = []
  sectorForm.value = { id: null, distrito_id: null, nombre: '', tipo: 'Barrio', uv: '', manzano: '', estado: true }
  erroresValidacion.value = {}
}

const editarSector = (item) => {
  isEditing.value = true
  targetDistritoId.value = item.distrito_id
  formCiudadId.value = item.distrito?.ciudad_id || ''
  
  sectorForm.value = {
    id: item.id,
    distrito_id: item.distrito_id,
    nombre: item.nombre,
    tipo: item.tipo,
    uv: item.uv || '',
    manzano: item.manzano || '',
    estado: item.estado == 1 || item.estado === true
  }
  erroresValidacion.value = {}
}

const verSector = (item) => {
  sectorDetalle.value = item
}

const guardarSector = async () => {
  erroresValidacion.value = {}
  guardando.value = true
  try {
    const payload = { ...sectorForm.value }
    if (isEditing.value) {
      await catalogCommand(api, 'put', `/sectores-urbanos/${sectorForm.value.id}`, payload)
    } else {
      await catalogCommand(api, 'post', '/sectores-urbanos', payload)
    }
    await cargarSectores(pagination.value.current_page)
    btnCerrarModal.value.click()
    Swal.fire({
      toast: true, position: 'top-end', icon: 'success',
      title: isEditing.value ? 'Sector actualizado' : 'Sector registrado',
      showConfirmButton: false, timer: 3000, timerProgressBar: true
    })
  } catch (error) {
    if (error.response?.status === 422) {
      erroresValidacion.value = error.response.data.errors
    } else {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al guardar el sector.', confirmButtonColor: 'var(--primary-color)' })
    }
  } finally {
    guardando.value = false
  }
}

const toggleEstadoSector = (item) => {
  const isActivo = item.estado == 1 || item.estado === true
  const accion = isActivo ? 'Desactivar' : 'Activar'
  Swal.fire({
    title: `¿${accion} sector?`,
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
        await catalogCommand(api, 'delete', `/sectores-urbanos/${item.id}`)
        await cargarSectores(pagination.value.current_page)
        Swal.fire({ title: `¡${isActivo ? 'Desactivado' : 'Activado'}!`, icon: 'success', confirmButtonColor: 'var(--primary-color)' })
      } catch {
        Swal.fire('Error', `No se pudo ${accion.toLowerCase()} el sector.`, 'error')
      }
    }
  })
}

onMounted(() => {
  cargarSectores()
  cargarCiudades()
  cargarDistritos()
})
</script>

<template>
  <div class="container-fluid py-4 pb-5">

    <div class="row align-items-center mb-4">
      <div class="col-md-5 mb-3 mb-md-0">
        <h2 class="h4 fw-bold mb-0" style="color: var(--text-main);">Sectores Urbanos</h2>
        <p class="text-muted small mb-0">Barrios, Urbanizaciones y Condominios por Distrito.</p>
      </div>
      <div class="col-md-7 d-flex justify-content-md-end gap-2 flex-wrap">
        <!-- Filtro Ciudad → Distrito -->
        <select class="form-select form-select-sm border shadow-none" style="max-width: 170px;"
                v-model="filtroCiudadId">
          <option value="">Todas las ciudades</option>
          <option v-for="c in ciudades" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
        <select class="form-select form-select-sm border shadow-none" style="max-width: 170px;"
                v-model="filtros.distrito_id" :disabled="!filtroCiudadId && !distritos.length">
          <option value="">Todos los distritos</option>
          <option v-for="d in distritos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
        </select>

        <div class="input-group" style="max-width: 250px;">
          <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
          <input type="text" class="form-control border-start-0 border-end-0 ps-0 shadow-none"
                 v-model="filtros.buscar" placeholder="Buscar sector...">
          <span class="input-group-text bg-white border-start-0 cursor-pointer" v-if="filtros.buscar" @click="filtros.buscar = ''">
            <i class="bi bi-x-circle-fill text-muted hover-danger transition-all"></i>
          </span>
          <span class="input-group-text bg-white border-start-0" v-else></span>
        </div>

        <button class="btn btn-primary d-flex align-items-center gap-2 shadow-sm border-0 px-3"
                style="background-color: var(--primary-color);"
                data-bs-toggle="modal" data-bs-target="#modalSector" @click="nuevoSector">
          <i class="bi bi-plus-lg"></i> Nuevo
        </button>
      </div>
    </div>

    <div class="card card-custom border-0 shadow-sm overflow-hidden mb-3">
      <div class="card-body p-0">
        <div v-if="cargando" class="text-center p-5">
          <div class="spinner-border text-primary" role="status"></div>
          <div class="mt-2 text-muted small">Cargando sectores...</div>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="bg-light text-muted small text-uppercase">
              <tr>
                <th class="ps-4 border-0">ID</th>
                <th class="border-0">Nombre</th>
                <th class="border-0">Tipo</th>
                <th class="border-0">Distrito / Ciudad</th>
                <th class="border-0">Estado</th>
                <th class="text-end pe-4 border-0">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sector in sectores" :key="sector.id">
                <td class="ps-4 fw-medium text-muted">#{{ sector.id }}</td>
                <td><span class="fw-bold" style="color: var(--text-main);">{{ sector.nombre }}</span></td>
                <td>
                  <span class="badge rounded-pill"
                    :class="sector.tipo === 'Urbanización' ? 'bg-primary bg-opacity-10 text-primary' : sector.tipo === 'Condominio' ? 'bg-warning bg-opacity-10 text-warning' : 'bg-secondary bg-opacity-10 text-secondary'">
                    {{ sector.tipo }}
                  </span>
                </td>
                <td>
                  <div class="fw-medium">{{ sector.distrito?.nombre }}</div>
                  <div class="smaller text-muted">{{ sector.distrito?.ciudad?.nombre }}</div>
                </td>
                <td>
                  <span v-if="sector.estado == 1 || sector.estado === true"
                    class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1 rounded-pill">Activo</span>
                  <span v-else
                    class="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-2 py-1 rounded-pill">Inactivo</span>
                </td>
                <td class="text-end pe-4">
                  <button class="btn btn-sm btn-light me-2 custom-action-btn" title="Ver Detalles"
                          data-bs-toggle="modal" data-bs-target="#modalDetalle" @click="verSector(sector)">
                    <i class="bi bi-eye text-primary"></i>
                  </button>
                  <button class="btn btn-sm btn-light me-2 custom-action-btn" title="Editar"
                          data-bs-toggle="modal" data-bs-target="#modalSector" @click="editarSector(sector)">
                    <i class="bi bi-pencil-square text-info"></i>
                  </button>
                  <button class="btn btn-sm btn-light custom-action-btn"
                          @click="toggleEstadoSector(sector)"
                          :title="sector.estado == 1 || sector.estado === true ? 'Desactivar' : 'Activar'">
                    <i class="bi" :class="sector.estado == 1 || sector.estado === true ? 'bi-trash text-danger' : 'bi-check-circle text-success'"></i>
                  </button>
                </td>
              </tr>
              <tr v-if="sectores.length === 0">
                <td colspan="7" class="text-center py-5 text-muted">No se encontraron sectores urbanos.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card-footer bg-transparent border-top p-4">
        <div class="d-flex justify-content-between align-items-center">
          <div class="small text-muted">Mostrando {{ sectores.length }} de {{ pagination.total }} registros</div>
          <nav v-if="pagination.last_page > 1">
            <ul class="pagination pagination-sm mb-0 shadow-sm">
              <li class="page-item" :class="{ disabled: pagination.current_page === 1 }">
                <button class="page-link shadow-none" @click="cargarSectores(pagination.current_page - 1)"><i class="bi bi-chevron-left"></i></button>
              </li>
              <li v-for="page in pagination.last_page" :key="page" class="page-item" :class="{ active: pagination.current_page === page }">
                <button class="page-link shadow-none custom-page-btn" @click="cargarSectores(page)">{{ page }}</button>
              </li>
              <li class="page-item" :class="{ disabled: pagination.current_page === pagination.last_page }">
                <button class="page-link shadow-none" @click="cargarSectores(pagination.current_page + 1)"><i class="bi bi-chevron-right"></i></button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>

    <!-- Modal CRUD Sector -->
    <div class="modal fade" id="modalSector" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold" style="color: var(--text-main);">
              <!-- <i class="bi bi-buildings-fill me-2 text-primary"></i> -->
              {{ isEditing ? 'Editar Sector Urbano' : 'Registrar Nuevo Sector Urbano' }}
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" ref="btnCerrarModal"></button>
          </div>
          <div class="modal-body p-4">
            <form @submit.prevent="guardarSector">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small fw-bold text-muted mb-1">Seleccionar Ciudad *</label>
                  <select class="form-select bg-light border-0 shadow-none" v-model="formCiudadId" required>
                    <option value="" disabled>Seleccione una ciudad...</option>
                    <option v-for="c in ciudades" :key="c.id" :value="c.id">{{ c.nombre }} ({{ c.departamento }})</option>
                  </select>
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold text-muted mb-1">Seleccionar Distrito *</label>
                  <LiveSearchSelect
                    v-model="sectorForm.distrito_id"
                    :options="distritosForm"
                    displayKey="nombre"
                    subKey="ciudad.nombre"
                    valueKey="id"
                    placeholder="Buscar distrito..."
                    :hasError="!!erroresValidacion.distrito_id"
                    :disabled="!formCiudadId || !distritosForm.length"
                  />
                  <div class="text-danger smaller mt-1" v-if="erroresValidacion.distrito_id">{{ erroresValidacion.distrito_id[0] }}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold text-muted mb-1">Tipo *</label>
                  <select class="form-select bg-light border-0 shadow-none" v-model="sectorForm.tipo">
                    <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <div class="text-danger smaller mt-1" v-if="erroresValidacion.tipo">{{ erroresValidacion.tipo[0] }}</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold text-muted mb-1">Nombre del Sector *</label>
                  <input type="text" class="form-control bg-light border-0 shadow-none"
                         v-model="sectorForm.nombre" :class="{ 'is-invalid': erroresValidacion.nombre }" required
                         placeholder="Ej: Villa Esperanza, Urb. Los Pinos">
                  <div class="invalid-feedback" v-if="erroresValidacion.nombre">{{ erroresValidacion.nombre[0] }}</div>
                </div>
              </div>

              <div class="d-flex justify-content-end gap-2 mt-4">
                <button type="button" class="btn btn-light shadow-none border" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary shadow-sm border-0 px-4"
                        style="background-color: var(--primary-color);" :disabled="guardando">
                  <span v-if="guardando" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  {{ guardando ? 'Guardando...' : (isEditing ? 'Actualizar Sector' : 'Guardar Sector') }}
                </button>
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
            <h5 class="modal-title fw-bold" style="color: var(--text-main);">Información del Sector Urbano</h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4" v-if="sectorDetalle">
            <div class="d-flex align-items-center mb-4">
              <!-- <div class="bg-primary bg-opacity-10 p-3 rounded-circle me-3">
                <i class="bi bi-buildings-fill fs-3 text-primary"></i>
              </div> -->
              <div>
                <h4 class="mb-0 fw-bold">{{ sectorDetalle.nombre }}</h4>
                <p class="text-muted mb-0">{{ sectorDetalle.tipo }}</p>
              </div>
            </div>
            <hr class="text-muted opacity-25">
            <div class="row g-3">
              <div class="col-12">
                <div class="p-3 rounded bg-light border-start border-4 border-primary">
                  <label class="smaller text-muted d-block text-uppercase fw-bold mb-1">Ubicación</label>
                  <div class="fw-bold">{{ sectorDetalle.distrito?.nombre }}</div>
                  <div class="small text-muted">{{ sectorDetalle.distrito?.ciudad?.nombre }}, Bolivia</div>
                </div>
              </div>
              <div class="col-6">
                <label class="smaller text-muted d-block">ID Registro</label>
                <span class="fw-semibold">#{{ sectorDetalle.id }}</span>
              </div>
              <div class="col-6 text-end">
                <label class="smaller text-muted d-block">Fecha de Registro</label>
                <span class="small text-muted">{{ new Date(sectorDetalle.created_at).toLocaleDateString() }}</span>
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
.card-custom { border-radius: 12px; background-color: var(--bg-card); }
.custom-action-btn { background-color: transparent; border: 1px solid transparent; transition: all 0.2s; }
.custom-action-btn:hover { background-color: var(--border-color); }

.smaller { font-size: 0.75rem; }
.cursor-pointer { cursor: pointer; }
.hover-danger:hover { color: #dc3545 !important; }
.transition-all { transition: all 0.2s ease-in-out; }
.page-link { color: var(--text-main); border: none; background-color: var(--bg-card); margin: 0 2px; border-radius: 4px; }
.page-item.active .custom-page-btn { background-color: var(--primary-color) !important; border-color: var(--primary-color) !important; color: white !important; }
.custom-page-btn { color: var(--text-main); font-weight: 500; }
</style>
