<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/axios'
import apiPropiedades from '../api/axiosPropiedades'
import Swal from 'sweetalert2'
import LiveSearchSelect from '../components/LiveSearchSelect.vue'
import ClienteModal from '../components/ClienteModal.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const step = ref(1)
const guardando = ref(false)

const isAsesor = computed(() => {
  const asignaciones = authStore.user?.roles_permisos || authStore.user?.rolesPermisos || []
  return asignaciones.some(item => {
    const rol = item.rol_permiso?.rol || item.rolPermiso?.rol
    return rol?.nombre === 'Asesor de Ventas'
  })
})

// Data de catálogos
const clientes = ref([])
const propiedades = ref([])
const asesores = ref([])
const metodosPago = ref([])
const cuentasBancarias = ref([])

// Selecciones
const clienteSeleccionadoId = ref(null)
const propiedadSeleccionadaId = ref(null)

// Formulario de Venta
const formVenta = ref({
  asesor_id: '',
  fecha: new Date().toISOString().slice(0, 10),
  tipo_venta: 'CONTADO',
  metodo_pago_id: '',

  // Contado
  descuento: 0,

  // Crédito
  cuota_inicial: 0,
  numero_cuotas: 12,
  tasa_interes: 10,
  tasa_mora: 3,
  fecha_inicio_pago: ''
})

// Objetos completos seleccionados
const clienteObj = computed(() => clientes.value.find(c => c.id === clienteSeleccionadoId.value))
const propiedadObj = computed(() => propiedades.value.find(p => p.id === propiedadSeleccionadaId.value))
const asesorObj = computed(() => asesores.value.find(a => a.id === formVenta.value.asesor_id))

// Mapeado rico para el selector de propiedades
const propiedadesParaSelector = computed(() =>
  propiedades.value.map(p => {
    const formattedPrecio = p.precio_venta 
      ? Number(p.precio_venta).toLocaleString('en-US', { minimumFractionDigits: 2 }) 
      : '0.00';
    
    const sectorStr = p.sector_urbano?.nombre || 'Sin Sector';
    const ciudadStr = p.sector_urbano?.distrito?.ciudad?.nombre || '';
    const ubicacionStr = ciudadStr ? `${sectorStr}, ${ciudadStr}` : sectorStr;
    const supStr = p.superficie_m2 ? ` · ${p.superficie_m2}m²` : '';

    return {
      ...p,
      display_label: `${p.codigo} · ${p.tipo}${supStr}`,
      display_sub: `Precio: ${p.moneda} ${formattedPrecio} · Ubicación: ${ubicacionStr}`
    }
  })
)

// ==========================================
// 1. CARGA INICIAL
// ==========================================
onMounted(async () => {
  try {
    const [resCli, resProp, resAse, resMet, resCuentas] = await Promise.all([
      api.get('/clientes?per_page=50'),
      apiPropiedades.get('/propiedades?per_page=100'),
      api.get('/asesores?per_page=100'),
      api.get('/metodos-pago?per_page=100'),
      api.get('/cuentas-bancarias?per_page=100')
    ])
    clientes.value = resCli.data.data.filter(c => c.estado == 1)
    propiedades.value = resProp.data.data.filter(p => p.estado === 'Disponible' && p.activo)
    asesores.value = resAse.data.data
    metodosPago.value = (resMet.data.data ?? resMet.data).filter(m => m.nombre_metodo !== 'Pasarela de Pago')
    cuentasBancarias.value = resCuentas.data.data ?? resCuentas.data

    if (isAsesor.value) {
      const propio = asesores.value.find(a => a.user_id === authStore.user?.id)
      if (propio) formVenta.value.asesor_id = propio.id
    }

  } catch (error) {
    Swal.fire('Error', 'No se pudieron cargar los catálogos.', 'error')
  }
})

