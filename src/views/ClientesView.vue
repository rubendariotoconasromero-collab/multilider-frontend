<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'

// --- VARIABLES GENERALES ---
const clientes = ref([])
const cargando = ref(true)
const guardando = ref(false)

// --- PAGINACIÓN Y BÚSQUEDA ---
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)

// --- VARIABLES MODALES ---
const isEditing = ref(false)
const btnCerrarModal = ref(null)
const erroresValidacion = ref({})
const clienteSeleccionado = ref(null) 

// --- FORMULARIO INTEGRADO (Cliente + Usuario) ---
const clienteForm = ref({
  id: null, ci: '', lugar_expedicion: '', nombre_completo: '', telefono: '', correo: '', direccion: '', estado: true
})

// ==========================================
// 1. CARGA BASE
// ==========================================
const cargarDatosBase = async (page = 1) => {
  try {
    cargando.value = true
    const res = await api.get(`/clientes?page=${page}&search=${searchQuery.value}`)
    clientes.value = res.data.data
    currentPage.value = res.data.current_page
    totalPages.value = res.data.last_page
  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    console.error("Error al cargar clientes:", error)
  } finally {
    cargando.value = false
  }
}

const buscar = () => cargarDatosBase(1)
const limpiarBusqueda = () => { searchQuery.value = ''; buscar() }

const paginasVisibles = computed(() => {
  let pages = []
  const maxVisible = 5 
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = start + maxVisible - 1

  if (end > totalPages.value) {
    end = totalPages.value
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// ==========================================
// 2. PREPARAR FORMULARIOS
// ==========================================
const nuevoCliente = () => {
  isEditing.value = false
  clienteForm.value = { id: null, ci: '', lugar_expedicion: '', nombre_completo: '', telefono: '', correo: '', direccion: '', estado: true }
  erroresValidacion.value = {}
}

const editarCliente = (cliente) => {
  isEditing.value = true
  clienteForm.value = { 
    ...cliente,
    estado: cliente.estado == 1 || cliente.estado === true
  }
  erroresValidacion.value = {}
}

const verCliente = (cliente) => clienteSeleccionado.value = cliente

// ==========================================
// 3. GUARDAR
// ==========================================
const guardarCliente = async () => {
  erroresValidacion.value = {}
  guardando.value = true

  try {
    if (isEditing.value) {
      await api.put(`/clientes/${clienteForm.value.id}`, clienteForm.value)
    } else {
      await api.post('/clientes', clienteForm.value)
    }
    
    await cargarDatosBase(currentPage.value)
    guardando.value = false
    btnCerrarModal.value.click() // Ninja Close

    Swal.fire({
      toast: true, position: 'top-end', icon: 'success',
      title: isEditing.value ? 'Cliente actualizado' : 'Cliente registrado exitosamente',
      showConfirmButton: false, timer: 3000, timerProgressBar: true
    })

  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    if (error.response?.status === 422) {
      erroresValidacion.value = error.response.data.errors || {};
      const mensajes = Object.values(erroresValidacion.value).flat().join(' ');
      Swal.fire({ icon: 'warning', title: 'Verifica los datos',
        text: mensajes || error.response.data.message || 'Revisa el formulario.',
        confirmButtonColor: '#0B2545' });
    } else {
      Swal.fire({ icon: 'error', title: 'Oops...', text: error.response?.data?.message || 'Error al guardar.', confirmButtonColor: '#0B2545' });
    }
  } finally {
    guardando.value = false
  }
}

// ==========================================
// 4. ACTIVAR / DESACTIVAR
// ==========================================
const toggleEstadoCliente = async (cliente) => {
  const isActivo = cliente.estado == 1 || cliente.estado === true;
  const accionTxt = isActivo ? 'Suspender' : 'Activar';
  const msjTxt = isActivo 
    ? "El cliente no podrá ingresar a su portal ni se mostrará activo." 
    : "El cliente recuperará su acceso al portal.";

  Swal.fire({
    title: `¿${accionTxt} cliente?`, text: msjTxt, icon: isActivo ? 'warning' : 'info',
    showCancelButton: true, confirmButtonColor: isActivo ? '#fb7185' : '#a28bfa', cancelButtonColor: '#9ca3af',
    confirmButtonText: `Sí, ${accionTxt.toLowerCase()}`, cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await api.delete(`/clientes/${cliente.id}`)
        await cargarDatosBase(currentPage.value)
        Swal.fire({ title: `¡${isActivo ? 'Suspendido' : 'Activado'}!`, icon: 'success', showConfirmButton: false, timer: 1500 })
      } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
        Swal.fire({ icon: 'error', title: 'Error', text: `No se pudo procesar.` })
      }
    }
  })
}

