<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'

// Estados
const planesPagos = ref([])
const metodosPago = ref([])
const cuentasBancarias = ref([])
const cargando = ref(true)
const procesando = ref(false)

// Paginacion Planes
const currentPage = ref(1)
const totalPages = ref(1)
const perPage = ref(10)
const totalItems = ref(0)

// Seccion de Cuotas (Alternancia de Vista)
const planSeleccionado = ref(null)
const cuotasPlan = ref([])
const cargandoCuotas = ref(false)
const seleccionSet = ref(new Set()) // Uso de Set para busquedas O(1)
const tasaMoraPlan = ref(0) // % mensual del plan seleccionado

// Formulario de Pago (Modal Mejorado)
const mostrarModalPago = ref(false)
const formPago = ref({
  metodo_pago_id: '',
  cuenta_id: '',
  fecha_pago: new Date().toISOString().substr(0, 10),
  observaciones: ''
})

// Reprogramación
const mostrarModalReprog = ref(false)
const procesandoReprog = ref(false)
const planPagoId = ref(null)
const saldoCapitalActual = ref(0)
const formReprog = ref({
  motivo: '',
  fecha_reprogramacion: new Date().toISOString().substr(0, 10),
  cuota_desde: 1,
  nueva_tasa_interes: 0,
  nuevo_numero_cuotas: 12,
  nueva_fecha_inicio: new Date().toISOString().substr(0, 10),
  observaciones: ''
})

// ==========================================
// 1. CARGAR DATOS
// ==========================================
const cargarPlanes = async (page = 1) => {
  try {
    cargando.value = true
    currentPage.value = page

    if (metodosPago.value.length === 0) {
      const [resMetodos, resCuentas] = await Promise.all([
        api.get('/metodos-pago?per_page=100'),
        api.get('/cuentas-bancarias?per_page=100')
      ])
      metodosPago.value = (resMetodos.data.data || resMetodos.data || []).filter(m => m.nombre_metodo !== 'Pasarela de Pago')
      cuentasBancarias.value = resCuentas.data.data || resCuentas.data || []
    }

    const res = await api.get(`/ventas?tipo_venta=CREDITO&page=${page}&per_page=${perPage.value}`)
    planesPagos.value = res.data.data || []
    totalPages.value = res.data.last_page || 1
    totalItems.value = res.data.total || 0
  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    console.error('Error al cargar planes:', error)
    Swal.fire('Error', 'No se pudieron cargar los planes de pago', 'error')
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  cargarPlanes()
})

// ==========================================
// 2. GESTION DE VISTAS Y SELECCION
// ==========================================
const seleccionarPlan = async (plan) => {
  planSeleccionado.value = plan
  cargandoCuotas.value = true
  seleccionSet.value = new Set() // Resetear seleccion
  
  try {
    const res = await api.get(`/ventas/${plan.id}/plan-pago`)
    cuotasPlan.value = res.data.plan_pago?.cuotas?.filter(c => c.estado !== 'Reprogramada') || []
    planPagoId.value = res.data.plan_pago?.id || null
    // Saldo capital viene calculado correctamente desde el backend (suma de monto_capital pendiente)
    saldoCapitalActual.value = res.data.resumen?.saldo_capital ?? 0
    tasaMoraPlan.value = parseFloat(res.data.plan_pago?.tasa_mora ?? 0)
  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    console.error('Error al cargar cuotas:', error)
    Swal.fire('Error', 'No se pudieron cargar las cuotas del plan', 'error')
    planSeleccionado.value = null
  } finally {
    cargandoCuotas.value = false
  }
}

const volverAlListado = () => {
  planSeleccionado.value = null
  cuotasPlan.value = []
  seleccionSet.value = new Set()
  tasaMoraPlan.value = 0
}

const toggleCuota = (cuota) => {
  if (cuota.estado === 'Pagada') return

  const nuevasSeleccion = new Set(seleccionSet.value)

  if (nuevasSeleccion.has(cuota.id)) {
    // Deseleccionar esta y todas las superiores por coherencia contable
    cuotasPlan.value.forEach(c => {
      if (c.numero_cuota >= cuota.numero_cuota) {
        nuevasSeleccion.delete(c.id)
      }
    })
  } else {
    // Validar que la anterior este pagada o seleccionada
    const cuotasPendientes = cuotasPlan.value.filter(c => c.estado === 'Pendiente')
    const cuotaAnterior = cuotasPendientes.find(c => c.numero_cuota < cuota.numero_cuota && !nuevasSeleccion.has(c.id))
    
    if (cuotaAnterior) {
      Swal.fire({
        title: 'Orden de cobro',
        text: `Debes seleccionar la cuota ${cuotaAnterior.numero_cuota} primero.`,
        icon: 'warning',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false
      })
      return
    }
    nuevasSeleccion.add(cuota.id)
  }
  
  seleccionSet.value = nuevasSeleccion // Re-asignar para disparar reactividad
}