// ==========================================
// 2. BÚSQUEDA REMOTA CON DEBOUNCE (Punto 4)
// ==========================================
let searchClienteTimeout = null
let searchPropiedadTimeout = null
let searchAsesorTimeout = null

const buscarClientesRemoto = (query) => {
  clearTimeout(searchClienteTimeout)
  if (!query || query.length < 2) return
  searchClienteTimeout = setTimeout(async () => {
    try {
      const res = await api.get(`/clientes?search=${query}&per_page=30`)
      clientes.value = res.data.data.filter(c => c.estado == 1)
    } catch { /* silent */ }
  }, 300)
}

const buscarPropiedadesRemoto = (query) => {
  clearTimeout(searchPropiedadTimeout)
  if (!query || query.length < 2) return
  searchPropiedadTimeout = setTimeout(async () => {
    try {
      const res = await apiPropiedades.get(`/propiedades?search=${query}&per_page=30`)
      propiedades.value = res.data.data.filter(p => p.estado === 'Disponible' && p.activo)
    } catch { /* silent */ }
  }, 300)
}

const buscarAsesoresRemoto = (query) => {
  clearTimeout(searchAsesorTimeout)
  if (!query || query.length < 2) return
  searchAsesorTimeout = setTimeout(async () => {
    try {
      const res = await api.get(`/asesores?search=${query}&per_page=30`)
      asesores.value = res.data.data
    } catch { /* silent */ }
  }, 300)
}


// ==========================================
// 3. LÓGICA FINANCIERA
// ==========================================
const monedaPropiedad = computed(() => propiedadObj.value?.moneda || 'Bs')
const montoTotal = computed(() => propiedadObj.value ? parseFloat(propiedadObj.value.precio_venta) : 0)
const montoLiquido = computed(() => montoTotal.value - formVenta.value.descuento)
const saldoCredito = computed(() => montoTotal.value - formVenta.value.cuota_inicial)

// Comisión calculada en base al porcentaje del asesor
const montoComisionPreview = computed(() => {
  if (!asesorObj.value || !montoTotal.value) return '0.00'
  const pct = parseFloat(asesorObj.value.porcentaje_comision) || 0
  return (montoTotal.value * pct / 100).toFixed(2)
})

// Plan de pagos (Sistema Francés)
const planPagosPreview = computed(() => {
  if (formVenta.value.tipo_venta !== 'CREDITO' || saldoCredito.value <= 0 || formVenta.value.numero_cuotas < 1) return []

  const meses = parseInt(formVenta.value.numero_cuotas)
  const tasaAnual = parseFloat(formVenta.value.tasa_interes)
  const P = saldoCredito.value
  const i = (tasaAnual / 100) / 12

  let cuotaFija = i > 0 ? P * (i * Math.pow(1 + i, meses)) / (Math.pow(1 + i, meses) - 1) : P / meses

  let saldo = P
  let cuotas = []

  for (let mes = 1; mes <= meses; mes++) {
    let interes = saldo * i
    let capital = cuotaFija - interes

    if (mes === meses) {
      capital = saldo
      cuotaFija = capital + interes
    }
    saldo -= capital

    cuotas.push({
      nro: mes,
      cuota: cuotaFija.toFixed(2),
      interes: interes.toFixed(2),
      capital: capital.toFixed(2),
      saldo: Math.abs(saldo).toFixed(2)
    })
  }
  return cuotas
})

// ==========================================
// 4. ACCIONES Y VALIDACIONES
// ==========================================
const alCrearCliente = (nuevoCliente) => {
  clientes.value.push(nuevoCliente)
  clienteSeleccionadoId.value = nuevoCliente.id
}

