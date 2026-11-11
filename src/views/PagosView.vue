<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'

// ── Catálogos ──
const metodosPago       = ref([])
const cuentasBancarias  = ref([])

// ── Tab activo ──
const tabActivo = ref('pendientes')

// ── Tab Pendientes ──
const pagosPendientes      = ref([])
const cargandoPendientes   = ref(false)
const filtrosPend          = ref({ fecha_inicio: '', fecha_fin: '', search: '' })
const paginaPend           = ref(1)
const totalPaginasPend     = ref(1)
const totalPend            = ref(0)
let   searchPendTimeout    = null

// ── Tab Pagados ──
const pagosPagados         = ref([])
const cargandoPagados      = ref(false)
const filtrosPag           = ref({ fecha_inicio: '', fecha_fin: '', search: '' })
const paginaPag            = ref(1)
const totalPaginasPag      = ref(1)
const totalPag             = ref(0)
let   searchPagTimeout     = null

// ── Modal Procesar Pago ──
const mostrarModalPago  = ref(false)
const pagoProcesando    = ref(null)
const procesando        = ref(false)
const formPago          = ref({
  metodo_pago_id: '',
  cuenta_id:      '',
  fecha_pago:     new Date().toISOString().slice(0, 10),
  observaciones:  ''
})

// ── Descarga comprobante ──
const descargandoId = ref(null)

// ==========================================
onMounted(async () => {
  const [resM, resC] = await Promise.all([
    api.get('/metodos-pago?per_page=100'),
    api.get('/cuentas-bancarias?per_page=100')
  ])
  metodosPago.value      = (resM.data.data ?? resM.data).filter(m => m.nombre_metodo !== 'Pasarela de Pago')
  cuentasBancarias.value = resC.data.data ?? resC.data
  cargarPendientes()
})

watch(tabActivo, (tab) => {
  if (tab === 'pagados' && pagosPagados.value.length === 0) cargarPagados()
})

// ==========================================
// CARGAR DATOS
// ==========================================
const cargarPendientes = async (page = 1) => {
  try {
    cargandoPendientes.value = true
    paginaPend.value = page
    const params = new URLSearchParams({ page, per_page: 10 })
    if (filtrosPend.value.fecha_inicio) params.append('fecha_inicio', filtrosPend.value.fecha_inicio)
    if (filtrosPend.value.fecha_fin)    params.append('fecha_fin',    filtrosPend.value.fecha_fin)
    if (filtrosPend.value.search)       params.append('search',       filtrosPend.value.search)
    const res = await api.get(`/pagos/pendientes/listar?${params}`)
    pagosPendientes.value   = res.data.data
    totalPaginasPend.value  = res.data.last_page
    totalPend.value         = res.data.total
  } catch {
    Swal.fire('Error', 'No se pudieron cargar los pagos pendientes', 'error')
  } finally {
    cargandoPendientes.value = false
  }
}

const cargarPagados = async (page = 1) => {
  try {
    cargandoPagados.value = true
    paginaPag.value = page
    const params = new URLSearchParams({ page, per_page: 10, estado: 'PAGADO' })
    if (filtrosPag.value.fecha_inicio) params.append('fecha_inicio', filtrosPag.value.fecha_inicio)
    if (filtrosPag.value.fecha_fin)    params.append('fecha_fin',    filtrosPag.value.fecha_fin)
    if (filtrosPag.value.search)       params.append('search',       filtrosPag.value.search)
    const res = await api.get(`/pagos?${params}`)
    pagosPagados.value      = res.data.data
    totalPaginasPag.value   = res.data.last_page
    totalPag.value          = res.data.total
  } catch {
    Swal.fire('Error', 'No se pudieron cargar los pagos', 'error')
  } finally {
    cargandoPagados.value = false
  }
}

const onSearchPend = () => {
  clearTimeout(searchPendTimeout)
  searchPendTimeout = setTimeout(() => cargarPendientes(1), 350)
}

const onSearchPag = () => {
  clearTimeout(searchPagTimeout)
  searchPagTimeout = setTimeout(() => cargarPagados(1), 350)
}