// Computados optimos
const cuotasSeleccionadas = computed(() => {
  return cuotasPlan.value.filter(c => seleccionSet.value.has(c.id))
})

const totalAPagar = computed(() => {
  return cuotasSeleccionadas.value.reduce((sum, c) => sum + parseFloat(c.monto_pendiente ?? c.monto_cuota), 0)
})

const numSeleccionados = computed(() => seleccionSet.value.size)

// ==========================================
// MORA
// ==========================================
const cobrarMora = ref(true)

const calcularMoraCuota = (cuota, fechaPago) => {
  if (!tasaMoraPlan.value || tasaMoraPlan.value <= 0) return 0
  const fechaVenc = new Date(cuota.fecha_vencimiento)
  const fechaRef  = new Date(fechaPago)
  fechaVenc.setHours(0, 0, 0, 0)
  fechaRef.setHours(0, 0, 0, 0)
  if (fechaRef <= fechaVenc) return 0
  const diasAtraso = Math.floor((fechaRef - fechaVenc) / (1000 * 60 * 60 * 24))
  const tasaDiaria = tasaMoraPlan.value / 100 / 30
  return Math.round(parseFloat(cuota.monto_cuota) * tasaDiaria * diasAtraso * 100) / 100
}

const moraResumen = computed(() => {
  const fecha = formPago.value.fecha_pago || new Date().toISOString().slice(0, 10)
  const cuotasVencidas = cuotasSeleccionadas.value.filter(c => c.estado === 'Vencida')
  const detalle = cuotasVencidas.map(c => ({
    cuota: c,
    diasAtraso: (() => {
      const fv = new Date(c.fecha_vencimiento); fv.setHours(0,0,0,0)
      const fp = new Date(fecha); fp.setHours(0,0,0,0)
      return fp > fv ? Math.floor((fp - fv) / 86400000) : 0
    })(),
    monto: calcularMoraCuota(c, fecha)
  })).filter(d => d.monto > 0)
  const total = detalle.reduce((s, d) => s + d.monto, 0)
  return { detalle, total: Math.round(total * 100) / 100 }
})

const totalConMora = computed(() => {
  if (!cobrarMora.value) return totalAPagar.value
  return Math.round((totalAPagar.value + moraResumen.value.total) * 100) / 100
})

// ==========================================
// 3. PROCESAR PAGO
// ==========================================
const abrirModalPago = () => {
  if (numSeleccionados.value === 0) return
  cobrarMora.value = true
  formPago.value = {
    metodo_pago_id: '',
    cuenta_id: '',
    fecha_pago: new Date().toISOString().slice(0, 10),
    observaciones: `Cobro cuotas: ${cuotasSeleccionadas.value.map(c => c.numero_cuota).join(', ')}`
  }
  mostrarModalPago.value = true
}

const onMetodoChange = async () => {
  if (!formPago.value.metodo_pago_id) {
    formPago.value.cuenta_id = ''
    return
  }
  try {
    const res = await api.get(`/mapeo-metodos-cuentas/obtener-cuenta/${formPago.value.metodo_pago_id}`)
    formPago.value.cuenta_id = res.data?.id || ''
  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    formPago.value.cuenta_id = ''
  }
}

const confirmarPago = async () => {
  if (!formPago.value.metodo_pago_id || !formPago.value.cuenta_id) {
    Swal.fire('Atencion', 'Campos requeridos incompletos', 'warning')
    return
  }

  try {
    procesando.value = true
    const moraDetalle = cobrarMora.value ? moraResumen.value.detalle : []
    const moraByIdCuota = Object.fromEntries(moraDetalle.map(d => [d.cuota.id, d.monto]))

    const payload = {
      nota_venta_id: planSeleccionado.value.id,
      metodo_pago_id: formPago.value.metodo_pago_id,
      cuenta_id: formPago.value.cuenta_id,
      fecha_pago: formPago.value.fecha_pago,
      observaciones: formPago.value.observaciones,
      cuotas: cuotasSeleccionadas.value.map(c => ({
        id: c.id,
        monto: c.monto_pendiente ?? c.monto_cuota,
        mora_monto: moraByIdCuota[c.id] ?? 0
      }))
    }

    await api.post('/pagos/bulk', payload)

    await Swal.fire({
      title: '¡Exito!',
      text: 'Cobro registrado correctamente.',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    })

    mostrarModalPago.value = false
    seleccionarPlan(planSeleccionado.value)
    cargarPlanes(currentPage.value)
  } catch (error) {
    if (error?.operationPending) { Swal.fire('Operación en proceso', error.message, 'info'); return }
    Swal.fire('Error', 'No se pudo procesar el pago', 'error')
  } finally {
    procesando.value = false
  }
}

