<script setup>
import { catalogCommand } from '../utils/catalogCommands'
import { ref, onMounted, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'

// ==========================================
// 1. ESTADO Y VARIABLES
// ==========================================
const caracteristicas = ref([])
const cargando = ref(true)
const guardando = ref(false)

// Paginación
const pagination = ref({
  current_page: 1,
  last_page: 1,
  per_page: 10,
  total: 0
})

// Filtros
const filtros = ref({
  buscar: '',
  tipo: ''
})

// Modal CRUD
const isEditing = ref(false)
const caracForm = ref({
  id: null,
  nombre: '',
  tipo: 'Interna',
  estado: true
})
const btnCerrarModal = ref(null)
const erroresValidacion = ref({})

// Modal Ver Detalles
const caracDetalle = ref(null)

// ==========================================
// 2. CARGA DE DATOS
// ==========================================
const cargarCaracteristicas = async (page = 1) => {
  try {
    cargando.value = true
    const params = {
      page,
      per_page: pagination.value.per_page,
      search: filtros.value.buscar,
      tipo: filtros.value.tipo
    }
    
    const res = await api.get('/caracteristicas', { params })
    
    caracteristicas.value = res.data.data
    pagination.value = {
      current_page: res.data.current_page,
      last_page: res.data.last_page,
      per_page: res.data.per_page,
      total: res.data.total
    }
  } catch (error) {
    console.error("Error al cargar características:", error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudieron cargar las características.',
      confirmButtonColor: 'var(--primary-color)'
    })
  } finally {
    cargando.value = false
  }
}

// Debounce para búsqueda
let timeoutBusqueda = null
watch(() => filtros.value.buscar, () => {
  if (timeoutBusqueda) clearTimeout(timeoutBusqueda)
  timeoutBusqueda = setTimeout(() => {
    cargarCaracteristicas(1)
  }, 500)
})

// Filtro por tipo inmediato
watch(() => filtros.value.tipo, () => {
  cargarCaracteristicas(1)
})

// ==========================================
// 3. LÓGICA CRUD
// ==========================================
const nuevaCarac = () => {
  isEditing.value = false
  caracForm.value = { id: null, nombre: '', tipo: 'Interna', estado: true }
  erroresValidacion.value = {}
}

const editarCarac = (item) => {
  isEditing.value = true
  caracForm.value = { 
    ...item,
    estado: item.estado == 1 || item.estado === true
  }
  erroresValidacion.value = {}
}

const verCarac = (item) => {
  caracDetalle.value = item
}

const guardarCarac = async () => {
  erroresValidacion.value = {}
  guardando.value = true
  try {
    if (isEditing.value) {
      await catalogCommand(api, 'put', `/caracteristicas/${caracForm.value.id}`, caracForm.value)
    } else {
      await catalogCommand(api, 'post', '/caracteristicas', caracForm.value)
    }

    await cargarCaracteristicas(pagination.value.current_page)
    btnCerrarModal.value.click()
    
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: isEditing.value ? 'Característica actualizada' : 'Característica creada',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    if (error.response && error.response.status === 422) {
      erroresValidacion.value = error.response.data.errors
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al intentar guardar.',
        confirmButtonColor: 'var(--primary-color)'
      })
    }
  } finally {
    guardando.value = false
  }
}

const toggleEstadoCarac = (item) => {
  const isActivo = item.estado == 1 || item.estado === true;
  const accionTxt = isActivo ? 'Desactivar' : 'Activar';
  
  Swal.fire({
    title: `¿${accionTxt} característica?`,
    text: `¿Estás seguro de cambiar el estado de "${item.nombre}"?`,
    icon: isActivo ? 'warning' : 'info',
    showCancelButton: true,
    confirmButtonColor: isActivo ? '#fb7185' : 'var(--primary-color)',
    cancelButtonColor: '#9ca3af',
    confirmButtonText: `Sí, ${accionTxt.toLowerCase()}`,
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await catalogCommand(api, 'delete', `/caracteristicas/${item.id}`)
        await cargarCaracteristicas(pagination.value.current_page)
        Swal.fire('¡Hecho!', `La característica ha sido ${isActivo ? 'desactivada' : 'activada'}.`, 'success')
      } catch (error) {
        Swal.fire('Error', 'No se pudo cambiar el estado.', 'error')
      }
    }
  })
}

// Mapper de iconos según tipo
const getTipoIcon = (tipo) => {
  const icons = {
    'Servicios': 'bi-lightning-charge-fill text-info',
    'Interna': 'bi-house-heart-fill text-primary',
    'Entorno': 'bi-tree-fill text-success'
  }
  return icons[tipo] || 'bi-bookmark-fill text-secondary'
}

onMounted(() => {
  cargarCaracteristicas()
})
</script>

