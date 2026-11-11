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

const desde    = ref(primerDiaMes)
const hasta    = ref(hoy)
const asesorId = ref('')
const perPage  = ref(15)
const pagina   = ref(1)

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
const ranking  = ref([])
const grafico  = ref([])
const ventas   = ref(null)
const asesores = ref([])

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const fmt = (v) => `${simbolo.value} ` + (parseFloat(v)||0).toLocaleString('es-BO', { minimumFractionDigits: 2 })

const fmtFecha = (v) => {
  if (!v) return '-'
  const [y, m, d] = String(v).slice(0, 10).split('-')
  return d + '/' + m + '/' + y
}

const labelMes = (anio, mes) => MESES[Number(mes) - 1] + ' ' + anio

const pctMora = (r) => r.cartera_vigente > 0
  ? ((r.mora / r.cartera_vigente) * 100).toFixed(1)
  : '0.0'

const moraBadgeClass = (r) => {
  const p = parseFloat(pctMora(r))
  if (p > 20) return 'text-bg-danger'
  if (p > 5)  return 'text-bg-warning'
  return 'text-bg-success'
}

const medalEmoji = (i) => ['🥇', '🥈', '🥉'][i] ?? (i + 1) + '°'

// ─── Carga ────────────────────────────────────────────────────────────────────
async function cargar(resetPagina = true) {
  consulta?.abort()
  const actual = new AbortController()
  consulta = actual
  errorCarga.value = ''
  if (resetPagina) pagina.value = 1
  cargando.value = true
  try {
    const params = {
      desde:    desde.value,
      hasta:    hasta.value,
      page:     pagina.value,
      per_page: perPage.value,
    }
    if (asesorId.value) params.asesor_id = asesorId.value

    params.moneda = moneda.value
    const { data } = await api.get('/reportes/desempeno-asesores', { params, signal: actual.signal })
    permiteMoneda.value = Boolean(data.moneda)
    kpis.value     = data.kpis
    ranking.value  = data.ranking  ?? []
    grafico.value  = data.grafico  ?? []
    ventas.value   = data.ventas
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
watch([desde, hasta, asesorId, moneda], () => cargar())

// ─── Exportar ────────────────────────────────────────────────────────────────
async function exportar(tipo) {
  const flag = tipo === 'pdf' ? exportandoPdf : exportandoXls
  flag.value = true
  try {
    const params = { moneda: moneda.value, desde: desde.value, hasta: hasta.value }
    if (asesorId.value) params.asesor_id = asesorId.value

    const res  = await api.get('/reportes/desempeno-asesores/' + tipo, { params, responseType: 'blob' })
    const ext  = tipo === 'pdf' ? '.pdf' : '.xlsx'
    const mime = tipo === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const url  = URL.createObjectURL(new Blob([res.data], { type: mime }))
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'desempeno-asesores-' + desde.value + '-al-' + hasta.value + ext
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error(e)
    alert('Error al generar el archivo.')
  } finally {
    flag.value = false
  }
}

// ─── Gráfico ranking horizontal ───────────────────────────────────────────────
const chartRankingData = computed(() => {
  const top = ranking.value.filter(r => r.monto_vendido > 0).slice(0, 10)
  if (!top.length) return null
  return {
    labels: top.map(r => r.nombre),
    datasets: [
      {
        label: `Monto Vendido (${simbolo.value})`,
        data:  top.map(r => r.monto_vendido),
        backgroundColor: 'rgba(59,130,246,0.75)',
        borderRadius: 4,
      },
      {
        label: `Cobrado (${simbolo.value})`,
        data:  top.map(r => r.cobrado),
        backgroundColor: 'rgba(34,197,94,0.7)',
        borderRadius: 4,
      },
    ],
  }
})

const chartRankingOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    tooltip: { callbacks: { label: ctx => ` ${simbolo.value} ` + ctx.parsed.x.toLocaleString('es-BO', { minimumFractionDigits: 2 }) } },
  },
  scales: {
    x: { beginAtZero: true, ticks: { callback: v => `${simbolo.value} ` + Number(v).toLocaleString('es-BO') } },
  },
}

// ─── Gráfico ventas por mes ────────────────────────────────────────────────────
const chartMesData = computed(() => {
  if (!grafico.value?.length) return null
  return {
    labels: grafico.value.map(g => labelMes(g.anio, g.mes)),
    datasets: [{
      label: `Ventas (${simbolo.value})`,
      data:  grafico.value.map(g => parseFloat(g.total)),
      backgroundColor: 'rgba(99,102,241,0.7)',
      borderRadius: 4,
    }],
  }
})

const chartMesOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: ctx => ` ${simbolo.value} ` + ctx.parsed.y.toLocaleString('es-BO', { minimumFractionDigits: 2 }) } },
  },
  scales: {
    y: { beginAtZero: true, ticks: { callback: v => `${simbolo.value} ` + Number(v).toLocaleString('es-BO') } },
  },
}

// ─── Paginación ───────────────────────────────────────────────────────────────
const paginas = computed(() => {
  if (!ventas.value) return []
  const total  = ventas.value.last_page
  const actual = ventas.value.current_page
  const rango  = []
  for (let i = Math.max(1, actual - 2); i <= Math.min(total, actual + 2); i++) rango.push(i)
  return rango
})
</script>