// ==========================================
// MODAL PROCESAR
// ==========================================
const abrirModalPago = (pago) => {
  pagoProcesando.value = { ...pago }
  formPago.value = {
    metodo_pago_id: pago.metodo_pago_id || metodoEfectivo()?.id || '',
    cuenta_id:      '',
    fecha_pago:     new Date().toISOString().slice(0, 10),
    observaciones:  pago.observaciones || ''
  }
  if (formPago.value.metodo_pago_id) onMetodoChange()
  mostrarModalPago.value = true
}

const cerrarModalPago = () => { mostrarModalPago.value = false }

const onMetodoChange = async () => {
  if (!formPago.value.metodo_pago_id) { formPago.value.cuenta_id = ''; return }
  try {
    const res = await api.get(`/mapeo-metodos-cuentas/obtener-cuenta/${formPago.value.metodo_pago_id}`)
    const sale = pagoProcesando.value?.nota_venta
    const currency = sale?.moneda || sale?.propiedad?.moneda
    const account = res.data
    formPago.value.cuenta_id = account?.id && (!account.moneda || !currency || account.moneda === currency) ? account.id : ''
  } catch {
    formPago.value.cuenta_id = ''
  }
}

const procesarPago = async () => {
  if (!formPago.value.metodo_pago_id || !formPago.value.fecha_pago) {
    return Swal.fire('Validación', 'Completa todos los campos requeridos', 'warning')
  }
  if (!formPago.value.cuenta_id) {
    return Swal.fire('Atención', 'No se pudo determinar la cuenta destino. Verifica el mapeo de método de pago.', 'warning')
  }
  try {
    procesando.value = true
    await api.post(`/pagos/${pagoProcesando.value.id}/procesar`, formPago.value)
    Swal.fire('Éxito', 'Pago procesado correctamente', 'success')
    cargarPendientes(paginaPend.value)
    cerrarModalPago()
  } catch (e) {
    Swal.fire('Error', e.response?.data?.message || 'No se pudo procesar el pago', 'error')
  } finally {
    procesando.value = false
  }
}