<template>
  <div class="container-fluid py-4 pb-5">
    
    <!-- Cabecera -->
    <div class="row align-items-center mb-4">
      <div class="col-md-5 mb-3 mb-md-0">
        <h2 class="h4 mb-0 fw-bold" style="color: var(--text-main);">Características de Propiedades</h2>
        <p class="text-muted small mb-0">Gestiona amenidades, servicios y atributos del entorno.</p>
      </div>
      <div class="col-md-7 d-flex justify-content-md-end gap-2">
        <div class="input-group" style="max-width: 540px;">
          <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
          <input type="text" class="form-control border-start-0 border-end-0 ps-0 shadow-none" 
                 v-model="filtros.buscar" @keyup.enter="cargarCaracteristicas(1)" placeholder="Buscar característica...">
          
          <select class="form-select border-start-0 border-end-0 shadow-none bg-white" v-model="filtros.tipo" style="max-width: 130px;">
            <option value="">Todos</option>
            <option value="Servicios">Servicios</option>
            <option value="Interna">Interna</option>
            <option value="Entorno">Entorno</option>
          </select>

          <span class="input-group-text bg-white border-start-0 cursor-pointer" v-if="filtros.buscar || filtros.tipo" 
                @click="filtros.buscar = ''; filtros.tipo = ''" title="Limpiar">
            <i class="bi bi-x-circle-fill text-muted hover-danger transition-all"></i>
          </span>
          <span class="input-group-text bg-white border-start-0" v-else></span>
          <button class="btn btn-secondary shadow-none px-3" @click="cargarCaracteristicas(1)" type="button">Buscar</button>
        </div>
        <button class="btn btn-primary d-flex align-items-center gap-2 border-0 shadow-sm px-3" 
                style="background-color: var(--primary-color);" 
                data-bs-toggle="modal" data-bs-target="#modalCarac" @click="nuevaCarac">
          <i class="bi bi-plus-lg"></i> Nueva
        </button>
      </div>
    </div>

    <!-- Tarjeta de Listado -->
    <div class="card card-custom border-0 shadow-sm overflow-hidden mb-3">
      <div class="card-body p-0">
        <div v-if="cargando" class="text-center p-5">
          <div class="spinner-border text-primary" role="status"></div>
          <div class="mt-2 text-muted small">Cargando datos...</div>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th class="ps-4">Característica</th>
                <th>Categoría</th>
                <th class="text-center">Estado</th>
                <th class="text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="carac in caracteristicas" :key="carac.id">
                <td class="ps-4">
                  <div class="d-flex align-items-center">
                    <div class="bg-light rounded p-2 me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                      <i class="bi" :class="getTipoIcon(carac.tipo)" style="font-size: 1.2rem;"></i>
                    </div>
                    <div>
                      <span class="fw-bold" style="color: var(--text-main);">{{ carac.nombre }}</span>
                      <div class="smaller text-muted">ID: #{{ carac.id }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge bg-opacity-10 px-3 py-2 rounded-pill fw-medium" 
                        :class="carac.tipo === 'Servicios' ? 'bg-info text-info' : (carac.tipo === 'Interna' ? 'bg-primary text-primary' : 'bg-success text-success')">
                    {{ carac.tipo }}
                  </span>
                </td>
                <td class="text-center">
                  <span v-if="carac.estado == 1 || carac.estado === true" class="badge-status badge-status-active">Activo</span>
                  <span v-else class="badge-status badge-status-inactive">Inactivo</span>
                </td>
                <td class="text-end pe-4">
                  <button class="btn btn-sm btn-light me-2 custom-action-btn" title="Ver"
                          data-bs-toggle="modal" data-bs-target="#modalDetalle" @click="verCarac(carac)">
                    <i class="bi bi-eye text-primary"></i>
                  </button>
                  <button class="btn btn-sm btn-light me-2 custom-action-btn" title="Editar"
                          data-bs-toggle="modal" data-bs-target="#modalCarac" @click="editarCarac(carac)">
                    <i class="bi bi-pencil-square text-info"></i>
                  </button>
                  <button class="btn btn-sm btn-light custom-action-btn" 
                          @click="toggleEstadoCarac(carac)"
                          :title="carac.estado == 1 || carac.estado === true ? 'Desactivar' : 'Activar'">
                    <i class="bi" :class="carac.estado == 1 || carac.estado === true ? 'bi-trash text-danger' : 'bi-check-circle text-success'"></i>
                  </button>
                </td>
              </tr>
              <tr v-if="caracteristicas.length === 0">
                <td colspan="4" class="text-center py-5 text-muted">No se encontraron características.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer con Paginación -->
      <div class="card-footer bg-transparent border-top p-4">
        <div class="d-flex justify-content-between align-items-center">
          <div class="small text-muted">
            Mostrando {{ caracteristicas.length }} de {{ pagination.total }} registros
          </div>
          <nav v-if="pagination.last_page > 1">
            <ul class="pagination pagination-sm mb-0 shadow-sm">
              <li class="page-item" :class="{ disabled: pagination.current_page === 1 }">
                <button class="page-link shadow-none" @click="cargarCaracteristicas(pagination.current_page - 1)">
                  <i class="bi bi-chevron-left"></i>
                </button>
              </li>
              <li v-for="page in pagination.last_page" :key="page" class="page-item" 
                  :class="{ active: pagination.current_page === page }">
                <button class="page-link shadow-none custom-page-btn" @click="cargarCaracteristicas(page)">{{ page }}</button>
              </li>
              <li class="page-item" :class="{ disabled: pagination.current_page === pagination.last_page }">
                <button class="page-link shadow-none" @click="cargarCaracteristicas(pagination.current_page + 1)">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>

    <!-- Modal CRUD -->
    <div class="modal fade" id="modalCarac" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold" style="color: var(--text-main);">
              <!-- <i class="bi bi-tags-fill me-2 text-primary"></i> -->
              {{ isEditing ? 'Editar Característica' : 'Nueva Característica' }}
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" ref="btnCerrarModal"></button>
          </div>
          <div class="modal-body p-4">
            <form @submit.prevent="guardarCarac">
              
              <div class="mb-3">
                <label class="form-label small fw-bold text-muted mb-1">Nombre de la Característica *</label>
                <input type="text" class="form-control bg-light border-0 shadow-none" 
                       v-model="caracForm.nombre" :class="{ 'is-invalid': erroresValidacion.nombre }" required
                       placeholder="Ej: Aire Acondicionado, Piscina, WiFi">
                <div class="invalid-feedback" v-if="erroresValidacion.nombre">{{ erroresValidacion.nombre[0] }}</div>
              </div>

              <div class="mb-4">
                <label class="form-label small fw-bold text-muted mb-1">Categoría / Tipo *</label>
                <select class="form-select bg-light border-0 shadow-none" v-model="caracForm.tipo" required>
                  <option value="Servicios">Servicios (Luz, Agua, Gas...)</option>
                  <option value="Interna">Interna (Pisos, Cocina, AA...)</option>
                  <option value="Entorno">Entorno (Parques, Colegios...)</option>
                </select>
                <div class="invalid-feedback" v-if="erroresValidacion.tipo">{{ erroresValidacion.tipo[0] }}</div>
              </div>

              <div v-if="isEditing" class="mb-4 form-check form-switch d-flex align-items-center ms-1">
                <input class="form-check-input shadow-none fs-5 me-2 custom-switch" type="checkbox" v-model="caracForm.estado">
                <label class="form-check-label text-muted fw-medium mt-1">
                  {{ caracForm.estado ? 'Característica Disponible' : 'Característica Inactiva' }}
                </label>
              </div>

              <div class="d-flex justify-content-end gap-2 mt-4">
                <button type="button" class="btn btn-light shadow-none border" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary shadow-sm border-0 px-4" 
                        style="background-color: var(--primary-color);" :disabled="guardando">
                  <span v-if="guardando" class="spinner-border spinner-border-sm me-2" role="status"></span>
                  {{ guardando ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Guardar') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Ver Detalles -->
    <div class="modal fade" id="modalDetalle" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content border-0 shadow">
          <div class="modal-header bg-light border-bottom-0">
            <h6 class="modal-title fw-bold">Información de la Característica</h6>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4 text-center" v-if="caracDetalle">
            <div class="bg-primary bg-opacity-10 p-4 rounded-circle d-inline-flex mb-3">
              <i class="bi fs-1" :class="getTipoIcon(caracDetalle.tipo)"></i>
            </div>
            <h5 class="fw-bold mb-1">{{ caracDetalle.nombre }}</h5>
            <div class="badge bg-primary bg-opacity-10 text-primary mb-3">{{ caracDetalle.tipo }}</div>
            
            <div class="row g-2 border-top pt-3 mt-2">
              <div class="col-6 text-start">
                <label class="smaller text-muted d-block">ID Registro</label>
                <span class="fw-semibold small">#{{ caracDetalle.id }}</span>
              </div>
              <div class="col-6 text-end">
                <label class="smaller text-muted d-block">Estado</label>
                <span :class="caracDetalle.estado ? 'text-success' : 'text-danger'" class="small fw-bold">
                  {{ caracDetalle.estado ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
            </div>
          </div>
          <div class="modal-footer border-top-0 pt-0">
            <button type="button" class="btn btn-primary w-100 shadow-sm border-0" 
                    style="background-color: var(--primary-color);" data-bs-dismiss="modal">Entendido</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.smaller { font-size: 0.75rem; }
.custom-action-btn { background-color: transparent; border: 1px solid transparent; transition: all 0.2s; }
.custom-action-btn:hover { background-color: var(--border-color); }

.cursor-pointer { cursor: pointer; }
.hover-danger:hover { color: #dc3545 !important; }
.transition-all { transition: all 0.2s ease-in-out; }

.page-item.active .custom-page-btn {
  background-color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
  color: white !important;
}
.custom-page-btn { color: var(--text-main); font-weight: 500; }

.custom-switch:checked {
  background-color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
}
</style>