// ==========================================
// 4. REPROGRAMACIÓN
// ==========================================
const abrirModalReprog = () => {
  const primerPendiente = cuotasPlan.value.find(c => c.estado === 'Pendiente' || c.estado === 'Vencida')
  formReprog.value = {
    motivo: '',
    fecha_reprogramacion: new Date().toISOString().substr(0, 10),
    cuota_desde: primerPendiente?.numero_cuota ?? 1,
    nueva_tasa_interes: planSeleccionado.value.plan_pago?.tasa_interes ?? 0,
    nuevo_numero_cuotas: 12,
    nueva_fecha_inicio: primerPendiente?.fecha_vencimiento?.substr(0, 10) ?? new Date().toISOString().substr(0, 10),
    observaciones: ''
  }
  mostrarModalReprog.value = true
}

const ejecutarReprogramacion = async () => {
  if (!formReprog.value.motivo.trim()) {
    Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'El motivo es obligatorio.', showConfirmButton: false, timer: 2500 })
    return
  }
  try {
    procesandoReprog.value = true
    await api.post(`/planes-pago/${planPagoId.value}/reprogramar`, formReprog.value)
    mostrarModalReprog.value = false
    await seleccionarPlan(planSeleccionado.value)
    Swal.fire({ icon: 'success', title: 'Reprogramación aplicada', timer: 2000, showConfirmButton: false })
  } catch (err) {
    if (err?.operationPending) { Swal.fire('Operación en proceso', err.message, 'info'); return }
    Swal.fire('Error', err.response?.data?.message || 'No se pudo reprogramar.', 'error')
  } finally {
    procesandoReprog.value = false
  }
}

// ==========================================
// AMORTIZACIÓN EXTRAORDINARIA
// ==========================================
const mostrarModalAmort = ref(false)
const procesandoAmort = ref(false)
const formAmort = ref({
  monto: '',
  metodo_pago_id: '',
  cuenta_id: '',
  fecha_pago: new Date().toISOString().substr(0, 10),
  observaciones: ''
})

const abrirModalAmort = () => {
  formAmort.value = {
    monto: '',
    metodo_pago_id: '',
    cuenta_id: '',
    fecha_pago: new Date().toISOString().substr(0, 10),
    observaciones: ''
  }
  mostrarModalAmort.value = true
}

const onMetodoAmortChange = async () => {
  if (!formAmort.value.metodo_pago_id) { formAmort.value.cuenta_id = ''; return }
  try {
    const res = await api.get(`/mapeo-metodos-cuentas/obtener-cuenta/${formAmort.value.metodo_pago_id}`)
    formAmort.value.cuenta_id = res.data?.id || ''
  } catch { formAmort.value.cuenta_id = '' }
}

const ejecutarAmortizacion = async () => {
  if (!formAmort.value.monto || parseFloat(formAmort.value.monto) <= 0) {
    Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Ingresa un monto válido.', showConfirmButton: false, timer: 2500 })
    return
  }
  if (!formAmort.value.metodo_pago_id || !formAmort.value.cuenta_id) {
    Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Selecciona método y cuenta de pago.', showConfirmButton: false, timer: 2500 })
    return
  }
  try {
    procesandoAmort.value = true
    const res = await api.post(`/planes-pago/${planPagoId.value}/amortizar`, formAmort.value)
    mostrarModalAmort.value = false
    await seleccionarPlan(planSeleccionado.value)
    Swal.fire({
      icon: 'success',
      title: 'Amortización registrada',
      html: `Saldo anterior: <b>Bs. ${res.data.saldo_anterior}</b><br>Nuevo saldo: <b>Bs. ${res.data.saldo_nuevo}</b><br>Las cuotas fueron recalculadas.`,
      confirmButtonText: 'Aceptar'
    })
  } catch (err) {
    if (err?.operationPending) { Swal.fire('Operación en proceso', err.message, 'info'); return }
    Swal.fire('Error', err.response?.data?.message || 'No se pudo registrar la amortización.', 'error')
  } finally {
    procesandoAmort.value = false
  }
}

