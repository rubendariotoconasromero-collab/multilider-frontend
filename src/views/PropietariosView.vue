<script setup>
import { catalogCommand } from '../utils/catalogCommands'
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'

const propietarios       = ref([])
const cargando           = ref(true)
const guardando          = ref(false)
const searchQuery        = ref('')
const currentPage        = ref(1)
const totalPages         = ref(1)
const isEditing          = ref(false)
const propietarioSeleccionado = ref(null)
const btnCerrarModal     = ref(null)
const erroresValidacion  = ref({})

const formVacio = () => ({
  id: null,
  tipo: 'persona_natural',
  ci: '', lugar_expedicion: '',
  nombre_completo: '',
  nombre_empresa: '', nit: '',
  telefono: '', correo: '', direccion: '',
})
const propietarioForm = ref(formVacio())

// ── Carga y búsqueda ──────────────────────────────────────────────────────────
const cargarDatosBase = async (page = 1) => {
  try {
    cargando.value = true
    const res = await api.get(`/propietarios?page=${page}&search=${searchQuery.value}`)
    propietarios.value = res.data.data
    currentPage.value  = res.data.current_page
    totalPages.value   = res.data.last_page
  } catch (error) {
    console.error('Error al cargar propietarios:', error)
  } finally {
    cargando.value = false
  }
}

const buscar = () => cargarDatosBase(1)
const limpiarBusqueda = () => { searchQuery.value = ''; buscar() }

const paginasVisibles = computed(() => {
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end   = start + maxVisible - 1
  if (end > totalPages.value) { end = totalPages.value; start = Math.max(1, end - maxVisible + 1) }
  const pages = []
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// ── Helpers de visualización ──────────────────────────────────────────────────
const nombreMostrado = (p) =>
  p.tipo === 'empresa' ? (p.nombre_empresa || p.nombre_completo) : p.nombre_completo

const identidadMostrada = (p) =>
  p.tipo === 'empresa'
    ? (p.nit ? `NIT: ${p.nit}` : '—')
    : [p.ci, p.lugar_expedicion].filter(Boolean).join(' ')

// ── CRUD ──────────────────────────────────────────────────────────────────────
const nuevoPropietario = () => {
  isEditing.value = false
  propietarioForm.value = formVacio()
  erroresValidacion.value = {}
}

const editarPropietario = (prop) => {
  isEditing.value = true
  propietarioForm.value = { ...formVacio(), ...prop }
  erroresValidacion.value = {}
}

const verPropietario = (prop) => {
  propietarioSeleccionado.value = prop
}

const guardarPropietario = async () => {
  erroresValidacion.value = {}
  guardando.value = true
  try {
    if (isEditing.value) {
      await catalogCommand(api, 'put', `/propietarios/${propietarioForm.value.id}`, propietarioForm.value)
    } else {
      await catalogCommand(api, 'post', '/propietarios', propietarioForm.value)
    }
    await cargarDatosBase(currentPage.value)
    guardando.value = false
    btnCerrarModal.value.click()
    Swal.fire({
      toast: true, position: 'top-end', icon: 'success',
      title: isEditing.value ? 'Propietario actualizado' : 'Propietario registrado',
      showConfirmButton: false, timer: 3000, timerProgressBar: true,
    })
  } catch (error) {
    if (error.response?.status === 422) {
      erroresValidacion.value = error.response.data.errors
      let html = "<ul style='text-align:left;font-size:.9rem'>"
      for (const k in erroresValidacion.value) html += `<li>${erroresValidacion.value[k].join('</li><li>')}</li>`
      html += '</ul>'
      Swal.fire({ icon: 'warning', title: 'Verifica los datos', html, confirmButtonColor: '#0B2545' })
    } else {
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'Ocurrió un error al guardar.', confirmButtonColor: '#0B2545' })
    }
  } finally {
    guardando.value = false
  }
}