<template>
  <div class="reporte-desempeno">

    <!-- ── Cabecera ─────────────────────────────────────────────────────── -->
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
      <div>
        <h5 class="fw-bold mb-1" style="color:var(--text-main)">
          <i class="bi bi-person-badge text-primary me-2"></i>Desempeño Asesores
        </h5>
        <p class="text-muted small mb-0">Ranking de productividad, ventas y cartera por asesor</p>
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
        <label class="form-label small fw-semibold mb-1">Desde</label>
        <input type="date" class="form-control form-control-sm" v-model="desde" :max="hasta" />
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Hasta</label>
        <input type="date" class="form-control form-control-sm" v-model="hasta" :min="desde" :max="hoy" />
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Asesor</label>
        <select class="form-select form-select-sm" v-model="asesorId" style="min-width:200px;">
          <option value="">Todos los asesores</option>
          <option v-for="a in asesores" :key="a.id" :value="a.id">{{ a.nombre_completo }}</option>
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
      <button v-if="asesorId" class="btn btn-sm btn-outline-secondary" @click="asesorId=''">
        <i class="bi bi-x me-1"></i> Ver todos
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
            <div class="kpi-icon" style="background:#fffbeb;color:#b45309;">
              <i class="bi bi-trophy"></i>
            </div>
            <div class="ms-3 min-w-0">
              <div class="kpi-label">Top Asesor</div>
              <div class="kpi-value text-truncate" style="color:#b45309;font-size:.95rem;">
                {{ kpis.top_asesor?.nombre ?? 'Sin datos' }}
              </div>
              <div class="kpi-sub" v-if="kpis.top_asesor">{{ fmt(kpis.top_asesor.monto) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#eff6ff;color:#2563eb;"><i class="bi bi-graph-up"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Total Vendido</div>
              <div class="kpi-value" style="color:#2563eb;">{{ fmt(kpis.total_vendido) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#f0fdf4;color:#15803d;"><i class="bi bi-arrow-down-circle"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Total Cobrado</div>
              <div class="kpi-value text-success">{{ fmt(kpis.total_cobrado) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fdf4ff;color:#7c3aed;"><i class="bi bi-cash-coin"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Comisiones Est.</div>
              <div class="kpi-value" style="color:#7c3aed;">{{ fmt(kpis.total_comisiones) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#f0f9ff;color:#0369a1;"><i class="bi bi-people"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Con Ventas</div>
              <div class="kpi-value" style="color:#0369a1;">
                {{ kpis.asesores_con_ventas }}
                <small class="text-muted fw-normal" style="font-size:.75rem;"> / {{ kpis.total_asesores }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Gráficos ──────────────────────────────────────────────────── -->
      <div class="row g-3 mb-4">
        <!-- Ranking horizontal -->
        <div class="col-12 col-lg-7">
          <div class="chart-card h-100">
            <h6 class="fw-semibold mb-3" style="color:var(--text-main)">
              <i class="bi bi-bar-chart-horizontal me-2 text-primary"></i>Ranking por Monto Vendido
            </h6>
            <div v-if="chartRankingData" :style="{ height: Math.max(180, ranking.filter(r=>r.monto_vendido>0).length * 40) + 'px' }">
              <Bar :data="chartRankingData" :options="chartRankingOptions" />
            </div>
            <div v-else class="text-center text-muted py-4">
              <i class="bi bi-inbox fs-3 opacity-25"></i>
              <p class="small mt-2">Sin ventas en el período</p>
            </div>
          </div>
        </div>

        <!-- Ventas por mes -->
        <div class="col-12 col-lg-5">
          <div class="chart-card h-100">
            <h6 class="fw-semibold mb-3" style="color:var(--text-main)">
              <i class="bi bi-bar-chart me-2 text-indigo"></i>Ventas por Mes
            </h6>
            <div v-if="chartMesData" style="height:220px;">
              <Bar :data="chartMesData" :options="chartMesOptions" />
            </div>
            <div v-else class="text-center text-muted py-4">
              <i class="bi bi-inbox fs-3 opacity-25"></i>
              <p class="small mt-2">Sin datos</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Tabla Ranking ─────────────────────────────────────────────── -->
      <div class="list-card mb-4">
        <h6 class="fw-semibold mb-3" style="color:var(--text-main)">
          <i class="bi bi-table me-2"></i>Tabla de Ranking
        </h6>
        <div class="table-responsive">
          <table class="table table-hover table-sm align-middle mb-0">
            <thead class="table-header">
              <tr>
                <th class="text-center" style="width:50px;">Pos.</th>
                <th>Asesor</th>
                <th class="text-center">Ventas #</th>
                <th class="text-end">Monto Vendido</th>
                <th class="text-end">Cobrado</th>
                <th class="text-end">Comisión Est.</th>
                <th class="text-end">Cartera Vigente</th>
                <th class="text-end">Mora</th>
                <th class="text-center">% Mora</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!ranking.length">
                <td colspan="9" class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-4 d-block mb-2 opacity-50"></i>
                  Sin asesores activos.
                </td>
              </tr>
              <tr v-for="(r, i) in ranking" :key="r.id"
                  :class="{ 'table-warning-subtle': i === 0 && r.monto_vendido > 0 }">
                <td class="text-center fw-bold" style="font-size:1.1rem;">{{ medalEmoji(i) }}</td>
                <td>
                  <div class="fw-semibold">{{ r.nombre }}</div>
                  <div class="text-muted" style="font-size:.75rem;">{{ r.telefono }}</div>
                </td>
                <td class="text-center">
                  <span class="badge rounded-pill text-bg-primary">{{ r.ventas_cantidad }}</span>
                </td>
                <td class="text-end fw-bold text-nowrap" style="color:#2563eb;">{{ fmt(r.monto_vendido) }}</td>
                <td class="text-end text-nowrap text-success">{{ fmt(r.cobrado) }}</td>
                <td class="text-end text-nowrap" style="color:#7c3aed;">{{ fmt(r.comision_estimada) }}</td>
                <td class="text-end text-nowrap text-muted">{{ fmt(r.cartera_vigente) }}</td>
                <td class="text-end text-nowrap text-danger">{{ fmt(r.mora) }}</td>
                <td class="text-center">
                  <span v-if="r.cartera_vigente > 0" class="badge rounded-pill" :class="moraBadgeClass(r)">
                    {{ pctMora(r) }}%
                  </span>
                  <span v-else class="text-muted small">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Tabla Detalle de Ventas ────────────────────────────────────── -->
      <div class="list-card">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h6 class="fw-semibold mb-0" style="color:var(--text-main)">
            Detalle de Ventas
            <span class="badge bg-secondary ms-2" style="font-size:.75rem;">{{ ventas?.total ?? 0 }} registros</span>
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
                <th>Asesor</th>
                <th>Cliente</th>
                <th>Propiedad</th>
                <th class="text-center">Tipo</th>
                <th class="text-end">Monto Total</th>
                <th class="text-end">Cobrado</th>
                <th class="text-end">Comisión</th>
                <th class="text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!ventas?.data?.length">
                <td colspan="10" class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-4 d-block mb-2 opacity-50"></i>
                  No hay ventas en el período seleccionado.
                </td>
              </tr>
              <tr v-for="v in ventas?.data" :key="v.id">
                <td class="text-nowrap">{{ fmtFecha(v.fecha) }}</td>
                <td><span class="badge bg-light text-dark border">#{{ v.id }}</span></td>
                <td class="fw-medium">{{ v.asesor?.nombre_completo ?? '-' }}</td>
                <td>{{ v.cliente?.nombre_completo ?? '-' }}</td>
                <td>
                  <span class="badge bg-light text-secondary border" v-if="v.propiedad?.codigo">{{ v.propiedad.codigo }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td class="text-center">
                  <span class="badge rounded-pill"
                    :class="v.tipo_venta === 'Contado' ? 'text-bg-success' : 'text-bg-warning'">
                    {{ v.tipo_venta }}
                  </span>
                </td>
                <td class="text-end fw-bold text-nowrap" style="color:#2563eb;">{{ fmt(v.monto_total) }}</td>
                <td class="text-end text-nowrap text-success">{{ fmt(v.cobrado) }}</td>
                <td class="text-end text-nowrap" style="color:#7c3aed;">{{ fmt(v.monto_comision) }}</td>
                <td class="text-center">
                  <span class="badge rounded-pill"
                    :class="v.estado === 'Anulada' ? 'text-bg-danger' : 'text-bg-success'">
                    {{ v.estado }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <nav v-if="ventas && ventas.last_page > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <small class="text-muted">Mostrando {{ ventas.from }}–{{ ventas.to }} de {{ ventas.total }}</small>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: ventas.current_page === 1 }">
              <button class="page-link" @click="cambiarPagina(ventas.current_page - 1)"><i class="bi bi-chevron-left"></i></button>
            </li>
            <li v-for="p in paginas" :key="p" class="page-item" :class="{ active: p === ventas.current_page }">
              <button class="page-link" @click="cambiarPagina(p)">{{ p }}</button>
            </li>
            <li class="page-item" :class="{ disabled: ventas.current_page === ventas.last_page }">
              <button class="page-link" @click="cambiarPagina(ventas.current_page + 1)"><i class="bi bi-chevron-right"></i></button>
            </li>
          </ul>
        </nav>
      </div>

    </template>
  </div>

  <ModalEnviarInforme
    v-model="mostrarModalEnvio"
    reporte="desempeno-asesores"
    titulo="Desempeño de Asesores"
    :params="{ moneda, desde: desde, hasta: hasta, asesor_id: asesorId }"
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

.kpi-sub { font-size: 0.72rem; color: #9ca3af; margin-top: 1px; }

.chart-card, .list-card {
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

.table td { font-size: 0.875rem; color: var(--text-main, #374151); }
.table-warning-subtle { background: #fffbeb !important; }
.text-indigo { color: #6366f1; }
.min-w-0 { min-width: 0; }
</style>