// ==========================================
// 5. HELPERS
// ==========================================
const formatoMoneda = (valor) => {
  return parseFloat(valor || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatearFecha = (fechaStr) => {
  if (!fechaStr) return '-'
  // Si viene con T (formato ISO)
  if (fechaStr.includes('T')) {
    return fechaStr.split('T')[0]
  }
  return fechaStr
}

const getNombreCuenta = (id) => {
  return cuentasBancarias.value.find(c => c.id === id)?.nombre || ''
}
</script>

<template>
  <div class="container-fluid py-4 pb-5">
    
    <transition name="fade-slide" mode="out-in">
      
      <!-- VISTA 1: LISTADO -->
      <div v-if="!planSeleccionado" key="listado">
        <div class="row mb-4 align-items-center">
          <div class="col">
            <h2 class="h3 fw-bold mb-1" style="color: #2c3e50;">Pagos al Credito</h2>
            <p class="text-muted mb-0">Listado de planes vigentes</p>
          </div>
          <div class="col-auto">
            <div class="bg-white p-2 px-3 rounded-3 border shadow-sm text-center">
              <div class="small text-muted text-uppercase fw-bold" style="font-size: 0.7rem;">Total Planes</div>
              <div class="h5 mb-0 fw-bold text-primary">{{ totalItems }}</div>
            </div>
          </div>
        </div>

        <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div class="card-header bg-white py-3 px-4 d-flex justify-content-between align-items-center border-bottom">
            <h6 class="mb-0 fw-bold text-dark"><i class="bi bi-journal-text me-2"></i>Planes Activos</h6>
            <button class="btn btn-sm btn-light border" @click="cargarPlanes(currentPage)" :disabled="cargando">
              <i class="bi bi-arrow-clockwise"></i>
            </button>
          </div>
          
          <div class="card-body p-0">
            <div v-if="cargando" class="text-center py-5">
              <div class="spinner-border text-primary" role="status"></div>
            </div>

            <div v-else class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th class="ps-4">Venta / Cliente</th>
                    <th>Propiedad</th>
                    <th class="text-end">Saldo Pendiente</th>
                    <th class="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="plan in planesPagos" :key="plan.id">
                    <td class="ps-4">
                      <div class="fw-bold text-dark">VTA-{{ plan.id.toString().padStart(5, '0') }}</div>
                      <div class="small text-muted">{{ plan.cliente?.nombre_completo }}</div>
                    </td>
                    <td>
                      <div class="small fw-medium">{{ plan.propiedad?.nombre }}</div>
                      <span class="badge bg-light text-dark border" style="font-size: 0.7rem;">{{ plan.propiedad?.codigo }}</span>
                    </td>
                    <td class="text-end">
                      <div class="fw-bold text-primary">Bs. {{ formatoMoneda(plan.saldo_credito) }}</div>
                      <div class="small text-muted">{{ plan.numero_cuotas }} cuotas</div>
                    </td>
                    <td class="text-center">
                      <button class="btn btn-primary btn-sm rounded-pill px-4" @click="seleccionarPlan(plan)">
                        Gestionar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div v-if="totalPages > 1" class="card-footer bg-white py-3 border-top">
            <nav>
              <ul class="pagination pagination-sm justify-content-center mb-0">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link shadow-none" @click="cargarPlanes(currentPage - 1)">Ant.</button>
                </li>
                <li v-for="page in totalPages" :key="page" class="page-item" :class="{ active: currentPage === page }">
                  <button class="page-link shadow-none" @click="cargarPlanes(page)">{{ page }}</button>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <button class="page-link shadow-none" @click="cargarPlanes(currentPage + 1)">Sig.</button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>

      <!-- VISTA 2: DETALLE -->
      <div v-else key="detalle">
        <div class="row mb-4 align-items-center">
          <div class="col">
            <div class="d-flex align-items-center">
              <button class="btn btn-outline-secondary rounded-circle me-3 border-0 bg-white shadow-sm" @click="volverAlListado">
                <i class="bi bi-arrow-left"></i>
              </button>
              <div>
                <h2 class="h4 fw-bold mb-0" style="color: #2c3e50;">VTA-{{ planSeleccionado.id.toString().padStart(5, '0') }}</h2>
                <span class="text-muted">{{ planSeleccionado.cliente?.nombre_completo }}</span>
              </div>
            </div>
          </div>
          <div class="col-auto d-flex gap-2">
            <button class="btn btn-info btn-lg px-3 shadow-sm fw-bold rounded-pill text-white"
              @click="abrirModalAmort" title="Registrar pago extraordinario de capital">
              <i class="bi bi-coin me-1"></i> Amortizar
            </button>
            <button class="btn btn-warning btn-lg px-3 shadow-sm fw-bold rounded-pill"
              @click="abrirModalReprog" title="Reprogramar cuotas pendientes">
              <i class="bi bi-arrow-repeat me-1"></i> Reprogramar
            </button>
            <button
              class="btn btn-success btn-lg px-4 shadow-sm fw-bold rounded-pill"
              :disabled="numSeleccionados === 0"
              @click="abrirModalPago">
              <i class="bi bi-cash-coin me-2"></i> COBRAR ({{ numSeleccionados }})
            </button>
          </div>
        </div>

        <div class="row g-4">
          <div class="col-lg-4">
            <div class="card border-0 shadow-sm rounded-4 mb-4">
              <div class="card-body">
                <div class="mb-3">
                  <div class="small text-muted fw-bold text-uppercase mb-1">Propiedad</div>
                  <div class="fw-bold">{{ planSeleccionado.propiedad?.nombre }}</div>
                  <span class="badge bg-light text-dark border">{{ planSeleccionado.propiedad?.codigo }}</span>
                </div>
                <hr class="my-3 opacity-10">
                <div class="row g-3">
                  <div class="col-6">
                    <div class="small text-muted text-uppercase mb-1">Total</div>
                    <div class="fw-bold small">Bs. {{ formatoMoneda(planSeleccionado.monto_liquido) }}</div>
                  </div>
                  <div class="col-6 text-end">
                    <div class="small text-muted text-uppercase mb-1">Inicial</div>
                    <div class="fw-bold small text-success">Bs. {{ formatoMoneda(planSeleccionado.cuota_inicial) }}</div>
                  </div>
                  <div class="col-12 mt-3">
                    <div class="p-3 bg-primary bg-opacity-10 text-primary rounded-3 border border-primary border-opacity-25">
                      <div class="small fw-bold text-uppercase mb-1">Saldo Capital Pendiente</div>
                      <div class="h4 mb-0 fw-bold">Bs. {{ formatoMoneda(saldoCapitalActual) }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="numSeleccionados > 0" class="card border-0 bg-success text-white shadow-sm rounded-4">
              <div class="card-body p-4 text-center">
                <div class="small text-uppercase fw-bold opacity-75">{{ numSeleccionados }} cuota(s)</div>
                <div class="h3 fw-bold my-2">Bs. {{ formatoMoneda(totalAPagar) }}</div>
                <div v-if="tasaMoraPlan > 0 && moraResumen.total > 0" class="small opacity-75 mb-1">
                  + mora est. Bs. {{ formatoMoneda(moraResumen.total) }}
                </div>
                <button class="btn btn-light w-100 fw-bold rounded-pill mt-2" @click="abrirModalPago">
                  PROCESAR PAGO
                </button>
              </div>
            </div>
          </div>

          <div class="col-lg-8">
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden">
              <div class="card-header bg-white py-3 border-bottom">
                <h6 class="mb-0 fw-bold text-dark">Cronograma de Cuotas</h6>
              </div>
              <div class="card-body p-0">
                <div v-if="cargandoCuotas" class="text-center py-5">
                  <div class="spinner-border text-primary" role="status"></div>
                </div>
                <div v-else class="table-responsive" style="max-height: 550px;">
                  <table class="table table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th width="60" class="text-center">#</th>
                        <th>Vencimiento</th>
                        <th class="text-end">Cuota</th>
                        <th class="text-end">Saldo capital</th>
                        <th v-if="tasaMoraPlan > 0" class="text-end text-danger">Mora est.</th>
                        <th class="text-center">Estado</th>
                        <th width="40"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="cuota in cuotasPlan" :key="cuota.id"
                          :class="{'cuota-pagada': cuota.estado === 'Pagada', 'cuota-seleccionada': seleccionSet.has(cuota.id)}"
                          @click="toggleCuota(cuota)"
                          class="cursor-pointer">
                        <td class="text-center fw-bold text-muted">{{ cuota.numero_cuota }}</td>
                        <td :class="cuota.estado === 'Pagada' ? 'text-muted' : 'text-dark'">
                          {{ formatearFecha(cuota.fecha_vencimiento) }}
                        </td>
                        <td class="text-end fw-bold">Bs. {{ formatoMoneda(cuota.monto_cuota) }}</td>
                        <td class="text-end text-muted small">
                          {{ cuota.estado === 'Pagada' ? '—' : 'Bs. ' + formatoMoneda(cuota.saldo_capital) }}
                        </td>
                        <td v-if="tasaMoraPlan > 0" class="text-end small">
                          <span v-if="cuota.estado === 'Vencida'" class="text-danger fw-bold">
                            +Bs. {{ formatoMoneda(calcularMoraCuota(cuota, new Date().toISOString().slice(0,10))) }}
                          </span>
                          <span v-else class="text-muted">—</span>
                        </td>
                        <td class="text-center">
                          <span v-if="cuota.estado === 'Pagada'" class="badge-status badge-status-active">Pagada</span>
                          <span v-else-if="cuota.estado === 'Vencida'" class="badge-status badge-status-danger">Vencida</span>
                          <span v-else class="badge-status badge-status-inactive">Pendiente</span>
                        </td>
                        <td class="text-center">
                          <div class="form-check">
                            <input type="checkbox" class="form-check-input shadow-none"
                                   :checked="seleccionSet.has(cuota.id) || cuota.estado === 'Pagada'"
                                   :disabled="cuota.estado === 'Pagada'"
                                   @click.stop
                                   @change="toggleCuota(cuota)">
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- MODAL AMORTIZACIÓN -->
    <div v-if="mostrarModalAmort" class="modal-custom-overlay" @click.self="mostrarModalAmort = false">
      <div class="modal-custom-container shadow-lg" style="max-width: 520px;">
        <div class="modal-custom-header" style="background: #0dcaf0;">
          <div class="d-flex align-items-center">
            <div class="icon-circle bg-white me-3" style="color: #0dcaf0;">
              <i class="bi bi-coin fs-4"></i>
            </div>
            <div>
              <h5 class="mb-0 fw-bold text-white">Amortizar Capital</h5>
              <span class="small text-white opacity-75">VTA-{{ planSeleccionado?.id?.toString().padStart(5,'0') }} · Saldo: Bs. {{ formatoMoneda(saldoCapitalActual) }}</span>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" @click="mostrarModalAmort = false"></button>
        </div>
        <div class="modal-custom-body p-4 bg-white">
          <div class="alert alert-info py-2 small mb-4">
            <i class="bi bi-info-circle me-1"></i>
            El monto pagado se descontará del saldo de capital y las cuotas restantes se recalcularán automáticamente con importes menores.
          </div>
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label small fw-bold text-muted">Monto a amortizar (Bs) <span class="text-danger">*</span></label>
              <input type="number" class="form-control" v-model="formAmort.monto"
                :max="saldoCapitalActual - 0.01" min="0.01" step="0.01"
                placeholder="Ej. 3000">
              <div class="form-text">Debe ser menor al saldo capital: <strong>Bs. {{ formatoMoneda(saldoCapitalActual) }}</strong></div>
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold text-muted">Método de pago <span class="text-danger">*</span></label>
              <select class="form-select" v-model="formAmort.metodo_pago_id" @change="onMetodoAmortChange">
                <option value="">-- Seleccionar --</option>
                <option v-for="m in metodosPago" :key="m.id" :value="m.id">{{ m.nombre_metodo }}</option>
              </select>
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold text-muted">Fecha de pago <span class="text-danger">*</span></label>
              <input type="date" class="form-control" v-model="formAmort.fecha_pago">
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold text-muted">Cuenta destino <span class="text-danger">*</span></label>
              <select class="form-select" v-model="formAmort.cuenta_id">
                <option value="">-- Seleccionar --</option>
                <option v-for="c in cuentasBancarias" :key="c.id" :value="c.id">{{ c.nombre }} ({{ c.tipo }})</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold text-muted">Observaciones</label>
              <textarea class="form-control" v-model="formAmort.observaciones" rows="2" placeholder="Referencia de depósito, etc..."></textarea>
            </div>
          </div>
        </div>
        <div class="d-flex gap-2 justify-content-end px-4 pb-4">
          <button class="btn btn-light border" @click="mostrarModalAmort = false" :disabled="procesandoAmort">Cancelar</button>
          <button class="btn fw-bold text-white" style="background:#0dcaf0;" @click="ejecutarAmortizacion" :disabled="procesandoAmort">
            <span v-if="procesandoAmort"><span class="spinner-border spinner-border-sm me-1"></span>Procesando...</span>
            <span v-else><i class="bi bi-coin me-1"></i>Registrar Amortización</span>
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL REPROGRAMACIÓN -->
    <div v-if="mostrarModalReprog" class="modal-custom-overlay" @click.self="mostrarModalReprog = false">
      <div class="modal-custom-container shadow-lg" style="max-width: 560px;">
        <div class="modal-custom-header" style="background: #f39c12;">
          <div class="d-flex align-items-center">
            <div class="icon-circle bg-white me-3" style="color: #f39c12;">
              <i class="bi bi-arrow-repeat fs-4"></i>
            </div>
            <div>
              <h5 class="mb-0 fw-bold text-white">Reprogramar Plan de Pagos</h5>
              <span class="small text-white opacity-75">VTA-{{ planSeleccionado?.id?.toString().padStart(5,'0') }}</span>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" @click="mostrarModalReprog = false"></button>
        </div>
        <div class="modal-custom-body p-4 bg-white">
          <div class="alert alert-warning py-2 small mb-4">
            <i class="bi bi-exclamation-triangle me-1"></i>
            Las cuotas pendientes desde la cuota indicada se marcarán como <strong>Reprogramadas</strong> y se creará un nuevo cronograma.
          </div>
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label small fw-bold text-muted">Motivo <span class="text-danger">*</span></label>
              <input type="text" class="form-control" v-model="formReprog.motivo" placeholder="Ej. Solicitud del cliente..." maxlength="255">
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold text-muted">Fecha de reprogramación <span class="text-danger">*</span></label>
              <input type="date" class="form-control" v-model="formReprog.fecha_reprogramacion">
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold text-muted">Desde cuota N° <span class="text-danger">*</span></label>
              <input type="number" class="form-control" v-model="formReprog.cuota_desde" min="1">
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold text-muted">Nueva tasa anual (%) <span class="text-danger">*</span></label>
              <input type="number" class="form-control" v-model="formReprog.nueva_tasa_interes" min="0" max="100" step="0.01">
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold text-muted">Nuevas cuotas <span class="text-danger">*</span></label>
              <input type="number" class="form-control" v-model="formReprog.nuevo_numero_cuotas" min="1">
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold text-muted">Nueva fecha de inicio <span class="text-danger">*</span></label>
              <input type="date" class="form-control" v-model="formReprog.nueva_fecha_inicio">
            </div>
            <div class="col-6 d-flex align-items-end">
              <div class="p-3 bg-warning bg-opacity-10 rounded-3 border border-warning border-opacity-25 w-100">
                <div class="small text-muted fw-bold mb-1">Saldo capital</div>
                <div class="fw-bold" style="color: #e67e22;">Bs. {{ formatoMoneda(saldoCapitalActual) }}</div>
              </div>
            </div>
            <div class="col-12">
              <label class="form-label small fw-bold text-muted">Observaciones</label>
              <textarea class="form-control" v-model="formReprog.observaciones" rows="2" maxlength="1000" placeholder="Notas adicionales..."></textarea>
            </div>
          </div>
        </div>
        <div class="d-flex gap-2 justify-content-end px-4 pb-4">
          <button class="btn btn-light border" @click="mostrarModalReprog = false" :disabled="procesandoReprog">Cancelar</button>
          <button class="btn fw-bold text-white" style="background:#f39c12;" @click="ejecutarReprogramacion" :disabled="procesandoReprog">
            <span v-if="procesandoReprog"><span class="spinner-border spinner-border-sm me-1"></span>Procesando...</span>
            <span v-else><i class="bi bi-arrow-repeat me-1"></i>Aplicar Reprogramación</span>
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL PAGO -->
    <div v-if="mostrarModalPago" class="modal-custom-overlay">
      <div class="modal-custom-container shadow-lg">
        <div class="modal-custom-header bg-success text-white">
          <div class="d-flex align-items-center">
            <div class="icon-circle bg-white text-success me-3">
              <i class="bi bi-wallet2 fs-4"></i>
            </div>
            <div>
              <h5 class="mb-0 fw-bold">Confirmar Cobro</h5>
              <span class="small opacity-75">Registro de ingreso</span>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" @click="mostrarModalPago = false"></button>
        </div>

        <div class="modal-custom-body p-4 bg-white">
          <div class="payment-summary mb-4 p-3 rounded-4 border-dashed">
            <div class="row align-items-center">
              <div class="col border-end pe-4">
                <div class="small text-muted fw-bold mb-1">SELECCIONADOS</div>
                <div class="h5 mb-0 fw-bold text-dark">{{ numSeleccionados }} cuotas</div>
              </div>
              <div class="col-auto text-end ps-4">
                <div class="small text-muted fw-bold mb-1">SUBTOTAL CUOTAS</div>
                <div class="h4 mb-0 fw-bold text-dark">Bs. {{ formatoMoneda(totalAPagar) }}</div>
              </div>
            </div>

            <!-- Sección de mora -->
            <div v-if="tasaMoraPlan > 0 && moraResumen.detalle.length > 0" class="mt-3 pt-3 border-top">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="small fw-bold text-danger">
                  <i class="bi bi-exclamation-triangle-fill me-1"></i>
                  {{ moraResumen.detalle.length }} cuota(s) vencida(s) con mora
                </div>
                <div class="form-check form-switch mb-0">
                  <input class="form-check-input" type="checkbox" v-model="cobrarMora" id="switchMora">
                  <label class="form-check-label small fw-bold" for="switchMora" :class="cobrarMora ? 'text-danger' : 'text-muted'">
                    {{ cobrarMora ? 'Cobrar mora' : 'Sin mora' }}
                  </label>
                </div>
              </div>
              <div v-if="cobrarMora" class="table-responsive">
                <table class="table table-sm mb-2" style="font-size: 0.8rem;">
                  <tbody>
                    <tr v-for="d in moraResumen.detalle" :key="d.cuota.id">
                      <td class="text-muted ps-0">Cuota #{{ d.cuota.numero_cuota }}</td>
                      <td class="text-muted">{{ d.diasAtraso }} días</td>
                      <td class="text-end text-danger fw-bold pe-0">+Bs. {{ formatoMoneda(d.monto) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="d-flex justify-content-between fw-bold border-top pt-2">
                <span class="text-muted">Total mora:</span>
                <span :class="cobrarMora ? 'text-danger' : 'text-muted text-decoration-line-through'">
                  Bs. {{ formatoMoneda(moraResumen.total) }}
                </span>
              </div>
            </div>

            <div class="d-flex justify-content-between fw-bold mt-3 pt-2 border-top">
              <span class="text-success">TOTAL A COBRAR:</span>
              <span class="h4 mb-0 fw-bold text-success">Bs. {{ formatoMoneda(totalConMora) }}</span>
            </div>
          </div>

          <form @submit.prevent="confirmarPago">
            <div class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label small fw-bold text-muted">METODO PAGO</label>
                <select v-model="formPago.metodo_pago_id" @change="onMetodoChange" class="form-select" required>
                  <option value="">-- Seleccionar --</option>
                  <option v-for="m in metodosPago" :key="m.id" :value="m.id">{{ m.nombre_metodo }}</option>
                </select>
              </div>
              <div class="col-md-6 mb-3">
                <label class="form-label small fw-bold text-muted">FECHA</label>
                <input type="date" v-model="formPago.fecha_pago" class="form-control" required>
              </div>
              <div class="col-12 mb-3">
                <label class="form-label small fw-bold text-muted">CUENTA DESTINO</label>
                <select v-model="formPago.cuenta_id" class="form-select" required>
                  <option value="">-- Seleccionar Cuenta --</option>
                  <option v-for="c in cuentasBancarias" :key="c.id" :value="c.id">{{ c.nombre }} ({{ c.tipo }})</option>
                </select>
                <small v-if="formPago.cuenta_id" class="text-success fw-bold d-block mt-1">{{ getNombreCuenta(formPago.cuenta_id) }}</small>
              </div>
              <div class="col-12 mb-4">
                <label class="form-label small fw-bold text-muted">OBSERVACIONES</label>
                <textarea v-model="formPago.observaciones" class="form-control" rows="2" placeholder="Referencia de deposito, transferencia, etc..."></textarea>
              </div>
            </div>
            <div class="d-grid gap-2">
              <button type="submit" class="btn btn-success btn-lg fw-bold shadow-sm" :disabled="procesando">
                <span v-if="procesando" class="spinner-border spinner-border-sm me-2"></span>
                REGISTRAR COBRO
              </button>
              <button type="button" class="btn btn-light btn-sm mt-1" @click="mostrarModalPago = false" :disabled="procesando">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateX(20px); }
.fade-slide-leave-to { opacity: 0; transform: translateX(-20px); }

.cursor-pointer { cursor: pointer; }
.cuota-pagada { background-color: #f8fafc; opacity: 0.6; }
.cuota-seleccionada { background-color: rgba(25, 135, 84, 0.08) !important; }

.modal-custom-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(11, 37, 69, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000; backdrop-filter: blur(8px);
}
.modal-custom-container {
  background: var(--bg-card); color: var(--text-main); width: 95%; max-width: 550px; border-radius: 24px; overflow: hidden;
  animation: modalScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes modalScale { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.modal-custom-header { padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; }
.icon-circle { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.border-dashed { border: 2px dashed var(--border-color); background-color: rgba(255, 255, 255, 0.03); }

.modal-custom-body {
  background-color: var(--bg-card) !important;
  color: var(--text-main) !important;
}

.form-select, .form-control { border-radius: 10px; padding: 0.65rem 1rem; border: 1px solid var(--border-color); font-size: 0.95rem; background-color: var(--bg-card); color: var(--text-main); }
.form-select:focus, .form-control:focus { border-color: var(--primary-color); box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }

.form-check-input:checked { background-color: #198754; border-color: #198754; }
</style>
