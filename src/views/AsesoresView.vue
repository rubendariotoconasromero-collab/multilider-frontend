<script setup>
import { apiOrigin } from '@/api/config'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'

// --- VARIABLES GENERALES ---
const asesores = ref([])
const privatePhotos = new Set()
onUnmounted(() => { for (const url of privatePhotos) URL.revokeObjectURL(url) })
async function hydratePhoto(adviser) {
  if (!adviser.foto?.startsWith('/api/asesores/')) return adviser
  try {
    const response = await api.get(adviser.foto.replace('/api', ''), { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    privatePhotos.add(url)
    return { ...adviser, foto: url }
  } catch { return { ...adviser, foto: null } }
}
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
const asesorSeleccionado = ref(null) 
const mostrarPassword = ref(false)

// URL Base para imágenes
const getFullUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) {
    // Si la URL guardada tiene el host incorrecto (sin puerto), lo corregimos
    return path.replace('http://localhost/storage', apiOrigin + '/storage');
  }
  return `${apiOrigin}${path}`;
}

// --- FORMULARIO INTEGRADO (Asesor + Usuario) ---
const asesorForm = ref({
  id: null, nombre_completo: '', telefono: '', correo: '', direccion: '', password: '', foto: null, estado: true, porcentaje_comision: 3.00
})

const fotoPreview = ref(null)
const fotoFile = ref(null)

const handleFotoChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    fotoFile.value = file
    fotoPreview.value = URL.createObjectURL(file)
  }
}

// Validación dinámica de contraseña (Igual que en UsuariosView)
const validacionPassword = computed(() => {
  const pass = asesorForm.value.password || '';
  return {
    longitud: pass.length >= 8,
    mayusculas: /[A-Z]/.test(pass),
    minusculas: /[a-z]/.test(pass),
    numeros: /[0-9]/.test(pass),
    simbolos: /[^A-Za-z0-9]/.test(pass) // Cualquier cosa que no sea letra o número
  }
})