const siguientePaso = () => {
  if (step.value === 1 && !clienteSeleccionadoId.value) return Swal.fire('Atención', 'Debe seleccionar un cliente.', 'warning')
  if (step.value === 2 && !propiedadSeleccionadaId.value) return Swal.fire('Atención', 'Debe seleccionar una propiedad.', 'warning')

  // Punto 5: solo autollenar si el campo está vacío (no sobreescribir si el usuario ya editó)
  if (step.value === 2 && !formVenta.value.fecha_inicio_pago) {
    let fechaPago = new Date()
    fechaPago.setMonth(fechaPago.getMonth() + 1)
    formVenta.value.fecha_inicio_pago = fechaPago.toISOString().slice(0, 10)
  }
  step.value++
}

const registrarVenta = async () => {
  if (!isAsesor.value && !formVenta.value.asesor_id) {
    return Swal.fire('Atención', 'Debe seleccionar un asesor responsable.', 'warning')
  }
  if (formVenta.value.tipo_venta === 'CREDITO' && parseFloat(formVenta.value.cuota_inicial) <= 0) {
    return Swal.fire('Atención', 'La cuota inicial debe ser mayor a 0 para ventas a crédito.', 'warning')
  }
  guardando.value = true

  const payload = {
    asesor_id: formVenta.value.asesor_id,
    cliente_id: clienteSeleccionadoId.value,
    propiedad_id: propiedadSeleccionadaId.value,
    fecha: formVenta.value.fecha,
    moneda: monedaPropiedad.value,
    monto_total: montoTotal.value,
    tipo_venta: formVenta.value.tipo_venta,
    metodo_pago_id: formVenta.value.metodo_pago_id || null
  }

  if (payload.tipo_venta === 'CONTADO') {
    payload.descuento = formVenta.value.descuento
    payload.monto_liquido = montoLiquido.value
  } else {
    payload.cuota_inicial = formVenta.value.cuota_inicial
    payload.saldo_credito = saldoCredito.value
    payload.numero_cuotas = formVenta.value.numero_cuotas
    payload.tasa_interes = formVenta.value.tasa_interes
    payload.tasa_mora = formVenta.value.tasa_mora
    payload.fecha_inicio_pago = formVenta.value.fecha_inicio_pago
  }

  try {
    await api.post('/ventas', payload)
    Swal.fire('¡Venta Registrada!', 'El contrato y plan de pagos han sido generados exitosamente.', 'success').then(() => {
      resetAsistente()
    })
  } catch (error) {
    let msg = error.response?.data?.message || 'Revisa los datos e intenta nuevamente.'
    Swal.fire('Error al procesar la venta', msg, 'error')
  } finally {
    guardando.value = false
  }
}

const resetAsistente = () => {
  step.value = 1
  clienteSeleccionadoId.value = null
  propiedadSeleccionadaId.value = null
  const defaultAsesorId = isAsesor.value
    ? (asesores.value.find(a => a.user_id === authStore.user?.id)?.id || '')
    : ''
  formVenta.value = {
    asesor_id: defaultAsesorId,
    fecha: new Date().toISOString().slice(0, 10),
    tipo_venta: 'CONTADO',
    metodo_pago_id: '',
    descuento: 0,
    cuota_inicial: 0,
    numero_cuotas: 12,
    tasa_interes: 10,
    tasa_mora: 3,
    fecha_inicio_pago: ''
  }
}
</script>

