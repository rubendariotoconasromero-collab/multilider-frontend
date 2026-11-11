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
const asesorId   = ref('')
const desde      = ref('')
const hasta      = ref('')
const pagina     = ref(1)
const perPage    = ref(15)

const cargando          = ref(false)
const errorCarga = ref('')
let consulta
const moneda = ref('BOB')
const permiteMoneda = ref(false)
const simbolo = computed(() => moneda.value === 'USD' ? 'USD' : 'Bs.')
const exportandoPdf     = ref(false)
const exportandoXls     = ref(false)
const mostrarModalEnvio = ref(false)

const kpis     = ref(null)
const aging    = ref([])
const cuotas   = ref(null)
const asesores = ref([])

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v) => {
  const n = parseFloat(v) || 0
  return `${simbolo.value} ` + n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtFecha = (v) => {
  if (!v) return '-'
  const [y, m, d] = String(v).slice(0, 10).split('-')
  return d + '/' + m + '/' + y
}

const tramoBadgeClass = (tramo) => {
  const map = {
    '1-30 días':  'bg-warning text-dark',
    '31-60 días': 'bg-orange text-white',
    '61-90 días': 'bg-danger',
    '+90 días':   'bg-purple text-white',
  }
  return map[tramo] ?? 'bg-secondary'
}

const tramoColor = (tramo) => {
  const map = {
    '1-30 días':  'rgba(250,204,21,0.75)',
    '31-60 días': 'rgba(249,115,22,0.75)',
    '61-90 días': 'rgba(239,68,68,0.75)',
    '+90 días':   'rgba(168,85,247,0.75)',
  }
  return map[tramo] ?? 'rgba(107,114,128,0.6)'
}

// ─── Carga ────────────────────────────────────────────────────────────────────
async function cargar(resetPagina = true) {
  consulta?.abort()
  const actual = new AbortController()
  consulta = actual
  errorCarga.value = ''
  if (resetPagina) pagina.value = 1
  cargando.value = true
  try {
    const params = { page: pagina.value, per_page: perPage.value }
    if (asesorId.value) params.asesor_id = asesorId.value
    if (desde.value)   params.desde      = desde.value
    if (hasta.value)   params.hasta      = hasta.value

    params.moneda = moneda.value
    const { data } = await api.get('/reportes/cartera-mora', { params, signal: actual.signal })
    permiteMoneda.value = Boolean(data.moneda)
    kpis.value     = data.kpis
    aging.value    = data.aging
    cuotas.value   = data.cuotas
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
watch([asesorId, desde, hasta, moneda], () => cargar())

// ─── Exportar ────────────────────────────────────────────────────────────────
async function exportar(tipo) {
  const flag = tipo === 'pdf' ? exportandoPdf : exportandoXls
  flag.value = true
  try {
    const params = { moneda: moneda.value }
    if (asesorId.value) params.asesor_id = asesorId.value
    if (desde.value)   params.desde      = desde.value
    if (hasta.value)   params.hasta      = hasta.value

    const res = await api.get('/reportes/cartera-mora/' + tipo, {
      params,
      responseType: 'blob',
    })
    const ext  = tipo === 'pdf' ? '.pdf' : '.xlsx'
    const mime = tipo === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const url  = URL.createObjectURL(new Blob([res.data], { type: mime }))
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'cartera-mora-' + new Date().toISOString().slice(0, 10) + ext
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error(e)
    alert('Error al generar el archivo. Intente nuevamente.')
  } finally {
    flag.value = false
  }
}

// ─── Gráfico Aging ───────────────────────────────────────────────────────────
const chartData = computed(() => {
  if (!aging.value?.length) return null
  return {
    labels: aging.value.map(t => t.label),
    datasets: [
      {
        label: `Monto Vencido (${simbolo.value})`,
        data: aging.value.map(t => t.monto),
        backgroundColor: aging.value.map(t => tramoColor(t.label)),
        borderRadius: 5,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: ctx => ` ${simbolo.value} ` + ctx.parsed.y.toLocaleString('es-BO', { minimumFractionDigits: 2 }),
        afterLabel: (ctx) => {
          const t = aging.value[ctx.dataIndex]
          return t ? '  ' + t.count + ' cuotas  |  ' + t.clientes + ' clientes' : ''
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { callback: v => `${simbolo.value} ` + Number(v).toLocaleString('es-BO') },
    },
  },
}

// ─── Paginación ───────────────────────────────────────────────────────────────
const paginas = computed(() => {
  if (!cuotas.value) return []
  const total  = cuotas.value.last_page
  const actual = cuotas.value.current_page
  const rango  = []
  for (let i = Math.max(1, actual - 2); i <= Math.min(total, actual + 2); i++) rango.push(i)
  return rango
})

// ─── % mora sobre cartera ────────────────────────────────────────────────────
const pctMora = computed(() => {
  if (!kpis.value || !kpis.value.cartera_total) return 0
  return ((kpis.value.monto_vencido / kpis.value.cartera_total) * 100).toFixed(1)
})
</script>

<template>
  <div class="reporte-cartera">

    <!-- ── Cabecera ─────────────────────────────────────────────────────── -->
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
      <div>
        <h5 class="fw-bold mb-1" style="color:var(--text-main)">
          <i class="bi bi-exclamation-triangle text-danger me-2"></i>Cartera y Mora
        </h5>
        <p class="text-muted small mb-0">Análisis de cartera crediticia activa y cuotas vencidas</p>
      </div>
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
        <label class="form-label small fw-semibold mb-1">Asesor</label>
        <select class="form-select form-select-sm" v-model="asesorId" style="min-width:180px;">
          <option value="">Todos los asesores</option>
          <option v-for="a in asesores" :key="a.id" :value="a.id">{{ a.nombre_completo }}</option>
        </select>
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Vencimiento desde</label>
        <input type="date" class="form-control form-control-sm" v-model="desde" />
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Vencimiento hasta</label>
        <input type="date" class="form-control form-control-sm" v-model="hasta" />
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
      <button v-if="desde || hasta || asesorId" class="btn btn-sm btn-outline-secondary" @click="asesorId='';desde='';hasta=''">
        <i class="bi bi-x me-1"></i> Limpiar
      </button>
    </div>

    <!-- ── Spinner ───────────────────────────────────────────────────────── -->
    <div v-if="errorCarga" class="alert alert-danger" role="alert">{{ errorCarga }}</div>
    <div v-if="cargando" class="text-center py-5">
      <div class="spinner-border text-danger" role="status"></div>
      <p class="text-muted mt-2 small">Cargando datos...</p>
    </div>

    <template v-if="!cargando && kpis">

      <!-- ── KPI Cards ─────────────────────────────────────────────────── -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-lg-3">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#eff6ff;color:#2563eb;"><i class="bi bi-bank"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Cartera Total Activa</div>
              <div class="kpi-value" style="color:#2563eb;">{{ fmt(kpis.cartera_total) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fef2f2;color:#dc2626;"><i class="bi bi-exclamation-circle"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Monto Vencido</div>
              <div class="kpi-value text-danger">{{ fmt(kpis.monto_vencido) }}</div>
              <div class="kpi-sub text-danger">{{ pctMora }}% de la cartera</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fff7ed;color:#ea580c;"><i class="bi bi-people"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Clientes en Mora</div>
              <div class="kpi-value" style="color:#ea580c;">{{ kpis.clientes_en_mora }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fef9c3;color:#ca8a04;"><i class="bi bi-calendar-x"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Cuotas Vencidas</div>
              <div class="kpi-value" style="color:#ca8a04;">{{ kpis.cuotas_vencidas_count }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Aging + Gráfico ───────────────────────────────────────────── -->
      <div class="row g-3 mb-4">

        <!-- Tabla Aging -->
        <div class="col-12 col-lg-6">
          <div class="list-card h-100">
            <h6 class="fw-semibold mb-3" style="color:var(--text-main)">
              <i class="bi bi-bar-chart-steps me-2 text-danger"></i>Análisis de Mora (Aging)
            </h6>
            <table class="table table-sm align-middle mb-0">
              <thead class="table-header">
                <tr>
                  <th>Tramo</th>
                  <th class="text-center">Cuotas</th>
                  <th class="text-center">Clientes</th>
                  <th class="text-end">Monto ({{ simbolo }})</th>
                  <th class="text-center">% Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!aging.length">
                  <td colspan="5" class="text-center text-muted py-3">Sin cuotas vencidas</td>
                </tr>
                <tr v-for="t in aging" :key="t.label">
                  <td>
                    <span class="tramo-dot" :style="{ background: tramoColor(t.label) }"></span>
                    <span class="fw-semibold">{{ t.label }}</span>
                  </td>
                  <td class="text-center">{{ t.count }}</td>
                  <td class="text-center">{{ t.clientes }}</td>
                  <td class="text-end fw-semibold text-nowrap">{{ fmt(t.monto) }}</td>
                  <td class="text-center">
                    <div class="d-flex align-items-center gap-1 justify-content-center">
                      <div class="progress flex-grow-1" style="height:6px;max-width:60px;">
                        <div class="progress-bar"
                          :style="{ width: (kpis.monto_vencido > 0 ? (t.monto / kpis.monto_vencido * 100) : 0) + '%', background: tramoColor(t.label) }">
                        </div>
                      </div>
                      <small class="text-nowrap">
                        {{ kpis.monto_vencido > 0 ? (t.monto / kpis.monto_vencido * 100).toFixed(0) : 0 }}%
                      </small>
                    </div>
                  </td>
                </tr>
                <!-- Totales -->
                <tr v-if="aging.length" class="fw-bold border-top">
                  <td>Total</td>
                  <td class="text-center">{{ kpis.cuotas_vencidas_count }}</td>
                  <td class="text-center">{{ kpis.clientes_en_mora }}</td>
                  <td class="text-end text-nowrap">{{ fmt(kpis.monto_vencido) }}</td>
                  <td class="text-center">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Gráfico -->
        <div class="col-12 col-lg-6">
          <div class="chart-card h-100">
            <h6 class="fw-semibold mb-3" style="color:var(--text-main)">
              <i class="bi bi-bar-chart me-2 text-warning"></i>Distribución por Tramo
            </h6>
            <div style="height:220px;" v-if="chartData">
              <Bar :data="chartData" :options="chartOptions" />
            </div>
            <div v-else class="text-center text-muted py-4">
              <i class="bi bi-inbox fs-3 opacity-25"></i>
              <p class="small mt-2">Sin datos</p>
            </div>
          </div>
        </div>

      </div>

      <!-- ── Tabla detalle cuotas vencidas ─────────────────────────────── -->
      <div class="list-card">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h6 class="fw-semibold mb-0" style="color:var(--text-main)">
            Detalle de Cuotas Vencidas
            <span class="badge bg-danger ms-2" style="font-size:.75rem;">
              {{ cuotas?.total ?? 0 }} registros
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
                <th>Cliente</th>
                <th>Asesor</th>
                <th class="text-center">N° Cuota</th>
                <th class="text-center">Vencimiento</th>
                <th class="text-center">Días Mora</th>
                <th class="text-center">Tramo</th>
                <th class="text-end">Monto Cuota</th>
                <th class="text-end">Saldo Capital</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!cuotas?.data?.length">
                <td colspan="8" class="text-center text-muted py-4">
                  <i class="bi bi-check-circle fs-4 d-block mb-2 text-success opacity-50"></i>
                  No hay cuotas vencidas con los filtros seleccionados.
                </td>
              </tr>
              <tr v-for="c in cuotas?.data" :key="c.id">
                <td class="fw-medium">{{ c.cliente }}</td>
                <td class="text-muted">{{ c.asesor }}</td>
                <td class="text-center">
                  <span class="badge bg-light text-dark border">N° {{ c.numero_cuota }}</span>
                </td>
                <td class="text-center text-nowrap">{{ fmtFecha(c.fecha_vencimiento) }}</td>
                <td class="text-center">
                  <span class="fw-bold" :class="{
                    'text-warning': c.dias_mora <= 30,
                    'text-orange':  c.dias_mora > 30 && c.dias_mora <= 60,
                    'text-danger':  c.dias_mora > 60
                  }">{{ c.dias_mora }} días</span>
                </td>
                <td class="text-center">
                  <span class="badge rounded-pill tramo-badge" :data-tramo="c.tramo">{{ c.tramo }}</span>
                </td>
                <td class="text-end fw-semibold text-nowrap text-danger">{{ fmt(c.monto_cuota) }}</td>
                <td class="text-end text-nowrap text-muted">{{ fmt(c.saldo_capital) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <nav v-if="cuotas && cuotas.last_page > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <small class="text-muted">
            Mostrando {{ cuotas.from }}–{{ cuotas.to }} de {{ cuotas.total }}
          </small>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: cuotas.current_page === 1 }">
              <button class="page-link" @click="cambiarPagina(cuotas.current_page - 1)">
                <i class="bi bi-chevron-left"></i>
              </button>
            </li>
            <li v-for="p in paginas" :key="p" class="page-item" :class="{ active: p === cuotas.current_page }">
              <button class="page-link" @click="cambiarPagina(p)">{{ p }}</button>
            </li>
            <li class="page-item" :class="{ disabled: cuotas.current_page === cuotas.last_page }">
              <button class="page-link" @click="cambiarPagina(cuotas.current_page + 1)">
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
    reporte="cartera-mora"
    titulo="Cartera y Mora"
    :params="{ moneda, asesor_id: asesorId, desde: desde, hasta: hasta }"
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
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-main, #111827);
  line-height: 1.2;
}

.kpi-sub {
  font-size: 0.72rem;
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

.tramo-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
}

/* Colores para tramos */
.tramo-badge[data-tramo="1-30 días"]  { background: #fef9c3; color: #713f12; }
.tramo-badge[data-tramo="31-60 días"] { background: #fed7aa; color: #7c2d12; }
.tramo-badge[data-tramo="61-90 días"] { background: #fecaca; color: #7f1d1d; }
.tramo-badge[data-tramo="+90 días"]   { background: #e9d5ff; color: #4c1d95; }

.text-orange { color: #ea580c !important; }
.bg-orange   { background-color: #ea580c !important; }
.bg-purple   { background-color: #7c3aed !important; }
</style>