// ==========================================
// 1. CARGA BASE
// ==========================================
const cargarDatosBase = async (page = 1) => {
  try {
    cargando.value = true
    const res = await api.get(`/asesores?page=${page}&search=${searchQuery.value}`)
    for (const url of privatePhotos) URL.revokeObjectURL(url)
    privatePhotos.clear()
    asesores.value = await Promise.all(res.data.data.map(hydratePhoto))
    currentPage.value = res.data.current_page
    totalPages.value = res.data.last_page
  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    console.error("Error al cargar asesores:", error)
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
const nuevoAsesor = () => {
  isEditing.value = false
  asesorForm.value = { id: null, nombre_completo: '', telefono: '', correo: '', direccion: '', password: '', foto: null, estado: true, porcentaje_comision: 3.00 }
  fotoPreview.value = null
  fotoFile.value = null
  erroresValidacion.value = {}
  mostrarPassword.value = false
}

const editarAsesor = (asesor) => {
  isEditing.value = true
  asesorForm.value = { 
    ...asesor,
    password: '', 
    estado: asesor.estado == 1 || asesor.estado === true
  }
  fotoPreview.value = asesor.foto
  fotoFile.value = null
  erroresValidacion.value = {}
  mostrarPassword.value = false
}

const verAsesor = (asesor) => asesorSeleccionado.value = asesor

// ==========================================
// 3. GUARDAR
// ==========================================
const guardarAsesor = async () => {
  erroresValidacion.value = {}
  guardando.value = true

  try {
    const formData = new FormData()
    formData.append('nombre_completo', asesorForm.value.nombre_completo)
    formData.append('telefono', asesorForm.value.telefono || '')
    formData.append('correo', asesorForm.value.correo)
    formData.append('direccion', asesorForm.value.direccion || '')
    formData.append('estado', asesorForm.value.estado ? 1 : 0)
    formData.append('porcentaje_comision', asesorForm.value.porcentaje_comision ?? 3.00)

    if (asesorForm.value.password) {
      formData.append('password', asesorForm.value.password)
    }
    
    if (fotoFile.value) {
      formData.append('foto', fotoFile.value)
    }

    if (isEditing.value) {
      // Laravel requiere _method=PUT para procesar archivos vía POST
      formData.append('_method', 'PUT')
      await api.post(`/asesores/${asesorForm.value.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    } else {
      await api.post('/asesores', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    }
    
    await cargarDatosBase(currentPage.value)
    
    guardando.value = false
    btnCerrarModal.value.click()

    Swal.fire({
      toast: true, position: 'top-end', icon: 'success',
      title: isEditing.value ? 'Asesor actualizado' : 'Asesor registrado',
      showConfirmButton: false, timer: 3000, timerProgressBar: true
    })

  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    if (error.response?.status === 422) {
      erroresValidacion.value = error.response.data.errors;
      let mensajeHtml = "<ul style='text-align: left; font-size: 0.9rem;'>";
      for (const campo in erroresValidacion.value) {
        mensajeHtml += `<li>${erroresValidacion.value[campo].join('</li><li>')}</li>`;
      }
      mensajeHtml += "</ul>";
      Swal.fire({ icon: 'warning', title: 'Verifica los datos', html: mensajeHtml, confirmButtonColor: '#a28bfa' });
    } else {
      Swal.fire({ icon: 'error', title: 'Oops...', text: error.response?.data?.message || 'Error al guardar.', confirmButtonColor: '#a28bfa' });
    }
  } finally {
    guardando.value = false
  }
}

// ==========================================
// 4. ACTIVAR / DESACTIVAR
// ==========================================
const toggleEstadoAsesor = async (asesor) => {
  const isActivo = asesor.estado == 1 || asesor.estado === true;
  const accionTxt = isActivo ? 'Desactivar' : 'Activar';
  const msjTxt = isActivo 
    ? "El asesor ya no podrá ingresar al sistema ni figurar en los reportes." 
    : "El asesor recuperará su acceso al sistema.";

  Swal.fire({
    title: `¿${accionTxt} asesor?`, text: msjTxt, icon: isActivo ? 'warning' : 'info',
    showCancelButton: true, confirmButtonColor: isActivo ? '#fb7185' : '#a28bfa', cancelButtonColor: '#9ca3af',
    confirmButtonText: `Sí, ${accionTxt.toLowerCase()}`, cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await api.delete(`/asesores/${asesor.id}`)
        await cargarDatosBase(currentPage.value)
        Swal.fire({ title: `¡Éxito!`, icon: 'success', showConfirmButton: false, timer: 1500 })
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
  <div class="asesores-container pb-5">
    
    <!-- Cabecera -->
    <div class="row align-items-center mb-4">
      <div class="col-md-5 mb-3 mb-md-0">
        <h2 class="h4 mb-0 fw-bold" style="color: var(--text-main);">Equipo Comercial</h2>
        <p class="text-muted mb-0 fs-6">Administra los asesores de ventas y sus accesos al sistema.</p>
      </div>
      <div class="col-md-7 d-flex justify-content-md-end gap-2">
        <div class="input-group" style="max-width: 480px;">
          <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
          <input type="text" class="form-control border-start-0 border-end-0 ps-0 shadow-none" 
                 v-model="searchQuery" @keyup.enter="buscar" placeholder="Buscar por Nombre o Correo...">
          <span class="input-group-text bg-white border-start-0 cursor-pointer" 
                v-if="searchQuery" @click="limpiarBusqueda" title="Limpiar búsqueda">
            <i class="bi bi-x-circle-fill text-muted hover-danger transition-all"></i>
          </span>
          <span class="input-group-text bg-white border-start-0" v-else></span>
          <button class="btn btn-secondary shadow-none px-3" @click="buscar" type="button">Buscar</button>
        </div>
        <button class="btn btn-primary d-flex align-items-center gap-2 border-0 shadow-sm px-3" style="background-color: var(--primary-color);" data-bs-toggle="modal" data-bs-target="#modalAsesor" @click="nuevoAsesor">
          <i class="bi bi-person-plus-fill"></i> Nuevo Asesor
        </button>
      </div>
    </div>

    <!-- Tarjeta de Listado -->
    <div class="card card-custom border-0 shadow-sm mb-3">
      <div class="card-body p-0">
        <div class="table-responsive table-asesores">
          <table class="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th class="ps-4">Nombre Asesor</th>
                <th>Contacto</th>
                <th class="text-center">% Comisión</th>
                <th class="text-center">Estado</th>
                <th class="text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="cargando"><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary" role="status"></div></td></tr>
              <tr v-else-if="asesores.length === 0"><td colspan="5" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-2 d-block mb-2"></i> No se encontraron asesores.</td></tr>
              <template v-else>
                <tr v-for="asesor in asesores" :key="asesor.id">
                  <td class="ps-4">
                    <div class="d-flex align-items-center">
                      <img v-if="asesor.foto" :src="asesor.foto?.startsWith('blob:') ? asesor.foto : getFullUrl(asesor.foto)" class="rounded-circle me-3 object-fit-cover shadow-sm" width="40" height="40" alt="Avatar">
                      <img v-else :src="`https://ui-avatars.com/api/?name=${asesor.nombre_completo}&background=0B2545&color=fff`" class="rounded-circle me-3 shadow-sm" width="40" height="40" alt="Avatar">
                      <div>
                        <div class="fw-bold" style="color: var(--text-main);">{{ asesor.nombre_completo }}</div>
                        <div class="text-muted smaller">Usuario ID: #{{ asesor.user_id }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="small text-muted"><i class="bi bi-envelope me-1"></i>{{ asesor.correo }}</div>
                    <div class="small text-muted"><i class="bi bi-telephone me-1"></i>{{ asesor.telefono || 'Sin teléfono' }}</div>
                  </td>
                  <td class="text-center">
                    <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-3">
                      {{ asesor.porcentaje_comision ?? 3.00 }}%
                    </span>
                  </td>
                  <td class="text-center">
                    <span v-if="asesor.estado == 1" class="badge-status badge-status-active">Cuenta Activa</span>
                    <span v-else class="badge-status badge-status-danger">Suspendido</span>
                  </td>
                  <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" data-bs-toggle="modal" data-bs-target="#modalVerAsesor" @click="verAsesor(asesor)" title="Ver Detalles"><i class="bi bi-eye text-primary"></i></button>
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" data-bs-toggle="modal" data-bs-target="#modalAsesor" @click="editarAsesor(asesor)" title="Editar Perfil"><i class="bi bi-pencil-square" style="color: var(--primary-color);"></i></button>
                    <button class="btn btn-sm btn-light custom-action-btn" @click="toggleEstadoAsesor(asesor)" :title="asesor.estado == 1 ? 'Desactivar' : 'Activar'"><i class="bi" :class="asesor.estado == 1 ? 'bi-trash text-danger' : 'bi-check-circle text-success'"></i></button>
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

    <div class="modal fade" id="modalAsesor" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content card-custom border-0">
          <div class="modal-header border-bottom-0 pb-0">
            <h5 class="modal-title fw-bold" style="color: var(--text-main);">
              {{ isEditing ? 'Editar Perfil y Acceso' : 'Registrar Nuevo Asesor' }}
            </h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal" :disabled="guardando"></button>
            <button type="button" class="d-none" data-bs-dismiss="modal" ref="btnCerrarModal"></button>
          </div>
          
          <div class="modal-body p-4">
            <form @submit.prevent="guardarAsesor">
              
              <h6 class="fw-bold mb-3 text-muted border-bottom pb-2">Datos Personales</h6>

              <!-- SECCIÓN DE FOTO -->
              <div class="text-center mb-4">
                <div class="position-relative d-inline-block">
                  <img :src="fotoPreview?.startsWith('blob:') ? fotoPreview : (getFullUrl(fotoPreview) || `https://ui-avatars.com/api/?name=${asesorForm.nombre_completo || 'Asesor'}&background=0B2545&color=fff&size=100`)" 
                       class="rounded-circle shadow-sm border object-fit-cover" 
                       width="100" height="100" alt="Vista previa">
                  <label for="inputFoto" class="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center cursor-pointer shadow" 
                         style="width: 32px; height: 32px; border: 2px solid white;">
                    <i class="bi bi-camera-fill small"></i>
                  </label>
                </div>
                <input type="file" id="inputFoto" class="d-none" accept="image/*" @change="handleFotoChange">
                <p class="text-muted smaller mt-2 mb-0">Foto del Asesor (JPG, PNG)</p>
              </div>

              <div class="row mb-3">
                <div class="col-md-12 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">Nombre Completo *</label>
                  <input type="text" class="form-control shadow-none bg-light border-0" :class="{ 'is-invalid border-danger': erroresValidacion.nombre_completo }" v-model="asesorForm.nombre_completo" required>
                  <div class="invalid-feedback">{{ erroresValidacion.nombre_completo?.[0] }}</div>
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">% Comisión</label>
                  <div class="input-group">
                    <input type="number" step="0.01" min="0" max="100" class="form-control shadow-none bg-light border-0" v-model="asesorForm.porcentaje_comision">
                    <span class="input-group-text bg-light border-0 text-muted">%</span>
                  </div>
                  <div class="text-muted" style="font-size:.72rem">Se aplica sobre el monto total de cada venta.</div>
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">Teléfono / Celular</label>
                  <input type="text" class="form-control shadow-none bg-light border-0" v-model="asesorForm.telefono">
                </div>
                <div class="col-md-4 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">Dirección (Opcional)</label>
                  <input type="text" class="form-control shadow-none bg-light border-0" v-model="asesorForm.direccion">
                </div>
              </div>

              <h6 class="fw-bold mb-3 text-muted border-bottom pb-2 mt-4">Credenciales de Acceso</h6>
              <div class="row mb-3">
                <div class="col-md-6 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">Correo Electrónico *</label>
                  <input type="email" class="form-control shadow-none bg-light border-0" :class="{ 'is-invalid border-danger': erroresValidacion.correo }" v-model="asesorForm.correo" required>
                  <div class="invalid-feedback">{{ erroresValidacion.correo?.[0] }}</div>
                </div>
                
                <div class="col-md-6 mb-3">
                  <label class="form-label text-muted fw-medium fs-6">
                    Contraseña <span v-if="isEditing" class="text-secondary fw-normal">(Opcional)</span> *
                  </label>
                  <div class="input-group has-validation">
                    <input :type="mostrarPassword ? 'text' : 'password'" 
                           class="form-control shadow-none bg-light border-0 no-validation-icon" 
                           :class="{ 'is-invalid border-danger': erroresValidacion.password }"
                           v-model="asesorForm.password" 
                           :required="!isEditing">
                    <button type="button" class="btn btn-light bg-light border-0" :class="{ 'border-danger border-top border-bottom border-end': erroresValidacion.password }" @click="mostrarPassword = !mostrarPassword" style="z-index: 5;">
                      <i class="bi fs-5" :class="mostrarPassword ? 'bi-eye-slash-fill text-primary' : 'bi-eye-fill text-muted'"></i>
                    </button>
                    <div v-if="erroresValidacion.password" class="invalid-feedback fw-medium mt-1">
                      <div v-for="(err, index) in erroresValidacion.password" :key="index">{{ err }}</div>
                    </div>
                  </div>
                  
                  <div v-if="!isEditing || asesorForm.password.length > 0" class="mt-2 p-2 rounded bg-light bg-opacity-50">
                    <ul class="list-unstyled mb-0" style="font-size: 0.75rem;">
                      <li :class="validacionPassword.longitud ? 'text-success fw-bold' : 'text-muted'" class="transition-colors"><i class="bi" :class="validacionPassword.longitud ? 'bi-check-circle-fill' : 'bi-circle'"></i> Mínimo 8 caracteres</li>
                      <li :class="validacionPassword.mayusculas && validacionPassword.minusculas ? 'text-success fw-bold' : 'text-muted'" class="transition-colors"><i class="bi" :class="validacionPassword.mayusculas && validacionPassword.minusculas ? 'bi-check-circle-fill' : 'bi-circle'"></i> Mayúscula y minúscula</li>
                      <li :class="validacionPassword.numeros ? 'text-success fw-bold' : 'text-muted'" class="transition-colors"><i class="bi" :class="validacionPassword.numeros ? 'bi-check-circle-fill' : 'bi-circle'"></i> Un número</li>
                      <li :class="validacionPassword.simbolos ? 'text-success fw-bold' : 'text-muted'" class="transition-colors"><i class="bi" :class="validacionPassword.simbolos ? 'bi-check-circle-fill' : 'bi-circle'"></i> Un símbolo (!@#$%)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div v-if="isEditing" class="mb-4 form-check form-switch d-flex align-items-center">
                <input class="form-check-input shadow-none fs-5 me-2 custom-switch" type="checkbox" v-model="asesorForm.estado">
                <label class="form-check-label text-muted fw-medium mt-1">{{ asesorForm.estado ? 'Cuenta Activa' : 'Cuenta Suspendida' }}</label>
              </div>

              <div class="d-flex justify-content-end gap-2 pt-3 border-top mt-4">
                <button type="button" class="btn btn-light shadow-none px-4" data-bs-dismiss="modal" :disabled="guardando">Cancelar</button>
                <button type="submit" class="btn btn-primary border-0 shadow-sm px-4" style="background-color: var(--primary-color);" :disabled="guardando">
                  <span v-if="guardando" class="spinner-border spinner-border-sm me-2"></span>{{ guardando ? 'Guardando...' : (isEditing ? 'Actualizar Perfil' : 'Crear Asesor') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="modalVerAsesor" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card-custom border-0">
          <div class="modal-header bg-light border-bottom-0 pb-3 p-4">
            <h5 class="modal-title fw-bold"><i class="bi bi-person-vcard text-primary me-2"></i> Perfil de Asesor</h5>
            <button type="button" class="btn-close shadow-none" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body p-4" v-if="asesorSeleccionado">
            <div class="text-center mb-4">
              <img v-if="asesorSeleccionado.foto" :src="asesorSeleccionado.foto?.startsWith('blob:') ? asesorSeleccionado.foto : getFullUrl(asesorSeleccionado.foto)" class="rounded-circle mb-3 shadow-sm object-fit-cover" width="100" height="100" alt="Foto">
              <img v-else :src="`https://ui-avatars.com/api/?name=${asesorSeleccionado.nombre_completo}&background=0B2545&color=fff&size=100`" class="rounded-circle mb-3 shadow-sm" alt="Avatar">
              <h5 class="fw-bold mb-1">{{ asesorSeleccionado.nombre_completo }}</h5>
              <div class="text-muted small mb-2">Asesor de Ventas</div>
              <span v-if="asesorSeleccionado.estado == 1" class="badge bg-success rounded-pill">Cuenta Activa</span>
              <span v-else class="badge bg-danger rounded-pill">Cuenta Suspendida</span>
            </div>
            <div class="card bg-light border-0 shadow-none mb-3">
              <div class="card-body">
                <div class="row mb-3 border-bottom pb-2"><div class="col-4 text-muted small fw-bold">ID Sistema</div><div class="col-8 fw-medium">Usuario #{{ asesorSeleccionado.user_id }}</div></div>
                <div class="row mb-3 border-bottom pb-2"><div class="col-4 text-muted small fw-bold">Correo</div><div class="col-8 text-primary">{{ asesorSeleccionado.correo }}</div></div>
                <div class="row mb-3 border-bottom pb-2"><div class="col-4 text-muted small fw-bold">Teléfono</div><div class="col-8">{{ asesorSeleccionado.telefono || 'No registrado' }}</div></div>
                <div class="row mb-3 border-bottom pb-2"><div class="col-4 text-muted small fw-bold">% Comisión</div><div class="col-8 fw-bold text-primary">{{ asesorSeleccionado.porcentaje_comision ?? 3.00 }}%</div></div>
                <div class="row"><div class="col-4 text-muted small fw-bold">Dirección</div><div class="col-8">{{ asesorSeleccionado.direccion || 'No registrada' }}</div></div>
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
.card-custom { background-color: var(--bg-card); border-radius: 12px; }
.smaller { font-size: 0.75rem; }
.btn-white { background-color: #fff; }
.cursor-pointer { cursor: pointer; }
.hover-danger:hover { color: #dc3545 !important; }
.transition-all { transition: all 0.2s ease-in-out; }
.transition-colors { transition: color 0.3s ease; }

.page-item.active .custom-page-btn { background-color: var(--primary-color) !important; border-color: var(--primary-color) !important; color: white !important; }
.custom-page-btn { color: var(--text-main); font-weight: 500; }
.custom-switch:checked { background-color: var(--primary-color) !important; border-color: var(--primary-color) !important; }

.form-control:focus, .form-select:focus { background-color: var(--bg-card) !important; border: 1px solid var(--primary-color) !important; box-shadow: 0 0 0 0.25rem rgba(162, 139, 250, 0.25) !important; }
.custom-action-btn { background-color: transparent; border: 1px solid transparent; transition: all 0.2s; }
.custom-action-btn:hover { background-color: var(--border-color); }
.no-validation-icon { background-image: none !important; }
.table-asesores .badge{ min-width:110px;}
</style>
