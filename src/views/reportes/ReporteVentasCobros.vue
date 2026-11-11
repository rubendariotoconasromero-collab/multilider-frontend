<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale,
} from 'chart.js'
import api from '@/api/axios'
import ModalEnviarInforme from '@/components/ModalEnviarInforme.vue'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// ─── Estado ──────────────────────────────────────────────────────────────────
const hoy          = new Date().toISOString().slice(0, 10)
const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const desde     = ref(primerDiaMes)
const hasta     = ref(hoy)
const tipoVenta = ref('Todos')
const asesorId  = ref('')
const estadoFiltro = ref('Todos')
const pagina    = ref(1)
const perPage   = ref(15)

const cargando           = ref(false)
const errorCarga = ref('')
let consulta
const moneda = ref('BOB')
const permiteMoneda = ref(false)
const simbolo = computed(() => moneda.value === 'USD' ? 'USD' : 'Bs.')
const exportandoPdf      = ref(false)
const exportandoXls      = ref(false)
const mostrarModalEnvio  = ref(false)

const kpis     = ref(null)
const grafico  = ref(null)
const notas    = ref(null)
const asesores = ref([])

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const fmt = (v) => {
  const n = parseFloat(v) || 0
  return `${simbolo.value} ` + n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtFecha = (v) => {
  if (!v) return '-'
  const [y, m, d] = String(v).slice(0, 10).split('-')
  return d + '/' + m + '/' + y
}

const labelMes = (anio, mes) => MESES[Number(mes) - 1] + ' ' + anio

// ─── Carga de datos ───────────────────────────────────────────────────────────
async function cargar(resetPagina = true) {
  consulta?.abort()
  const actual = new AbortController()
  consulta = actual
  errorCarga.value = ''
  if (resetPagina) pagina.value = 1
  cargando.value = true
  try {
    const params = {
      desde:      desde.value,
      hasta:      hasta.value,
      tipo_venta: tipoVenta.value,
      estado:     estadoFiltro.value,
      page:       pagina.value,
      per_page:   perPage.value,
    }
    if (asesorId.value) params.asesor_id = asesorId.value

    params.moneda = moneda.value
    const { data } = await api.get('/reportes/ventas-cobros', { params, signal: actual.signal })
    permiteMoneda.value = Boolean(data.moneda)
    kpis.value     = data.kpis
    grafico.value  = data.grafico
    notas.value    = data.notas
    asesores.value = data.asesores ?? []
  } catch (e) {
    if (actual.signal.aborted) return
    kpis.value = null
    errorCarga.value = e?.response?.data?.message ?? 'No se pudo cargar el reporte.'
  } finally {
    if (consulta === actual) cargando.value = false
  }
}

async function cambiarPagina(p) {
  pagina.value = p
  await cargar(false)
}

onMounted(() => cargar())
watch([desde, hasta, tipoVenta, asesorId, estadoFiltro, moneda], () => cargar())

// ─── Exportar ─────────────────────────────────────────────────────────────────
function buildParams() {
  const p = new URLSearchParams({ desde: desde.value, hasta: hasta.value })
  p.set('moneda', moneda.value)
  if (tipoVenta.value !== 'Todos')  p.append('tipo_venta', tipoVenta.value)
  if (estadoFiltro.value !== 'Todos') p.append('estado', estadoFiltro.value)
  if (asesorId.value) p.append('asesor_id', asesorId.value)
  return p
}

async function exportar(tipo) {
  const flag = tipo === 'pdf' ? exportandoPdf : exportandoXls
  flag.value = true
  try {
    const res = await api.get('/reportes/ventas-cobros/' + tipo, {
      params:       Object.fromEntries(buildParams()),
      responseType: 'blob',
    })
    const ext  = tipo === 'pdf' ? '.pdf' : '.xlsx'
    const mime = tipo === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const url  = URL.createObjectURL(new Blob([res.data], { type: mime }))
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'ventas-cobros-' + desde.value + '-al-' + hasta.value + ext
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error(e)
    alert('Error al generar el archivo. Intente nuevamente.')
  } finally {
    flag.value = false
  }
}

// ─── Gráfico ──────────────────────────────────────────────────────────────────
const chartData = computed(() => {
  if (!grafico.value) return null

  const ventas = grafico.value.ventas ?? []
  const cobros = grafico.value.cobros ?? []

  // Construir set de labels unificado
  const labelsSet = new Set()
  ventas.forEach(v => labelsSet.add(labelMes(v.anio, v.mes)))
  cobros.forEach(c => labelsSet.add(labelMes(c.anio, c.mes)))
  const labels = Array.from(labelsSet)

  const ventasData = labels.map(l => {
    const found = ventas.find(v => labelMes(v.anio, v.mes) === l)
    return found ? parseFloat(found.total) : 0
  })
  const cobrosData = labels.map(l => {
    const found = cobros.find(c => labelMes(c.anio, c.mes) === l)
    return found ? parseFloat(found.total) : 0
  })

  return {
    labels,
    datasets: [
      {
        label: `Ventas (${simbolo.value})`,
        data: ventasData,
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 4,
      },
      {
        label: `Cobrado (${simbolo.value})`,
        data: cobrosData,
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderRadius: 4,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    tooltip: {
      callbacks: {
        label: ctx => ` ${simbolo.value} ` + ctx.parsed.y.toLocaleString('es-BO', { minimumFractionDigits: 2 }),
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: v => `${simbolo.value} ` + Number(v).toLocaleString('es-BO'),
      },
    },
  },
}

// ─── Paginación ───────────────────────────────────────────────────────────────
const paginas = computed(() => {
  if (!notas.value) return []
  const total = notas.value.last_page
  const actual = notas.value.current_page
  const rango = []
  for (let i = Math.max(1, actual - 2); i <= Math.min(total, actual + 2); i++) {
    rango.push(i)
  }
  return rango
})
</script>

<template>
  <div class="reporte-ventas">

    <!-- ── Cabecera ─────────────────────────────────────────────────────── -->
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
      <div>
        <h5 class="fw-bold mb-1" style="color:var(--text-main)">
          <i class="bi bi-graph-up-arrow text-success me-2"></i>Ventas y Cobros
        </h5>
        <p class="text-muted small mb-0">Resumen de ventas realizadas y cobros recibidos en el período</p>
      </div>

      <!-- Botones de exportación -->
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-sm btn-outline-danger" @click="exportar('pdf')" :disabled="exportandoPdf || cargando">
          <span v-if="exportandoPdf" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-file-earmark-pdf me-1"></i> PDF
        </button>
        <button class="btn btn-sm btn-outline-success" @click="exportar('excel')" :disabled="exportandoXls || cargando">
          <span v-if="exportandoXls" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-file-earmark-excel me-1"></i> Excel
        </button>
        <button class="btn btn-sm btn-outline-primary" @click="mostrarModalEnvio = true" :disabled="cargando">
          <i class="bi bi-envelope-arrow-up me-1"></i> Enviar
        </button>
      </div>
    </div>

    <!-- ── Filtros ───────────────────────────────────────────────────────── -->
    <div class="filtros-bar d-flex flex-wrap gap-3 align-items-end mb-4 p-3 rounded-3">
      <div>
        <label class="form-label small fw-semibold mb-1">Desde</label>
        <input type="date" class="form-control form-control-sm" v-model="desde" :max="hasta" />
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Hasta</label>
        <input type="date" class="form-control form-control-sm" v-model="hasta" :min="desde" :max="hoy" />
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Tipo Venta</label>
        <select class="form-select form-select-sm" v-model="tipoVenta">
          <option value="Todos">Todos</option>
          <option value="Contado">Contado</option>
          <option value="Crédito">Crédito</option>
        </select>
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Asesor</label>
        <select class="form-select form-select-sm" v-model="asesorId" style="min-width:160px;">
          <option value="">Todos</option>
          <option v-for="a in asesores" :key="a.id" :value="a.id">{{ a.nombre_completo }}</option>
        </select>
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Estado</label>
        <select class="form-select form-select-sm" v-model="estadoFiltro">
          <option value="Todos">Todos</option>
          <option value="Activa">Activa</option>
          <option value="Anulada">Anulada</option>
        </select>
      </div>
      <div v-if="permiteMoneda">
        <label class="form-label small mb-1" for="moneda-reporte">Moneda</label>
        <select id="moneda-reporte" v-model="moneda" class="form-select form-select-sm">
          <option value="BOB">BOB</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <button class="btn btn-sm btn-primary" @click="cargar()" :disabled="cargando">
        <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
      </button>
    </div>

    <!-- ── Spinner ───────────────────────────────────────────────────────── -->
    <div v-if="errorCarga" class="alert alert-danger" role="alert">{{ errorCarga }}</div>
    <div v-if="cargando" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2 small">Cargando datos...</p>
    </div>

    <template v-if="!cargando && kpis">

      <!-- ── KPI Cards ─────────────────────────────────────────────────── -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#eff6ff;color:#2563eb;"><i class="bi bi-cash-stack"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Total Ventas</div>
              <div class="kpi-value">{{ fmt(kpis.total_ventas_monto) }}</div>
              <div class="kpi-sub">{{ kpis.total_ventas_cantidad }} operaciones</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#f0fdf4;color:#16a34a;"><i class="bi bi-bag-check"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Ventas Contado</div>
              <div class="kpi-value text-success">{{ fmt(kpis.ventas_contado_monto) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fffbeb;color:#d97706;"><i class="bi bi-credit-card"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Ventas Crédito</div>
              <div class="kpi-value text-warning">{{ fmt(kpis.ventas_credito_monto) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#f0fdf4;color:#15803d;"><i class="bi bi-arrow-down-circle"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Total Cobrado</div>
              <div class="kpi-value" style="color:#15803d;">{{ fmt(kpis.total_cobrado) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fff1f2;color:#be123c;"><i class="bi bi-hourglass-split"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Saldo por Cobrar</div>
              <div class="kpi-value text-danger">{{ fmt(kpis.total_ventas_monto - kpis.total_cobrado) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Gráfico ───────────────────────────────────────────────────── -->
      <div class="chart-card mb-4" v-if="chartData && chartData.labels.length">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="fw-semibold mb-0" style="color:var(--text-main)">Ventas vs Cobros por mes</h6>
        </div>
        <div style="height:280px;">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
      </div>

      <!-- ── Tabla de Notas ────────────────────────────────────────────── -->
      <div class="list-card">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h6 class="fw-semibold mb-0" style="color:var(--text-main)">
            Detalle de Ventas
            <span class="badge bg-secondary ms-2" style="font-size:.75rem;">
              {{ notas?.total ?? 0 }} registros
            </span>
          </h6>
          <div class="d-flex align-items-center gap-2">
            <label class="small text-muted mb-0">Por página:</label>
            <select class="form-select form-select-sm" style="width:70px;" v-model="perPage" @change="cargar()">
              <option :value="10">10</option>
              <option :value="15">15</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
            </select>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table table-hover table-sm align-middle mb-0">
            <thead class="table-header">
              <tr>
                <th>Fecha</th>
                <th>N° Nota</th>
                <th>Cliente</th>
                <th>Asesor</th>
                <th>Propiedad</th>
                <th>Tipo</th>
                <th class="text-end">Monto Total</th>
                <th class="text-end">Cobrado</th>
                <th class="text-end">Saldo</th>
                <th class="text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!notas?.data?.length">
                <td colspan="10" class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-4 d-block mb-2 opacity-50"></i>
                  No hay ventas en el período seleccionado.
                </td>
              </tr>
              <tr v-for="n in notas?.data" :key="n.id">
                <td class="text-nowrap">{{ fmtFecha(n.fecha) }}</td>
                <td><span class="badge bg-light text-dark border">#{{ n.id }}</span></td>
                <td>{{ n.cliente?.nombre_completo ?? '-' }}</td>
                <td>{{ n.asesor?.nombre_completo ?? '-' }}</td>
                <td>
                  <span class="badge bg-light text-secondary border" v-if="n.propiedad?.codigo">
                    {{ n.propiedad.codigo }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td>
                  <span class="badge rounded-pill px-2 py-1"
                    :class="n.tipo_venta === 'Contado' ? 'badge-contado' : 'badge-credito'">
                    {{ n.tipo_venta }}
                  </span>
                </td>
                <td class="text-end fw-semibold text-nowrap">{{ fmt(n.monto_total) }}</td>
                <td class="text-end text-success text-nowrap">{{ fmt(n.cobrado) }}</td>
                <td class="text-end text-danger text-nowrap">{{ fmt(n.saldo_credito) }}</td>
                <td class="text-center">
                  <span class="badge rounded-pill px-2 py-1"
                    :class="n.estado === 'Anulada' ? 'badge-anulada' : 'badge-activa'">
                    {{ n.estado }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <nav v-if="notas && notas.last_page > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <small class="text-muted">
            Mostrando {{ notas.from }}–{{ notas.to }} de {{ notas.total }}
          </small>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: notas.current_page === 1 }">
              <button class="page-link" @click="cambiarPagina(notas.current_page - 1)">
                <i class="bi bi-chevron-left"></i>
              </button>
            </li>
            <li v-for="p in paginas" :key="p" class="page-item" :class="{ active: p === notas.current_page }">
              <button class="page-link" @click="cambiarPagina(p)">{{ p }}</button>
            </li>
            <li class="page-item" :class="{ disabled: notas.current_page === notas.last_page }">
              <button class="page-link" @click="cambiarPagina(notas.current_page + 1)">
                <i class="bi bi-chevron-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      </div>

    </template>

  </div>

  <ModalEnviarInforme
    v-model="mostrarModalEnvio"
    reporte="ventas-cobros"
    titulo="Ventas y Cobros"
    :params="{ moneda, desde: desde, hasta: hasta, tipo_venta: tipoVenta, estado: estadoFiltro, asesor_id: asesorId }"
  />
</template>

<style scoped>
.filtros-bar {
  background: var(--bg-sidebar, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
}

.kpi-card {
  background: var(--bg-sidebar, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
}

.kpi-icon {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.kpi-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .03em;
  color: #6b7280;
  margin-bottom: 2px;
}

.kpi-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main, #111827);
  line-height: 1.2;
}

.kpi-sub {
  font-size: 0.72rem;
  color: #9ca3af;
  margin-top: 1px;
}

.chart-card,
.list-card {
  background: var(--bg-sidebar, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  padding: 20px;
}

.table-header th {
  background: #f8fafc;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .03em;
  color: #6b7280;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.table td {
  font-size: 0.875rem;
  color: var(--text-main, #374151);
}

/* Badges con Estilo "Soft" (Mejor contraste y sobriedad) */
.badge-contado {
  background-color: rgba(16, 185, 129, 0.12) !important; /* Verde Esmeralda Soft */
  color: #065f46 !important;
  font-weight: 700;
  border: 1px solid rgba(16, 185, 129, 0.3) !important;
  text-transform: uppercase;
}

.badge-credito {
  background-color: rgba(11, 37, 69, 0.08) !important; /* Navy Soft */
  color: #0B2545 !important;
  font-weight: 700;
  border: 1px solid rgba(11, 37, 69, 0.25) !important;
  text-transform: uppercase;
}

.badge-activa {
  background-color: rgba(100, 116, 139, 0.1) !important; /* Slate Soft */
  color: #334155 !important;
  font-weight: 700;
  border: 1px solid rgba(100, 116, 139, 0.2) !important;
}

.badge-anulada {
  background-color: rgba(185, 28, 28, 0.1) !important; /* Rojo Soft */
  color: #991b1b !important;
  font-weight: 700;
  border: 1px solid rgba(185, 28, 28, 0.2) !important;
}
</style>