// ==========================================
// ANULAR
// ==========================================
const anularPago = async (pago) => {
  const { isConfirmed } = await Swal.fire({
    title: '¿Anular pago?',
    html: `Se anulará el pago de <strong>Bs. ${formatoMoneda(pago.monto)}</strong> de <strong>${pago.nota_venta?.cliente?.nombre_completo ?? ''}</strong>.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, anular',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#e74c3c'
  })
  if (!isConfirmed) return
  try {
    await api.put(`/pagos/${pago.id}/cancelar`)
    Swal.fire('Anulado', 'El pago ha sido anulado correctamente.', 'success')
    cargarPagados(paginaPag.value)
  } catch (e) {
    Swal.fire('Error', e.response?.data?.message || 'No se pudo anular el pago', 'error')
  }
}

// ==========================================
// COMPROBANTE
// ==========================================
const descargarComprobante = async (pago) => {
  try {
    descargandoId.value = pago.id
    const res = await api.get(`/pagos/${pago.id}/comprobante`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const a   = document.createElement('a')
    a.href    = url
    a.download = `comprobante-pago-${String(pago.id).padStart(5, '0')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    Swal.fire('Error', 'No se pudo generar el comprobante', 'error')
  } finally {
    descargandoId.value = null
  }
}

// ==========================================
// HELPERS
// ==========================================
const metodoEfectivo = () => metodosPago.value.find(method =>
  method.estado !== 'Inactivo' && method.nombre_metodo?.toLowerCase().includes('efectivo'))
const esEfectivo = (pago) => !pago.id_transaccion_libelula &&
  (pago.metodo_pago_id ? pago.metodo_pago?.nombre_metodo?.toLowerCase().includes('efectivo') : !!metodoEfectivo())

const formatoMoneda = (v) =>
  parseFloat(v || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })

const formatoFecha = (f) => f ? new Date(f).toLocaleDateString('es-BO') : '-'

const conceptoBadge = (concepto) => {
  const map = {
    VENTA_CONTADO: 'bg-info bg-opacity-10 border border-info text-info',
    CUOTA_INICIAL: 'bg-warning bg-opacity-10 border border-warning text-warning',
    CUOTA:         'bg-secondary bg-opacity-10 border border-secondary text-secondary',
  }
  return map[concepto] ?? 'bg-dark bg-opacity-10 border border-dark text-dark'
}

const conceptoLabel = (c) => ({
  VENTA_CONTADO: 'Venta Contado',
  CUOTA_INICIAL: 'Cuota Inicial',
  CUOTA:         'Cuota',
  OTRO:          'Otro',
}[c] ?? c)

</script>

<template>
  <div class="container-fluid py-4 pb-5">

    <!-- Cabecera -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 class="h4 fw-bold mb-0" style="color:var(--text-main);">Gestión de Pagos</h2>
        <p class="text-muted small mb-0">Administra pagos pendientes y procesados</p>
      </div>
      <div class="d-flex gap-2">
        <span class="badge bg-danger fs-6">{{ totalPend }} Pendientes</span>
        <span class="badge bg-success fs-6">{{ totalPag }} Procesados</span>
      </div>
    </div>

    <!-- Tabs -->
    <ul class="nav nav-tabs mb-0" style="border-bottom: 2px solid #dee2e6;">
      <li class="nav-item">
        <button class="nav-link fw-semibold" :class="{ active: tabActivo === 'pendientes' }" @click="tabActivo = 'pendientes'">
          <i class="bi bi-clock-history me-2 text-danger"></i>Pendientes
          <span class="badge bg-danger ms-2 rounded-pill">{{ totalPend }}</span>
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link fw-semibold" :class="{ active: tabActivo === 'pagados' }" @click="tabActivo = 'pagados'">
          <i class="bi bi-check-circle me-2 text-success"></i>Procesados
          <span class="badge bg-success ms-2 rounded-pill">{{ totalPag }}</span>
        </button>
      </li>
    </ul>

    <!-- ─────────────────────────────────────────── -->
    <!-- TAB PENDIENTES -->
    <!-- ─────────────────────────────────────────── -->
    <div v-show="tabActivo === 'pendientes'" class="card border-0 shadow-sm rounded-bottom-3 rounded-top-0">

      <!-- Filtros -->
      <div class="card-header bg-white border-bottom py-3 px-4">
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label class="form-label small fw-bold text-muted mb-1">Desde</label>
            <input type="date" class="form-control form-control-sm" v-model="filtrosPend.fecha_inicio" @change="cargarPendientes(1)">
          </div>
          <div class="col-md-3">
            <label class="form-label small fw-bold text-muted mb-1">Hasta</label>
            <input type="date" class="form-control form-control-sm" v-model="filtrosPend.fecha_fin" @change="cargarPendientes(1)">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-bold text-muted mb-1">Buscar cliente (nombre o CI)</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-white"><i class="bi bi-search text-muted"></i></span>
              <input type="text" class="form-control border-start-0" placeholder="Buscar..." v-model="filtrosPend.search" @input="onSearchPend">
            </div>
          </div>
          <div class="col-md-2">
            <button class="btn btn-sm btn-outline-secondary w-100" @click="cargarPendientes(1)" :disabled="cargandoPendientes">
              <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="card-body p-0">
        <div v-if="cargandoPendientes" class="text-center py-5">
          <div class="spinner-border text-secondary" role="status"></div>
        </div>
        <div v-else-if="pagosPendientes.length === 0" class="text-center py-5 text-muted">
          <i class="bi bi-check-circle fs-2 d-block mb-2 text-success"></i>
          <p class="mb-0">¡Sin pagos pendientes!</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size:0.875rem;">
            <thead class="table-light">
              <tr>
                <th class="ps-4">Venta</th>
                <th>Cliente</th>
                <th>Concepto</th>
                <th>Método</th>
                <th class="text-end pe-3">Monto</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pago in pagosPendientes" :key="pago.id">
                <td class="ps-4">
                  <span class="fw-bold d-block">VTA-{{ String(pago.nota_venta_id || 0).padStart(5,'0') }}</span>
                  <span class="extra-small text-muted">{{ pago.created_at?.substr(0,10) ?? '-' }}</span>
                </td>
                <td>
                  <div class="fw-medium">{{ pago.nota_venta?.cliente?.nombre_completo ?? 'Sin cliente' }}</div>
                  <div class="extra-small text-muted">CI: {{ pago.nota_venta?.cliente?.ci ?? '-' }}</div>
                </td>
                <td>
                  <span class="badge rounded-pill" :class="conceptoBadge(pago.concepto_pago)">
                    {{ conceptoLabel(pago.concepto_pago) }}
                  </span>
                </td>
                <td>
                  <span v-if="pago.metodo_pago" class="badge bg-light border text-dark">
                    <i class="bi bi-credit-card me-1"></i>{{ pago.metodo_pago.nombre_metodo }}
                  </span>
                  <span v-else class="extra-small text-muted fst-italic">Sin definir</span>
                </td>
                <td class="text-end pe-3 fw-bold text-primary">Bs. {{ formatoMoneda(pago.monto) }}</td>
                <td class="text-center">
                  <button
                    v-if="esEfectivo(pago)"
                    class="btn btn-sm btn-success"
                    @click="abrirModalPago(pago)"
                    title="Procesar cobro en efectivo"
                  >
                    <i class="bi bi-cash-coin me-1"></i> Cobrar
                  </button>
                  <span v-else class="extra-small text-muted fst-italic">
                    <i class="bi bi-info-circle me-1"></i>Procesar desde pagos
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Paginación Pendientes -->
      <div v-if="totalPaginasPend > 1" class="card-footer bg-white border-top py-3">
        <nav>
          <ul class="pagination pagination-sm justify-content-center mb-0">
            <li class="page-item" :class="{ disabled: paginaPend === 1 }">
              <button class="page-link" @click="cargarPendientes(paginaPend - 1)">‹</button>
            </li>
            <li v-for="p in totalPaginasPend" :key="p" class="page-item" :class="{ active: paginaPend === p }">
              <button class="page-link" @click="cargarPendientes(p)">{{ p }}</button>
            </li>
            <li class="page-item" :class="{ disabled: paginaPend === totalPaginasPend }">
              <button class="page-link" @click="cargarPendientes(paginaPend + 1)">›</button>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <!-- ─────────────────────────────────────────── -->
    <!-- TAB PAGADOS -->
    <!-- ─────────────────────────────────────────── -->
    <div v-show="tabActivo === 'pagados'" class="card border-0 shadow-sm rounded-bottom-3 rounded-top-0">

      <!-- Filtros -->
      <div class="card-header bg-white border-bottom py-3 px-4">
        <div class="row g-2 align-items-end">
          <div class="col-md-3">
            <label class="form-label small fw-bold text-muted mb-1">Desde</label>
            <input type="date" class="form-control form-control-sm" v-model="filtrosPag.fecha_inicio" @change="cargarPagados(1)">
          </div>
          <div class="col-md-3">
            <label class="form-label small fw-bold text-muted mb-1">Hasta</label>
            <input type="date" class="form-control form-control-sm" v-model="filtrosPag.fecha_fin" @change="cargarPagados(1)">
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-bold text-muted mb-1">Buscar cliente (nombre o CI)</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-white"><i class="bi bi-search text-muted"></i></span>
              <input type="text" class="form-control border-start-0" placeholder="Buscar..." v-model="filtrosPag.search" @input="onSearchPag">
            </div>
          </div>
          <div class="col-md-2">
            <button class="btn btn-sm btn-outline-secondary w-100" @click="cargarPagados(1)" :disabled="cargandoPagados">
              <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="card-body p-0">
        <div v-if="cargandoPagados" class="text-center py-5">
          <div class="spinner-border text-secondary" role="status"></div>
        </div>
        <div v-else-if="pagosPagados.length === 0" class="text-center py-5 text-muted">
          <i class="bi bi-inbox fs-2 d-block mb-2"></i>
          <p class="mb-0">No se encontraron pagos.</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table table-hover align-middle mb-0" style="font-size:0.875rem;">
            <thead class="table-light">
              <tr>
                <th class="ps-4">Venta</th>
                <th>Cliente</th>
                <th>Concepto</th>
                <th>Método</th>
                <th>Fecha Pago</th>
                <th class="text-end pe-3">Monto</th>
                <th class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pago in pagosPagados" :key="pago.id">
                <td class="ps-4">
                  <span class="fw-bold d-block">VTA-{{ String(pago.nota_venta_id || 0).padStart(5,'0') }}</span>
                  <span class="extra-small text-muted">ID: {{ pago.id }}</span>
                </td>
                <td>
                  <div class="fw-medium">{{ pago.nota_venta?.cliente?.nombre_completo ?? 'Sin cliente' }}</div>
                  <div class="extra-small text-muted">CI: {{ pago.nota_venta?.cliente?.ci ?? '-' }}</div>
                </td>
                <td>
                  <span class="badge rounded-pill" :class="conceptoBadge(pago.concepto_pago)">
                    {{ conceptoLabel(pago.concepto_pago) }}
                  </span>
                </td>
                <td>
                  <span v-if="pago.metodo_pago" class="badge bg-light border text-dark">
                    <i class="bi bi-credit-card me-1"></i>{{ pago.metodo_pago.nombre_metodo }}
                  </span>
                  <span v-else class="extra-small text-muted fst-italic">-</span>
                </td>
                <td class="text-muted">{{ formatoFecha(pago.fecha_pago) }}</td>
                <td class="text-end pe-3 fw-bold text-success">Bs. {{ formatoMoneda(pago.monto) }}</td>
                <td class="text-center">
                  <div class="d-flex gap-1 justify-content-center">
                    <button
                      class="btn btn-sm btn-outline-danger"
                      @click="anularPago(pago)"
                      title="Anular pago"
                    >
                      <i class="bi bi-x-circle"></i>
                    </button>
                    <button
                      class="btn btn-sm btn-outline-primary"
                      @click="descargarComprobante(pago)"
                      :disabled="descargandoId === pago.id"
                      title="Descargar comprobante"
                    >
                      <span v-if="descargandoId === pago.id" class="spinner-border spinner-border-sm"></span>
                      <i v-else class="bi bi-file-earmark-pdf"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Paginación Pagados -->
      <div v-if="totalPaginasPag > 1" class="card-footer bg-white border-top py-3">
        <nav>
          <ul class="pagination pagination-sm justify-content-center mb-0">
            <li class="page-item" :class="{ disabled: paginaPag === 1 }">
              <button class="page-link" @click="cargarPagados(paginaPag - 1)">‹</button>
            </li>
            <li v-for="p in totalPaginasPag" :key="p" class="page-item" :class="{ active: paginaPag === p }">
              <button class="page-link" @click="cargarPagados(p)">{{ p }}</button>
            </li>
            <li class="page-item" :class="{ disabled: paginaPag === totalPaginasPag }">
              <button class="page-link" @click="cargarPagados(paginaPag + 1)">›</button>
            </li>
          </ul>
        </nav>
      </div>
    </div>

  </div>

  <!-- ─────────────────────────────────────────── -->
  <!-- MODAL PROCESAR PAGO -->
  <!-- ─────────────────────────────────────────── -->
  <div v-if="mostrarModalPago" class="modal-overlay" @click.self="cerrarModalPago">
    <div class="modal-dialog modal-dialog-centered modal-lg" style="margin:auto;">
      <div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden" v-if="pagoProcesando">
        <div class="modal-header border-bottom py-3 px-4">
          <h5 class="modal-title fw-bold">
            <i class="bi bi-cash-stack me-2 text-success"></i>Procesar Cobro
          </h5>
          <button type="button" class="btn-close shadow-none" @click="cerrarModalPago" :disabled="procesando"></button>
        </div>

        <div class="modal-body p-4">
          <!-- Resumen de Pago Mejorado -->
          <div class="payment-summary-card mb-4 p-3 rounded-4 border">
            <div class="row g-3 align-items-center">
              <div class="col-md-4">
                <div class="summary-label">Nota de Venta</div>
                <div class="summary-value text-technical">VTA-{{ String(pagoProcesando.nota_venta_id||0).padStart(5,'0') }}</div>
              </div>
              <div class="col-md-4">
                <div class="summary-label">Cliente Pagador</div>
                <div class="summary-value text-truncate" :title="pagoProcesando.nota_venta?.cliente?.nombre_completo">
                  {{ pagoProcesando.nota_venta?.cliente?.nombre_completo ?? 'N/A' }}
                </div>
              </div>
              <div class="col-md-4 text-md-end">
                <div class="summary-label">Monto a Cobrar</div>
                <div class="summary-value text-success h4 mb-0 fw-bold">
                  <span class="small me-1">Bs.</span>{{ formatoMoneda(pagoProcesando.monto) }}
                </div>
              </div>
            </div>
          </div>

          <form @submit.prevent="procesarPago">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label fw-bold small text-muted text-uppercase mb-2">Método de Pago</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-light border-0"><i class="bi bi-cash-coin text-success"></i></span>
                  <input
                    type="text"
                    class="form-control border-0 bg-light fw-semibold text-success"
                    :value="pagoProcesando?.metodo_pago?.nombre_metodo ?? 'Efectivo'"
                    disabled
                  >
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-bold small text-muted text-uppercase mb-2">Cuenta Destino</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-light border-0"><i class="bi bi-bank text-primary"></i></span>
                  <input
                    type="text"
                    class="form-control border-0 bg-light fw-semibold text-primary"
                    :value="cuentasBancarias.find(c => c.id === formPago.cuenta_id)?.nombre ?? 'Sin cuenta compatible'"
                    disabled
                  >
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label fw-bold small text-muted text-uppercase mb-2">Fecha de Pago <span class="text-danger">*</span></label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-light border-0"><i class="bi bi-calendar-event"></i></span>
                  <input v-model="formPago.fecha_pago" type="date" class="form-control border-0 bg-light" :disabled="procesando" required>
                </div>
              </div>
              <div class="col-md-12">
                <label class="form-label fw-bold small text-muted text-uppercase mb-2">Observaciones Internas</label>
                <textarea v-model="formPago.observaciones" class="form-control border-0 bg-light" rows="3" 
                  placeholder="Añade notas adicionales sobre este cobro..." :disabled="procesando"></textarea>
              </div>
            </div>

            <div class="d-flex justify-content-end gap-3 mt-5">
              <button type="button" class="btn btn-light px-4 rounded-3 border-0" @click="cerrarModalPago" :disabled="procesando">
                Cancelar
              </button>
              <button type="submit" class="btn btn-success px-4 rounded-3 shadow-sm d-flex align-items-center" :disabled="procesando">
                <span v-if="procesando" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-check-circle-fill me-2"></i>
                {{ procesando ? 'Registrando...' : 'Confirmar Cobro' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.extra-small { font-size: 0.75rem; }

.modal-overlay {
  position: fixed; inset: 0; z-index: 1050;
  background: rgba(11, 37, 69, 0.4); /* Navy overlay con transparencia */
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
}

.modal-content {
  background-color: var(--bg-card);
  color: var(--text-main);
}

.payment-summary-card {
  background-color: var(--bg-body);
  border-color: var(--border-color) !important;
}

.summary-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}

.summary-value {
  color: var(--text-main);
  font-weight: 600;
  font-size: 1.1rem;
}

.nav-tabs .nav-link {
  color: var(--text-muted);
  border: none;
  border-bottom: 3px solid transparent;
  padding: 0.75rem 1.5rem;
  transition: all .2s;
  font-weight: 600;
}

.nav-tabs .nav-link.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  background: transparent;
}

[data-theme="dark"] .nav-tabs .nav-link.active {
  color: var(--info-color);
  border-bottom-color: var(--info-color);
}

.nav-tabs .nav-link:hover:not(.active) {
  color: var(--text-main);
  border-bottom-color: var(--border-color);
}

.card.rounded-top-0 { border-top-left-radius: 0 !important; border-top-right-radius: 0 !important; }

/* Custom Scrollbar for better UX */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background-color: var(--border-color); border-radius: 10px; }
</style>