<template>
  <div class="container-xl py-4 pb-5">

    <div class="row mb-4">
      <div class="col-12 text-center text-lg-start">
        <h2 class="fw-bold mb-1" style="color: var(--text-main);">Registro de Nueva Venta</h2>
        <p class="text-muted">Asistente paso a paso para generación de contratos</p>
      </div>
    </div>

    <div class="row g-4">
      <!-- COLUMNA IZQUIERDA: ASISTENTE -->
      <div class="col-lg-8">
        
        <!-- INDICADOR DE PASOS RE-DISEÑADO -->
        <div class="card border-0 shadow-sm rounded-4 mb-4">
          <div class="card-body py-3">
            <div class="d-flex justify-content-around align-items-center">
              <div class="step-item" :class="{'active': step >= 1}">
                <div class="step-number">1</div>
                <div class="step-label d-none d-md-block">Cliente</div>
              </div>
              <div class="step-connector" :class="{'active': step >= 2}"></div>
              <div class="step-item" :class="{'active': step >= 2}">
                <div class="step-number">2</div>
                <div class="step-label d-none d-md-block">Propiedad</div>
              </div>
              <div class="step-connector" :class="{'active': step >= 3}"></div>
              <div class="step-item" :class="{'active': step >= 3}">
                <div class="step-number">3</div>
                <div class="step-label d-none d-md-block">Contrato y Pagos</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card border-0 shadow-lg rounded-4 overflow-hidden">
          <div class="card-body p-0">

            <!-- PASO 1: CLIENTE -->
            <div v-show="step === 1" class="p-4 animate-fade">
              <div class="d-flex justify-content-between align-items-center mb-4">
                <h5 class="fw-bold mb-0 text-primary"><i class="bi bi-person-check me-2"></i>Selección del Comprador</h5>
              </div>

              <div class="row g-3 align-items-end mb-4">
                <div class="col-md-9">
                  <label class="form-label small fw-bold text-muted">Buscar Cliente Registrado</label>
                  <LiveSearchSelect
                    v-model="clienteSeleccionadoId"
                    :options="clientes" displayKey="nombre_completo" subKey="ci" valueKey="id"
                    placeholder="Busca por Nombre o CI..."
                    @search="buscarClientesRemoto"
                  />
                </div>
                <div class="col-md-3">
                  <button class="btn btn-outline-primary w-100 shadow-sm" data-bs-toggle="modal" data-bs-target="#modalCrearCliente">
                    <i class="bi bi-plus-lg"></i> Nuevo
                  </button>
                </div>
              </div>

              <div class="alert alert-info p-3 rounded-3" v-if="!clienteSeleccionadoId">
                <i class="bi bi-info-circle-fill me-2"></i> Busque y seleccione un cliente para continuar.
              </div>
              <div v-else class="alert alert-success p-3 rounded-3 d-flex align-items-center animate-fade">
                <i class="bi bi-check-circle-fill fs-4 me-3"></i>
                <div>
                  <div class="fw-bold">Cliente Seleccionado</div>
                  <div class="small opacity-75">{{ clienteObj?.nombre_completo }}</div>
                </div>
              </div>
            </div>

            <!-- PASO 2: PROPIEDAD -->
            <div v-show="step === 2" class="p-4 animate-fade">
              <h5 class="fw-bold mb-4 text-primary"><i class="bi bi-house-door me-2"></i>Propiedad a Vender</h5>

              <div class="mb-4">
                <label class="form-label small fw-bold text-muted">Seleccionar Propiedad Disponible</label>
                <LiveSearchSelect
                  v-model="propiedadSeleccionadaId"
                  :options="propiedadesParaSelector" displayKey="display_label" subKey="display_sub" valueKey="id"
                  placeholder="Busca por Código de Propiedad..."
                  @search="buscarPropiedadesRemoto"
                />
              </div>

              <div class="alert alert-info p-3 rounded-3" v-if="!propiedadSeleccionadaId">
                <i class="bi bi-info-circle-fill me-2"></i> Seleccione una propiedad de la lista para ver sus detalles.
              </div>
              <div v-else class="alert alert-success p-3 rounded-3 d-flex align-items-center animate-fade">
                <i class="bi bi-check-circle-fill fs-4 me-3"></i>
                <div>
                  <div class="fw-bold">Propiedad Seleccionada</div>
                  <div class="small opacity-75">{{ propiedadObj?.codigo }} - {{ propiedadObj?.tipo }}</div>
                </div>
              </div>
            </div>

            <!-- PASO 3: CONTRATO Y PAGOS -->
            <div v-show="step === 3" class="p-4 animate-fade">
              <h5 class="fw-bold mb-4 text-primary"><i class="bi bi-file-earmark-text me-2"></i>Términos Comerciales</h5>

              <div class="row g-3 mb-4">
                <div :class="isAsesor ? 'col-md-12' : 'col-md-6'">
                  <label class="small fw-bold text-muted mb-1">Fecha del Contrato</label>
                  <input type="date" class="form-control" v-model="formVenta.fecha">
                </div>
                <div v-if="!isAsesor" class="col-md-6">
                  <label class="small fw-bold text-muted mb-1">Asesor Responsable</label>
                  <LiveSearchSelect
                    v-model="formVenta.asesor_id"
                    :options="asesores" displayKey="nombre_completo" subKey="correo" valueKey="id"
                    placeholder="Busca por nombre o correo..."
                    @search="buscarAsesoresRemoto"
                  />
                </div>
              </div>

              <div class="row g-3 mb-4">
                <div class="col-md-6">
                  <label class="small fw-bold text-muted mb-1">Método de Pago <span class="text-muted fw-normal">(opcional)</span></label>
                  <select class="form-select" v-model="formVenta.metodo_pago_id">
                    <option value="">— Sin especificar —</option>
                    <option v-for="m in metodosPago" :key="m.id" :value="m.id">{{ m.nombre_metodo }}</option>
                  </select>
                  <div class="form-text"><i class="bi bi-info-circle me-1"></i>El pago quedará pendiente de confirmación.</div>
                </div>
              </div>

              <div class="bg-light p-3 rounded-3 mb-4">
                <h6 class="fw-bold mb-3 small text-uppercase text-muted">Modalidad de Pago</h6>
                <div class="d-flex gap-4">
                  <div class="form-check custom-radio">
                    <input class="form-check-input" type="radio" v-model="formVenta.tipo_venta" value="CONTADO" id="pagoContado">
                    <label class="form-check-label fw-bold" for="pagoContado">Al Contado</label>
                  </div>
                  <div class="form-check custom-radio">
                    <input class="form-check-input" type="radio" v-model="formVenta.tipo_venta" value="CREDITO" id="pagoCredito">
                    <label class="form-check-label fw-bold" for="pagoCredito">Crédito Directo</label>
                  </div>
                </div>
              </div>

              <!-- CONTADO -->
              <div v-if="formVenta.tipo_venta === 'CONTADO'" class="row g-3 animate-fade">
                <div class="col-md-6">
                  <label class="small fw-bold text-muted">Descuento Especial ({{ monedaPropiedad }})</label>
                  <div class="input-group">
                    <span class="input-group-text bg-white border-end-0"><i class="bi bi-tag"></i></span>
                    <input type="number" step="0.01" class="form-control border-start-0" v-model="formVenta.descuento" min="0" :max="montoTotal">
                  </div>
                </div>
                <div class="col-md-6">
                  <label class="small fw-bold" :class="montoLiquido < 0 ? 'text-danger' : 'text-success'">Monto Final a Pagar</label>
                  <input type="text" class="form-control fw-bold"
                    :class="montoLiquido < 0 ? 'bg-danger bg-opacity-10 text-danger border-danger' : 'bg-success bg-opacity-10 text-success border-success'"
                    :value="monedaPropiedad + ' ' + montoLiquido.toLocaleString('en-US', {minimumFractionDigits: 2})" disabled>
                  <div v-if="montoLiquido < 0" class="text-danger extra-small mt-1">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>El descuento supera el monto total.
                  </div>
                </div>
              </div>

              <!-- CRÉDITO -->
              <div v-if="formVenta.tipo_venta === 'CREDITO'" class="animate-fade">
                <div class="row g-3 mb-3">
                  <div class="col-md-4">
                    <label class="small fw-bold text-primary">Cuota Inicial ({{ monedaPropiedad }}) <span class="text-danger">*</span></label>
                    <input type="number" step="0.01" class="form-control"
                      :class="parseFloat(formVenta.cuota_inicial) <= 0 ? 'border-danger' : 'border-primary'"
                      v-model="formVenta.cuota_inicial" min="0.01" :max="montoTotal">
                    <div v-if="parseFloat(formVenta.cuota_inicial) <= 0" class="text-danger extra-small mt-1">
                      La cuota inicial es requerida y debe ser mayor a 0.
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="small fw-bold text-muted">Inicio de Pagos</label>
                    <input type="date" class="form-control" v-model="formVenta.fecha_inicio_pago">
                  </div>
                  <div class="col-md-4">
                    <label class="small fw-bold text-danger">Saldo a Financiar</label>
                    <input type="text" class="form-control bg-danger bg-opacity-10 text-danger fw-bold border-danger" 
                      :value="monedaPropiedad + ' ' + saldoCredito.toLocaleString('en-US', {minimumFractionDigits: 2})" disabled>
                  </div>
                </div>
                <div class="row g-3 mb-4">
                  <div class="col-md-4">
                    <label class="small fw-bold text-muted">Plazo (Meses)</label>
                    <input type="number" class="form-control" v-model="formVenta.numero_cuotas" min="1">
                  </div>
                  <div class="col-md-4">
                    <label class="small fw-bold text-muted">Tasa de Interés Anual (%)</label>
                    <input type="number" step="0.01" class="form-control" v-model="formVenta.tasa_interes" min="0">
                  </div>
                  <div class="col-md-4">
                    <label class="small fw-bold text-muted">Tasa de Mora Mensual (%)</label>
                    <input type="number" step="0.01" class="form-control" v-model="formVenta.tasa_mora" min="0" max="100" placeholder="Ej. 3">
                    <div class="form-text">Se aplica sobre cuotas vencidas.</div>
                  </div>
                </div>

                <div v-if="planPagosPreview.length > 0" class="mt-4 border rounded-4 overflow-hidden shadow-sm">
                  <div class="bg-dark text-white p-2 text-center fw-bold small">PREVISUALIZACIÓN PLAN DE PAGOS (Sistema Francés)</div>
                  <div style="max-height: 250px; overflow-y: auto;">
                    <table class="table table-hover mb-0 text-center" style="font-size: 0.8rem;">
                      <thead class="sticky-top bg-white">
                        <tr><th>Nro</th><th>Cuota</th><th>Capital</th><th>Interés</th><th>Saldo</th></tr>
                      </thead>
                      <tbody>
                        <tr v-for="c in planPagosPreview" :key="c.nro">
                          <td>{{ c.nro }}</td>
                          <td class="fw-bold text-primary">{{ monedaPropiedad }} {{ c.cuota }}</td>
                          <td>{{ monedaPropiedad }} {{ c.capital }}</td>
                          <td class="text-danger">{{ monedaPropiedad }} {{ c.interes }}</td>
                          <td>{{ monedaPropiedad }} {{ c.saldo }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- Info de comisión -->
              <div v-if="asesorObj && montoTotal > 0" class="alert alert-info d-flex align-items-center gap-2 py-2 mt-4 mb-0 border-0">
                <i class="bi bi-percent fs-5"></i>
                <small>
                  Comisión del asesor <strong>{{ asesorObj.nombre_completo }}</strong>
                  ({{ asesorObj.porcentaje_comision }}%):
                  <strong>{{ monedaPropiedad }} {{ montoComisionPreview }}</strong>
                </small>
              </div>

            </div>

          </div>
          <div class="card-footer bg-white p-4 border-top d-flex justify-content-between">
            <button v-if="step > 1" class="btn btn-outline-secondary px-4 rounded-3" @click="step--">
              <i class="bi bi-chevron-left me-2"></i> Atrás
            </button>
            <div v-else></div>
            
            <button v-if="step < 3" class="btn btn-primary px-5 rounded-3 shadow" @click="siguientePaso">
              Siguiente <i class="bi bi-chevron-right ms-2"></i>
            </button>
            
            <button v-if="step === 3" class="btn btn-success px-5 rounded-3 shadow-lg fw-bold" @click="registrarVenta"
              :disabled="guardando
                || (formVenta.tipo_venta === 'CREDITO' && saldoCredito <= 0)
                || (formVenta.tipo_venta === 'CREDITO' && parseFloat(formVenta.cuota_inicial) <= 0)
                || (formVenta.tipo_venta === 'CONTADO' && montoLiquido < 0)">
              <span v-if="guardando" class="spinner-border spinner-border-sm me-2"></span>
              {{ guardando ? 'Procesando...' : 'Confirmar Venta' }} <i class="bi bi-check-circle ms-2"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: RESUMEN (SIDEBAR) -->
      <div class="col-lg-4">
        <div class="sticky-top" style="top: 20px; z-index: 10;">
          <div class="card border-0 shadow-lg rounded-4 overflow-hidden mb-4">
            <div class="card-header bg-dark text-white py-3">
              <h6 class="mb-0 fw-bold"><i class="bi bi-journal-text me-2"></i>Resumen de la Venta</h6>
            </div>
            <div class="card-body p-0">
              
              <!-- CLIENTE EN RESUMEN -->
              <div class="p-3 border-bottom">
                <div class="small text-muted fw-bold text-uppercase mb-2">Comprador</div>
                <div v-if="clienteObj" class="d-flex align-items-center">
                  <div class="bg-primary bg-opacity-10 text-primary rounded-circle p-2 me-3">
                    <i class="bi bi-person-fill fs-5"></i>
                  </div>
                  <div>
                    <div class="fw-bold lh-1 mb-1">{{ clienteObj.nombre_completo }}</div>
                    <div class="extra-small text-muted">CI: {{ clienteObj.ci }} | Telf: {{ clienteObj.telefono || '-' }}</div>
                  </div>
                </div>
                <div v-else class="text-muted small italic">Ningún cliente seleccionado</div>
              </div>

              <!-- PROPIEDAD EN RESUMEN -->
              <div class="p-3 border-bottom bg-light bg-opacity-50">
                <div class="small text-muted fw-bold text-uppercase mb-2">Inmueble</div>
                <div v-if="propiedadObj">
                  <div class="fw-bold text-primary mb-1">{{ propiedadObj.codigo }} - {{ propiedadObj.tipo }}</div>
                  <div class="extra-small text-muted mb-2">
                    <i class="bi bi-geo-alt-fill text-danger"></i> 
                    {{ propiedadObj.sector_urbano?.nombre }}{{ propiedadObj.sector_urbano?.distrito?.ciudad?.nombre ? ', ' + propiedadObj.sector_urbano.distrito.ciudad.nombre : '' }}
                  </div>
                  <div class="row g-0 extra-small">
                    <div class="col-6"><strong>Superficie:</strong> {{ propiedadObj.superficie_m2 }} m²</div>
                    <div class="col-6"><strong>Lote:</strong> {{ propiedadObj.nro_lote || '-' }}</div>
                  </div>
                </div>
                <div v-else class="text-muted small italic">Ninguna propiedad seleccionada</div>
              </div>

              <!-- TOTALES EN RESUMEN -->
              <div class="p-3 bg-white">
                <div class="small text-muted fw-bold text-uppercase mb-3">Detalles Financieros</div>
                
                <div class="d-flex justify-content-between mb-2">
                  <span class="small">Precio de Lista:</span>
                  <span class="fw-bold">{{ monedaPropiedad }} {{ montoTotal.toLocaleString('en-US', {minimumFractionDigits: 2}) }}</span>
                </div>

                <div v-if="formVenta.tipo_venta === 'CONTADO' && formVenta.descuento > 0" class="d-flex justify-content-between mb-2 text-danger">
                  <span class="small">Descuento:</span>
                  <span class="fw-bold">- {{ monedaPropiedad }} {{ parseFloat(formVenta.descuento).toLocaleString('en-US', {minimumFractionDigits: 2}) }}</span>
                </div>

                <div v-if="formVenta.tipo_venta === 'CREDITO' && formVenta.cuota_inicial > 0" class="d-flex justify-content-between mb-2 text-success">
                  <span class="small">Cuota Inicial:</span>
                  <span class="fw-bold">- {{ monedaPropiedad }} {{ parseFloat(formVenta.cuota_inicial).toLocaleString('en-US', {minimumFractionDigits: 2}) }}</span>
                </div>

                <hr class="my-2">

                <div class="d-flex justify-content-between align-items-center">
                  <span class="fw-bold" v-if="formVenta.tipo_venta === 'CONTADO'">Monto Final:</span>
                  <span class="fw-bold" v-else>Saldo a Financiar:</span>
                  <h4 class="fw-bold mb-0" :class="formVenta.tipo_venta === 'CONTADO' ? 'text-success' : 'text-danger'">
                    {{ monedaPropiedad }} {{ (formVenta.tipo_venta === 'CONTADO' ? montoLiquido : saldoCredito).toLocaleString('en-US', {minimumFractionDigits: 2}) }}
                  </h4>
                </div>

                <div v-if="formVenta.tipo_venta === 'CREDITO'" class="mt-3 p-2 bg-light rounded text-center">
                  <div class="extra-small text-muted text-uppercase">Plazo Estimado</div>
                  <div class="fw-bold">{{ formVenta.numero_cuotas }} meses a {{ formVenta.tasa_interes }}% int.</div>
                </div>

                <div v-if="formVenta.metodo_pago_id" class="mt-3 d-flex justify-content-between align-items-center">
                  <span class="small text-muted"><i class="bi bi-credit-card me-1"></i>Método:</span>
                  <span class="small fw-bold">{{ metodosPago.find(m => m.id === formVenta.metodo_pago_id)?.nombre_metodo }}</span>
                </div>
              </div>

            </div>
          </div>
          
          <div class="alert alert-warning border-0 shadow-sm rounded-4 small py-3" v-if="step < 3">
            <i class="bi bi-lightbulb-fill me-2"></i> Complete la selección de cliente y propiedad para configurar los términos de pago.
          </div>
        </div>
      </div>
    </div>
  </div>

  <ClienteModal @cliente-creado="alCrearCliente" />
</template>

<style scoped>
.animate-fade { animation: fadeIn 0.4s ease-in-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.extra-small { font-size: 0.75rem; }

/* Indicador de pasos moderno */
.step-item {
  display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2;
  color: #adb5bd; transition: all 0.3s ease;
}
.step-item.active { color: var(--primary-color); }
.step-item.active .step-number { background-color: var(--primary-color); color: white; border-color: var(--primary-color); }

.step-number {
  width: 35px; height: 35px; border-radius: 50%; border: 2px solid #e9ecef;
  display: flex; align-items: center; justify-content: center; font-weight: bold;
  background-color: white; margin-bottom: 5px; transition: all 0.3s ease;
}

.step-label { font-size: 0.75rem; font-weight: 700; text-uppercase: uppercase; }

.step-connector {
  flex-grow: 1; height: 3px; background-color: #e9ecef; margin: 0 10px; margin-bottom: 20px;
  border-radius: 2px; transition: all 0.3s ease;
}
.step-connector.active { background-color: var(--primary-color); opacity: 0.5; }

/* Custom Radio */
.custom-radio .form-check-input:checked {
  background-color: var(--primary-color); border-color: var(--primary-color);
}
.custom-radio .form-check-label { cursor: pointer; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 10px; }

.sticky-top { transition: all 0.3s ease; }

@media (max-width: 991.98px) {
  .sticky-top { position: relative !important; top: 0 !important; }
}
</style>