const toggleEstadoPropietario = async (prop) => {
  const isActivo  = prop.estado == 1 || prop.estado === true
  const accionTxt = isActivo ? 'Desactivar' : 'Activar'
  Swal.fire({
    title: `¿${accionTxt} propietario?`, text: 'Cambiará la disponibilidad en el sistema.',
    icon: isActivo ? 'warning' : 'info',
    showCancelButton: true,
    confirmButtonColor: isActivo ? '#fb7185' : '#0B2545', cancelButtonColor: '#9ca3af',
    confirmButtonText: `Sí, ${accionTxt.toLowerCase()}`, cancelButtonText: 'Cancelar',
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await catalogCommand(api, 'delete', `/propietarios/${prop.id}`)
        await cargarDatosBase(currentPage.value)
        Swal.fire({ title: '¡Éxito!', icon: 'success', showConfirmButton: false, timer: 1500 })
      } catch {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo procesar.' })
      }
    }
  })
}

onMounted(() => cargarDatosBase())
</script>

<template>
  <div class="propietarios-container pb-5">

    <!-- Cabecera -->
    <div class="row align-items-center mb-4">
      <div class="col-md-5 mb-3 mb-md-0">
        <h2 class="h4 mb-0 fw-bold" style="color:var(--text-main)">Directorio de Propietarios</h2>
        <p class="text-muted mb-0 fs-6">Administra los dueños de los lotes y propiedades.</p>
      </div>
      <div class="col-md-7 d-flex justify-content-md-end gap-2">
        <div class="input-group" style="max-width:480px">
          <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
          <input type="text" class="form-control border-start-0 border-end-0 ps-0 shadow-none"
                 v-model="searchQuery" @keyup.enter="buscar" placeholder="Buscar CI, Nombre o Empresa...">
          <span class="input-group-text bg-white border-start-0 cursor-pointer"
                v-if="searchQuery" @click="limpiarBusqueda">
            <i class="bi bi-x-circle-fill text-muted hover-danger transition-all"></i>
          </span>
          <span class="input-group-text bg-white border-start-0" v-else></span>
          <button class="btn btn-secondary shadow-none px-3" @click="buscar" type="button">Buscar</button>
        </div>
        <button class="btn btn-primary d-flex align-items-center gap-2 border-0 shadow-sm"
                style="background-color:var(--primary-color)"
                data-bs-toggle="modal" data-bs-target="#modalPropietario"
                @click="nuevoPropietario">
          <i class="bi bi-person-plus-fill"></i> Nuevo
        </button>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card card-custom border-0 shadow-sm mb-3">
      <div class="card-body p-0">
        <div v-if="cargando" class="text-center p-5">
          <div class="spinner-border" style="color:var(--primary-color)" role="status"></div>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover mb-0 align-middle">
            <thead class="table-light text-muted" style="font-size:.85rem;text-transform:uppercase">
              <tr>
                <th class="ps-4 border-0">Tipo</th>
                <th class="border-0">Identificación</th>
                <th class="border-0">Nombre / Empresa</th>
                <th class="border-0">Contacto</th>
                <th class="border-0 text-center">Estado</th>
                <th class="text-end pe-4 border-0">Acciones</th>
              </tr>
            </thead>
            <tbody style="border-top:none">
              <tr v-if="propietarios.length === 0">
                <td colspan="6" class="text-center py-5 text-muted">
                  <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                  No se encontraron resultados para "{{ searchQuery }}".
                </td>
              </tr>
              <tr v-for="prop in propietarios" :key="prop.id">
                <td class="ps-4">
                  <span class="badge rounded-pill px-3 py-2"
                        :class="prop.tipo === 'empresa' ? 'badge-empresa' : 'badge-persona'">
                    <i class="bi me-1" :class="prop.tipo === 'empresa' ? 'bi-building' : 'bi-person'"></i>
                    {{ prop.tipo === 'empresa' ? 'Empresa' : 'Persona' }}
                  </span>
                </td>
                <td>
                  <span class="fw-medium text-dark small">{{ identidadMostrada(prop) }}</span>
                </td>
                <td>
                  <div class="fw-semibold" style="color:var(--text-main)">{{ nombreMostrado(prop) }}</div>
                  <div v-if="prop.tipo === 'empresa' && prop.nombre_completo" class="text-muted small">
                    Rep: {{ prop.nombre_completo }}
                  </div>
                </td>
                <td>
                  <div class="small text-muted">{{ prop.telefono || 'Sin teléfono' }}</div>
                </td>
                <td class="text-center">
                  <span v-if="prop.estado == 1" class="badge badge-activo rounded-pill">Activo</span>
                  <span v-else class="badge badge-inactivo rounded-pill">Inactivo</span>
                </td>
                <td class="text-end pe-4">
                  <button class="btn btn-sm btn-light me-2 custom-action-btn"
                          data-bs-toggle="modal" data-bs-target="#modalVerPropietario"
                          @click="verPropietario(prop)" title="Ver Detalles">
                    <i class="bi bi-eye text-primary"></i>
                  </button>
                  <button class="btn btn-sm btn-light me-2 custom-action-btn"
                          data-bs-toggle="modal" data-bs-target="#modalPropietario"
                          @click="editarPropietario(prop)" title="Editar">
                    <i class="bi bi-pencil-square" style="color:var(--primary-color)"></i>
                  </button>
                  <button class="btn btn-sm btn-light custom-action-btn"
                          @click="toggleEstadoPropietario(prop)"
                          :title="prop.estado == 1 ? 'Desactivar' : 'Activar'">
                    <i class="bi" :class="prop.estado == 1 ? 'bi-trash text-danger' : 'bi-check-circle text-success'"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Paginación -->
    <nav v-if="totalPages > 1" class="d-flex justify-content-between align-items-center mt-3">
      <small class="text-muted">Mostrando página {{ currentPage }} de {{ totalPages }}</small>
      <ul class="pagination pagination-sm mb-0 shadow-sm">
        <li class="page-item" :class="{ disabled: currentPage === 1 }">
          <button class="page-link shadow-none text-secondary" @click="cargarDatosBase(currentPage - 1)">
            <i class="bi bi-chevron-left"></i>
          </button>
        </li>
        <li class="page-item" v-for="page in paginasVisibles" :key="page" :class="{ active: currentPage === page }">
          <button class="page-link shadow-none custom-page-btn" @click="cargarDatosBase(page)">{{ page }}</button>
        </li>
        <li class="page-item" :class="{ disabled: currentPage === totalPages }">
          <button class="page-link shadow-none text-secondary" @click="cargarDatosBase(currentPage + 1)">
            <i class="bi bi-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>

    <!-- ═══ Modal Crear / Editar ═══ -->
    <div class="modal fade" id="modalPropietario" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-custom border-0">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold" style="color:var(--text-main)">
              <i class="bi bi-person-lines-fill me-2" style="color:var(--primary-color)"></i>
              {{ isEditing ? 'Editar Propietario' : 'Registrar Propietario' }}
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" :disabled="guardando"></button>
            <button type="button" class="d-none" data-bs-dismiss="modal" ref="btnCerrarModal"></button>
          </div>
          <div class="modal-body p-4">
            <form @submit.prevent="guardarPropietario">

              <!-- Tipo de propietario -->
              <div class="mb-4">
                <label class="form-label fw-medium fs-6">Tipo de propietario *</label>
                <div class="d-flex gap-3">
                  <div class="form-check form-check-inline">
                    <input class="form-check-input shadow-none" type="radio" id="tipoPersona"
                           v-model="propietarioForm.tipo" value="persona_natural">
                    <label class="form-check-label" for="tipoPersona">
                      <i class="bi bi-person me-1"></i>Persona Natural
                    </label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input shadow-none" type="radio" id="tipoEmpresa"
                           v-model="propietarioForm.tipo" value="empresa">
                    <label class="form-check-label" for="tipoEmpresa">
                      <i class="bi bi-building me-1"></i>Empresa
                    </label>
                  </div>
                </div>
              </div>

              <!-- Campos para EMPRESA -->
              <template v-if="propietarioForm.tipo === 'empresa'">
                <div class="row mb-3">
                  <div class="col-md-8">
                    <label class="form-label fw-medium fs-6">Razon Social*</label>
                    <input type="text" class="form-control shadow-none bg-light border-0"
                           :class="{ 'is-invalid border-danger': erroresValidacion.nombre_empresa }"
                           v-model="propietarioForm.nombre_empresa" required>
                    <div class="invalid-feedback">{{ erroresValidacion.nombre_empresa?.[0] }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label fw-medium fs-6">NIT</label>
                    <input type="text" class="form-control shadow-none bg-light border-0"
                           v-model="propietarioForm.nit" placeholder="Ej: 123456789">
                  </div>
                </div>
              </template>

              <!-- Campos para PERSONA NATURAL -->
              <template v-else>
                <div class="row mb-3">
                  <div class="col-md-8">
                    <label class="form-label fw-medium fs-6">Cédula de Identidad</label>
                    <input type="text" class="form-control shadow-none bg-light border-0"
                           :class="{ 'is-invalid border-danger': erroresValidacion.ci }"
                           v-model="propietarioForm.ci">
                    <div class="invalid-feedback">{{ erroresValidacion.ci?.[0] }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label fw-medium fs-6">Expedido en</label>
                    <select class="form-select shadow-none bg-light border-0" v-model="propietarioForm.lugar_expedicion">
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
                    </select>
                  </div>
                </div>
              </template>

              <!-- Nombre completo (siempre visible; para empresa es el representante) -->
              <div class="mb-3">
                <label class="form-label fw-medium fs-6">
                  {{ propietarioForm.tipo === 'empresa' ? 'Nombre del Representante *' : 'Nombre Completo *' }}
                </label>
                <input type="text" class="form-control shadow-none bg-light border-0"
                       :class="{ 'is-invalid border-danger': erroresValidacion.nombre_completo }"
                       v-model="propietarioForm.nombre_completo" required>
              </div>

              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label fw-medium fs-6">Teléfono / Celular</label>
                  <input type="text" class="form-control shadow-none bg-light border-0" v-model="propietarioForm.telefono">
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-medium fs-6">Correo Electrónico</label>
                  <input type="email" class="form-control shadow-none bg-light border-0" v-model="propietarioForm.correo">
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label fw-medium fs-6">
                  {{ propietarioForm.tipo === 'empresa' ? 'Dirección de la Empresa' : 'Dirección de Residencia' }}
                </label>
                <textarea class="form-control shadow-none bg-light border-0" v-model="propietarioForm.direccion" rows="2"></textarea>
              </div>

              <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                <button type="button" class="btn btn-light shadow-none px-4" data-bs-dismiss="modal" :disabled="guardando">Cancelar</button>
                <button type="submit" class="btn btn-primary border-0 shadow-sm px-4"
                        style="background-color:var(--primary-color)" :disabled="guardando">
                  <span v-if="guardando" class="spinner-border spinner-border-sm me-2"></span>
                  {{ guardando ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Modal Ver Detalles ═══ -->
    <div class="modal fade" id="modalVerPropietario" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card-custom border-0">
          <div class="modal-header bg-light border-bottom-0 pb-3 p-4">
            <h5 class="modal-title fw-bold">
              <i class="bi bi-person-vcard text-primary me-2"></i> Perfil del Propietario
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4" v-if="propietarioSeleccionado">

            <!-- Avatar + nombre principal -->
            <div class="text-center mb-4">
              <div class="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                   :class="propietarioSeleccionado.tipo === 'empresa' ? 'badge-empresa' : 'badge-persona'"
                   style="width:70px;height:70px">
                <i class="fs-1" :class="propietarioSeleccionado.tipo === 'empresa' ? 'bi bi-building' : 'bi bi-person-fill'"></i>
              </div>
              <h5 class="fw-bold mb-1" style="color:var(--text-main)">{{ nombreMostrado(propietarioSeleccionado) }}</h5>
              <div class="d-flex justify-content-center gap-2 mt-2">
                <span class="badge rounded-pill px-3 py-2"
                      :class="propietarioSeleccionado.tipo === 'empresa' ? 'badge-empresa' : 'badge-persona'">
                  {{ propietarioSeleccionado.tipo === 'empresa' ? 'Empresa' : 'Persona Natural' }}
                </span>
                <span v-if="propietarioSeleccionado.estado == 1" class="badge badge-activo rounded-pill px-3 py-2">Activo</span>
                <span v-else class="badge badge-inactivo rounded-pill px-3 py-2">Inactivo</span>
              </div>
            </div>

            <div class="card bg-light border-0 shadow-none mb-3">
              <div class="card-body">

                <!-- Datos de empresa -->
                <template v-if="propietarioSeleccionado.tipo === 'empresa'">
                  <div class="row mb-2">
                    <div class="col-5 text-muted small fw-bold">Empresa</div>
                    <div class="col-7 fw-medium">{{ propietarioSeleccionado.nombre_empresa || '—' }}</div>
                  </div>
                  <div class="row mb-2">
                    <div class="col-5 text-muted small fw-bold">NIT</div>
                    <div class="col-7">{{ propietarioSeleccionado.nit || '—' }}</div>
                  </div>
                  <div class="row mb-2">
                    <div class="col-5 text-muted small fw-bold">Representante</div>
                    <div class="col-7">{{ propietarioSeleccionado.nombre_completo || '—' }}</div>
                  </div>
                </template>

                <!-- Datos de persona natural -->
                <template v-else>
                  <div class="row mb-2">
                    <div class="col-5 text-muted small fw-bold">Cédula (CI)</div>
                    <div class="col-7 fw-medium">
                      {{ propietarioSeleccionado.ci || '—' }}
                      {{ propietarioSeleccionado.lugar_expedicion }}
                    </div>
                  </div>
                </template>

                <div class="row mb-2">
                  <div class="col-5 text-muted small fw-bold">Teléfono</div>
                  <div class="col-7">{{ propietarioSeleccionado.telefono || '—' }}</div>
                </div>
                <div class="row mb-2">
                  <div class="col-5 text-muted small fw-bold">Correo</div>
                  <div class="col-7 text-truncate" :title="propietarioSeleccionado.correo">
                    {{ propietarioSeleccionado.correo || '—' }}
                  </div>
                </div>
                <div class="row">
                  <div class="col-5 text-muted small fw-bold">Dirección</div>
                  <div class="col-7">{{ propietarioSeleccionado.direccion || 'No registrada' }}</div>
                </div>
              </div>
            </div>

            <div class="text-end mt-4">
              <button type="button" class="btn btn-secondary px-4 shadow-none" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.form-control:focus, .form-select:focus {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--primary-color) !important;
  box-shadow: 0 0 0 0.25rem rgba(162, 139, 250, 0.25) !important;
}
.custom-action-btn { background-color: transparent; border: 1px solid transparent; transition: all .2s; }
.custom-action-btn:hover { background-color: var(--border-color); }
.cursor-pointer { cursor: pointer; }
.hover-danger:hover { color: #dc3545 !important; }
.transition-all { transition: all .2s ease-in-out; }
.page-item.active .custom-page-btn {
  background-color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
  color: white !important;
}
.custom-page-btn { color: var(--text-main); font-weight: 500; }

/* Badges personalizados para Propietarios (Tono Formal) */
.badge-empresa {
  background-color: #0B2545 !important; /* Deep Navy */
  color: #ffffff !important;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.badge-persona {
  background-color: #475569 !important; /* Slate */
  color: #ffffff !important;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.badge-activo {
  background-color: #15803d !important; /* Dark Green */
  color: #ffffff !important;
  font-weight: 600;
}

.badge-inactivo {
  background-color: #b91c1c !important; /* Dark Red */
  color: #ffffff !important;
  font-weight: 600;
}
</style>