onMounted(() => cargarDatosBase())
</script>

<template>
  <div class="clientes-container pb-5">
    
    <!-- Cabecera -->
    <div class="row align-items-center mb-4">
      <div class="col-md-5 mb-3 mb-md-0">
        <h2 class="h4 mb-0 fw-bold" style="color: var(--text-main);">Directorio de Clientes</h2>
        <p class="text-muted mb-0 fs-6">Administra a los compradores y su acceso al portal.</p>
      </div>
      <div class="col-md-7 d-flex justify-content-md-end gap-2">
        <div class="input-group" style="max-width: 480px;">
          <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
          <input type="text" class="form-control border-start-0 border-end-0 ps-0 shadow-none" 
                 v-model="searchQuery" @keyup.enter="buscar" placeholder="Buscar CI, Nombre o Correo...">
          <span class="input-group-text bg-white border-start-0 cursor-pointer" 
                v-if="searchQuery" @click="limpiarBusqueda" title="Limpiar búsqueda">
            <i class="bi bi-x-circle-fill text-muted hover-danger transition-all"></i>
          </span>
          <span class="input-group-text bg-white border-start-0" v-else></span>
          <button class="btn btn-secondary shadow-none px-3" @click="buscar" type="button">Buscar</button>
        </div>
        <button class="btn btn-primary d-flex align-items-center gap-2 border-0 shadow-sm px-3" style="background-color: var(--primary-color);" data-bs-toggle="modal" data-bs-target="#modalCliente" @click="nuevoCliente">
          <i class="bi bi-person-plus-fill"></i> Nuevo Cliente
        </button>
      </div>
    </div>

    <!-- Tarjeta de Listado -->
    <div class="card card-custom border-0 shadow-sm mb-3">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0 align-middle table-clientes">
            <thead>
              <tr>
                <th class="ps-4">Cédula</th>
                <th>Cliente</th>
                <th>Contacto</th>
                <th class="text-center">Estado / Acceso</th>
                <th class="text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="cargando"><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></td></tr>
              <tr v-else-if="clientes.length === 0"><td colspan="5" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-2 d-block mb-2"></i> No se encontraron clientes.</td></tr>
              
              <template v-else>
                <tr v-for="cliente in clientes" :key="cliente.id">
                  <td class="ps-4">
                    <span class="fw-bold">{{ cliente.ci }}</span>
                    <span class="text-muted small ms-1">{{ cliente.lugar_expedicion }}</span>
                  </td>
                  <td>
                    <div class="d-flex align-items-center">
                      <!-- <img :src="`https://ui-avatars.com/api/?name=${cliente.nombre_completo}&background=random&color=fff`" class="rounded-circle me-3" width="36" height="36" alt="Avatar"> -->
                      <div class="fw-bold" style="color: var(--text-main);">{{ cliente.nombre_completo }}</div>
                    </div>
                  </td>
                  <td>
                    <div class="small text-muted text-truncate" style="max-width: 180px;" :title="cliente.correo"><i class="bi bi-envelope me-1"></i>{{ cliente.correo }}</div>
                    <div class="small text-muted"><i class="bi bi-telephone me-1"></i>{{ cliente.telefono || '-' }}</div>
                  </td>
                  <td class="text-center">
                    <span v-if="cliente.estado == 1" class="badge-status badge-status-active">Cuenta Activa</span>
                    <span v-else class="badge-status badge-status-danger">Suspendido</span>
                  </td>
                  <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" data-bs-toggle="modal" data-bs-target="#modalVerCliente" @click="verCliente(cliente)" title="Ver Detalles">
                      <i class="bi bi-eye text-primary"></i>
                    </button>
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" data-bs-toggle="modal" data-bs-target="#modalCliente" @click="editarCliente(cliente)" title="Editar Perfil">
                      <i class="bi bi-pencil-square text-info"></i>
                    </button>
                    <button class="btn btn-sm btn-light custom-action-btn" 
                            @click="toggleEstadoCliente(cliente)" 
                            :title="cliente.estado == 1 ? 'Suspender' : 'Activar'">
                      <i class="bi" :class="cliente.estado == 1 ? 'bi-trash text-danger' : 'bi-check-circle text-success'"></i>
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <nav v-if="totalPages > 1" class="d-flex justify-content-between align-items-center mt-3">
      <small class="text-muted">Mostrando página {{ currentPage }} de {{ totalPages }}</small>
      <ul class="pagination pagination-sm mb-0 shadow-sm">
        <li class="page-item" :class="{ disabled: currentPage === 1 }"><button class="page-link shadow-none text-secondary" @click="cargarDatosBase(currentPage - 1)"><i class="bi bi-chevron-left"></i></button></li>
        <li class="page-item" v-for="page in paginasVisibles" :key="page" :class="{ active: currentPage === page }"><button class="page-link shadow-none custom-page-btn" @click="cargarDatosBase(page)">{{ page }}</button></li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }"><button class="page-link shadow-none text-secondary" @click="cargarDatosBase(currentPage + 1)"><i class="bi bi-chevron-right"></i></button></li>
      </ul>
    </nav>

    <div class="modal fade" id="modalCliente" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-custom border-0">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold" style="color: var(--text-main);">
              <!-- <i class="bi bi-person-vcard me-2" style="color: var(--primary-color);"></i> -->
              {{ isEditing ? 'Editar Perfil del Cliente' : 'Registrar Nuevo Cliente' }}
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" :disabled="guardando"></button>
            <button type="button" class="d-none" data-bs-dismiss="modal" ref="btnCerrarModal"></button>
          </div>
          
          <div class="modal-body p-4">
            <div v-if="!isEditing" class="alert bg-primary bg-opacity-10 border-primary border-opacity-25 text-primary d-flex align-items-center p-3 mb-4 rounded">
              <i class="bi bi-info-circle-fill fs-4 me-3"></i>
              <div>
                <strong>Creación de Cuenta Automática</strong><br>
                <span class="small">Al registrar este cliente, el sistema le creará una cuenta de acceso al portal. <b>La contraseña por defecto será su número de Cédula de Identidad (CI).</b></span>
              </div>
            </div>

            <form @submit.prevent="guardarCliente">
              <h6 class="fw-bold mb-3 text-muted border-bottom pb-2">Identidad y Contacto</h6>
              
              <div class="row mb-3">
                <div class="col-md-8 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">Cédula de Identidad (CI) *</label>
                  <input type="text" class="form-control shadow-none bg-light border-0" :class="{ 'is-invalid border-danger': erroresValidacion.ci }" v-model="clienteForm.ci" placeholder="Ej. 1234567" required>
                  <div class="invalid-feedback">{{ erroresValidacion.ci?.[0] }}</div>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label text-muted fw-medium fs-6">Expedido *</label> 
                    <select 
                        class="form-select shadow-none bg-light border-0" 
                        :class="{ 'is-invalid border-danger': erroresValidacion.lugar_expedicion }" 
                        v-model="clienteForm.lugar_expedicion" 
                        required
                    >
                        <option value="" disabled>Seleccione...</option>
                        <option value="SC">Santa Cruz (SC)</option>
                        <option value="LP">La Paz (LP)</option>
                        <option value="CB">Cochabamba (CB)</option>
                        <option value="OR">Oruro (OR)</option>
                        <option value="PT">Potosí (PT)</option>
                        <option value="TJ">Tarija (TJ)</option>
                        <option value="CH">Chuquisaca (CH)</option>
                        <option value="BE">Beni (BE)</option>
                        <option value="PD">Pando (PD)</option>
                        <!-- <option value="EXT">Extranjero</option> -->
                    </select>
                    
                    <div v-if="erroresValidacion.lugar_expedicion" class="invalid-feedback d-block fw-medium">
                        {{ erroresValidacion.lugar_expedicion[0] }}
                    </div>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label text-muted fw-medium fs-6">Nombre Completo *</label>
                <input type="text" class="form-control shadow-none bg-light border-0" :class="{ 'is-invalid border-danger': erroresValidacion.nombre_completo }" v-model="clienteForm.nombre_completo" required>
                <div class="invalid-feedback">{{ erroresValidacion.nombre_completo?.[0] }}</div>
              </div>

              <div class="row mb-3">
                <div class="col-md-6 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">Correo Electrónico (Para Portal) *</label>
                  <input type="email" class="form-control shadow-none bg-light border-0" :class="{ 'is-invalid border-danger': erroresValidacion.correo }" v-model="clienteForm.correo" placeholder="ejemplo@correo.com" required>
                  <div class="invalid-feedback">{{ erroresValidacion.correo?.[0] }}</div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">Teléfono / Celular</label>
                  <input type="text" class="form-control shadow-none bg-light border-0" v-model="clienteForm.telefono">
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label text-muted fw-medium fs-6">Dirección de Residencia</label>
                <textarea class="form-control shadow-none bg-light border-0" v-model="clienteForm.direccion" rows="2"></textarea>
              </div>

              <div v-if="isEditing" class="mb-4 form-check form-switch d-flex align-items-center bg-light bg-opacity-50 p-3 rounded">
                <input class="form-check-input shadow-none fs-5 ms-0 me-3 custom-switch" type="checkbox" v-model="clienteForm.estado">
                <label class="form-check-label text-muted fw-medium mt-1">{{ clienteForm.estado ? 'Cuenta de Acceso Activa' : 'Cuenta Suspendida' }}</label>
              </div>

              <div class="d-flex justify-content-end gap-2 pt-3 border-top mt-4">
                <button type="button" class="btn btn-light shadow-none px-4" data-bs-dismiss="modal" :disabled="guardando">Cancelar</button>
                <button type="submit" class="btn btn-primary border-0 shadow-sm px-4" style="background-color: var(--primary-color);" :disabled="guardando">
                  <span v-if="guardando" class="spinner-border spinner-border-sm me-2"></span>
                  {{ guardando ? 'Guardando...' : (isEditing ? 'Actualizar Cliente' : 'Registrar Cliente') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modalVerCliente" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card-custom border-0">
          <div class="modal-header bg-light border-bottom-0 pb-3 p-4">
            <h5 class="modal-title fw-bold"><i class="bi bi-person-bounding-box text-primary me-2"></i> Perfil del Cliente</h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4" v-if="clienteSeleccionado">
            <div class="text-center mb-4">
              <img :src="`https://ui-avatars.com/api/?name=${clienteSeleccionado.nombre_completo}&background=random&color=fff&size=80`" class="rounded-circle mb-3 shadow-sm" alt="Avatar">
              <h5 class="fw-bold mb-1">{{ clienteSeleccionado.nombre_completo }}</h5>
              <div class="text-muted small mb-2">Cliente Registrado</div>
              <span v-if="clienteSeleccionado.estado == 1" class="badge bg-success rounded-pill px-3">Acceso al Portal: Activo</span>
              <span v-else class="badge bg-danger rounded-pill px-3">Acceso al Portal: Suspendido</span>
            </div>
            
            <div class="card bg-light border-0 shadow-none mb-3">
              <div class="card-body">
                <div class="row mb-3 border-bottom pb-2">
                  <div class="col-4 text-muted small fw-bold">Cédula de Identidad</div>
                  <div class="col-8 fw-medium">{{ clienteSeleccionado.ci }} <span class="text-muted">{{ clienteSeleccionado.lugar_expedicion }}</span></div>
                </div>
                <div class="row mb-3 border-bottom pb-2">
                  <div class="col-4 text-muted small fw-bold">Correo Electrónico</div>
                  <div class="col-8 text-primary">{{ clienteSeleccionado.correo }}</div>
                </div>
                <div class="row mb-3 border-bottom pb-2">
                  <div class="col-4 text-muted small fw-bold">Teléfono</div>
                  <div class="col-8">{{ clienteSeleccionado.telefono || 'No registrado' }}</div>
                </div>
                <div class="row">
                  <div class="col-4 text-muted small fw-bold">Dirección</div>
                  <div class="col-8">{{ clienteSeleccionado.direccion || 'No registrada' }}</div>
                </div>
              </div>
            </div>
            <div class="text-end mt-4"><button type="button" class="btn btn-secondary px-4 shadow-none" data-bs-dismiss="modal">Cerrar</button></div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.smaller { font-size: 0.75rem; }
.cursor-pointer { cursor: pointer; }
.hover-danger:hover { color: #dc3545 !important; }
.transition-all { transition: all 0.2s ease-in-out; }

.page-item.active .custom-page-btn { background-color: var(--primary-color) !important; border-color: var(--primary-color) !important; color: white !important; }
.custom-page-btn { color: var(--text-main); font-weight: 500; }
.custom-switch:checked { background-color: var(--primary-color) !important; border-color: var(--primary-color) !important; }

.custom-action-btn { background-color: transparent; border: 1px solid transparent; transition: all 0.2s; }
.custom-action-btn:hover { background-color: var(--border-color); }
.table-clientes .badge{ min-width:110px;}
</style>
