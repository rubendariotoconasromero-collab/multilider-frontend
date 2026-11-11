<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale,
  ArcElement,
} from 'chart.js'
import api from '@/api/axios'
import ModalEnviarInforme from '@/components/ModalEnviarInforme.vue'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement)

// ─── Estado ──────────────────────────────────────────────────────────────────
const hoy          = new Date().toISOString().slice(0, 10)
const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const desde    = ref(primerDiaMes)
const hasta    = ref(hoy)
const asesorId = ref('')
const estado   = ref('Todos')
const moneda   = ref('Todos')
const perPage  = ref(15)
const pagina   = ref(1)

const cargando          = ref(false)
const errorCarga = ref('')
let consulta
const exportandoPdf     = ref(false)
const exportandoXls     = ref(false)
const mostrarModalEnvio = ref(false)

const kpis     = ref(null)
const grafico  = ref([])
const egresos  = ref(null)
const asesores = ref([])

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBs  = (v) => 'Bs. ' + (parseFloat(v) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })
const fmtUsd = (v) => '$ '   + (parseFloat(v) || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })
const fmtMonto = (moneda, v) => moneda === '$' ? fmtUsd(v) : fmtBs(v)

const fmtFecha = (v) => {
  if (!v) return '-'
  const [y, m, d] = String(v).slice(0, 10).split('-')
  return d + '/' + m + '/' + y
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
    const params = {
      desde:    desde.value,
      hasta:    hasta.value,
      estado:   estado.value,
      moneda:   moneda.value,
      page:     pagina.value,
      per_page: perPage.value,
    }
    if (asesorId.value) params.asesor_id = asesorId.value

    const { data } = await api.get('/reportes/comisiones', { params, signal: actual.signal })
    kpis.value     = data.kpis
    grafico.value  = data.grafico  ?? []
    egresos.value  = data.egresos
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
watch([desde, hasta, asesorId, estado, moneda], () => cargar())

// ─── Exportar ────────────────────────────────────────────────────────────────
async function exportar(tipo) {
  const flag = tipo === 'pdf' ? exportandoPdf : exportandoXls
  flag.value = true
  try {
    const params = { desde: desde.value, hasta: hasta.value, estado: estado.value, moneda: moneda.value }
    if (asesorId.value) params.asesor_id = asesorId.value

    const res = await api.get('/reportes/comisiones/' + tipo, { params, responseType: 'blob' })
    const ext  = tipo === 'pdf' ? '.pdf' : '.xlsx'
    const mime = tipo === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const url  = URL.createObjectURL(new Blob([res.data], { type: mime }))
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'comisiones-' + desde.value + '-al-' + hasta.value + ext
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error(e)
    alert('Error al generar el archivo.')
  } finally {
    flag.value = false
  }
}

// ─── Gráfico barras por asesor ────────────────────────────────────────────────
const chartBarData = computed(() => {
  if (!grafico.value?.length) return null
  return {
    labels: grafico.value.map(r => r.asesor),
    datasets: [
      {
        label: 'Pagado (Bs.)',
        data: grafico.value.map(r => r.pagado),
        backgroundColor: 'rgba(34,197,94,0.75)',
        borderRadius: 4,
      },
      {
        label: 'Pendiente (Bs.)',
        data: grafico.value.map(r => r.pendiente),
        backgroundColor: 'rgba(251,191,36,0.75)',
        borderRadius: 4,
      },
    ],
  }
})

const chartBarOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    tooltip: {
      callbacks: {
        label: ctx => ' Bs. ' + ctx.parsed.x.toLocaleString('es-BO', { minimumFractionDigits: 2 }),
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      stacked: false,
      ticks: { callback: v => 'Bs. ' + Number(v).toLocaleString('es-BO') },
    },
    y: { stacked: false },
  },
}

// ─── Gráfico dona pendiente vs pagado ─────────────────────────────────────────
const chartDonaData = computed(() => {
  if (!kpis.value) return null
  const pend = kpis.value.pendiente_bs
  const pag  = kpis.value.pagado_bs
  if (pend === 0 && pag === 0) return null
  return {
    labels: ['Pendiente (Bs.)', 'Pagado (Bs.)'],
    datasets: [{
      data: [pend, pag],
      backgroundColor: ['rgba(251,191,36,0.8)', 'rgba(34,197,94,0.8)'],
      borderWidth: 2,
      borderColor: ['#fff', '#fff'],
    }],
  }
})

const chartDonaOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' },
    tooltip: {
      callbacks: {
        label: ctx => ' Bs. ' + ctx.parsed.toLocaleString('es-BO', { minimumFractionDigits: 2 }),
      },
    },
  },
}

// ─── Paginación ───────────────────────────────────────────────────────────────
const paginas = computed(() => {
  if (!egresos.value) return []
  const total  = egresos.value.last_page
  const actual = egresos.value.current_page
  const rango  = []
  for (let i = Math.max(1, actual - 2); i <= Math.min(total, actual + 2); i++) rango.push(i)
  return rango
})
</script>

<template>
  <div class="reporte-comisiones">

    <!-- ── Cabecera ─────────────────────────────────────────────────────── -->
    <div class="d-flex align-items-start justify-content-between flex-wrap gap-3 mb-4">
      <div>
        <h5 class="fw-bold mb-1" style="color:var(--text-main)">
          <i class="bi bi-cash-coin text-warning me-2"></i>Comisiones
        </h5>
        <p class="text-muted small mb-0">Comisiones generadas y pagadas a asesores por ventas realizadas</p>
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
        <select class="form-select form-select-sm" v-model="asesorId" style="min-width:180px;">
          <option value="">Todos los asesores</option>
          <option v-for="a in asesores" :key="a.id" :value="a.id">{{ a.nombre_completo }}</option>
        </select>
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Estado</label>
        <select class="form-select form-select-sm" v-model="estado">
          <option value="Todos">Todos</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
        </select>
      </div>
      <div>
        <label class="form-label small fw-semibold mb-1">Moneda</label>
        <select class="form-select form-select-sm" v-model="moneda">
          <option value="Todos">Todas</option>
          <option value="Bs">Bolivianos (Bs.)</option>
          <option value="$">Dólares ($)</option>
        </select>
      </div>
      <button class="btn btn-sm btn-primary" @click="cargar()" :disabled="cargando">
        <i class="bi bi-arrow-clockwise me-1"></i> Actualizar
      </button>
    </div>

    <!-- ── Spinner ───────────────────────────────────────────────────────── -->
    <div v-if="errorCarga" class="alert alert-danger" role="alert">{{ errorCarga }}</div>
    <div v-if="cargando" class="text-center py-5">
      <div class="spinner-border text-warning" role="status"></div>
      <p class="text-muted mt-2 small">Cargando datos...</p>
    </div>

    <template v-if="!cargando && kpis">

      <!-- ── KPI Cards ─────────────────────────────────────────────────── -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-4 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#f0fdf4;color:#15803d;"><i class="bi bi-check-circle"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Pagado (Bs.)</div>
              <div class="kpi-value text-success">{{ fmtBs(kpis.pagado_bs) }}</div>
              <div class="kpi-sub">{{ kpis.pagado_count }} comisiones</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fffbeb;color:#b45309;"><i class="bi bi-hourglass-split"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Pendiente (Bs.)</div>
              <div class="kpi-value text-warning">{{ fmtBs(kpis.pendiente_bs) }}</div>
              <div class="kpi-sub">{{ kpis.pendiente_count }} comisiones</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#f0fdf4;color:#15803d;"><i class="bi bi-currency-dollar"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Pagado (USD)</div>
              <div class="kpi-value text-success">{{ fmtUsd(kpis.pagado_usd) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#fffbeb;color:#b45309;"><i class="bi bi-currency-dollar"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Pendiente (USD)</div>
              <div class="kpi-value text-warning">{{ fmtUsd(kpis.pendiente_usd) }}</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-lg">
          <div class="kpi-card h-100">
            <div class="kpi-icon" style="background:#eff6ff;color:#2563eb;"><i class="bi bi-list-check"></i></div>
            <div class="ms-3">
              <div class="kpi-label">Total Registros</div>
              <div class="kpi-value" style="color:#2563eb;">{{ kpis.total_count }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Gráficos ──────────────────────────────────────────────────── -->
      <div class="row g-3 mb-4">
        <!-- Barras por asesor -->
        <div class="col-12 col-lg-8">
          <div class="chart-card h-100">
            <h6 class="fw-semibold mb-3" style="color:var(--text-main)">
              <i class="bi bi-bar-chart-horizontal me-2 text-warning"></i>Comisiones por Asesor (Bs.)
            </h6>
            <div v-if="chartBarData" style="height:260px;">
              <Bar :data="chartBarData" :options="chartBarOptions" />
            </div>
            <div v-else class="text-center text-muted py-4">
              <i class="bi bi-inbox fs-3 opacity-25"></i>
              <p class="small mt-2">Sin datos en Bs. para el período</p>
            </div>
          </div>
        </div>

        <!-- Dona pendiente vs pagado -->
        <div class="col-12 col-lg-4">
          <div class="chart-card h-100 d-flex flex-column">
            <h6 class="fw-semibold mb-3" style="color:var(--text-main)">
              <i class="bi bi-pie-chart me-2 text-success"></i>Estado (Bs.)
            </h6>
            <div v-if="chartDonaData" class="flex-grow-1 d-flex align-items-center" style="min-height:220px;">
              <Doughnut :data="chartDonaData" :options="chartDonaOptions" style="max-height:220px;" />
            </div>
            <div v-else class="text-center text-muted py-4 flex-grow-1 d-flex flex-column align-items-center justify-content-center">
              <i class="bi bi-inbox fs-3 opacity-25"></i>
              <p class="small mt-2">Sin datos</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Tabla de egresos (comisiones) ─────────────────────────────── -->
      <div class="list-card">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h6 class="fw-semibold mb-0" style="color:var(--text-main)">
            Detalle de Comisiones
            <span class="badge bg-secondary ms-2" style="font-size:.75rem;">
              {{ egresos?.total ?? 0 }} registros
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
                <th>Asesor</th>
                <th class="text-center">N° Venta</th>
                <th>Propiedad</th>
                <th>Cliente</th>
                <th class="text-center">Moneda</th>
                <th class="text-end">Monto</th>
                <th class="text-center">Estado</th>
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!egresos?.data?.length">
                <td colspan="9" class="text-center text-muted py-4">
                  <i class="bi bi-inbox fs-4 d-block mb-2 opacity-50"></i>
                  No hay comisiones en el período seleccionado.
                </td>
              </tr>
              <tr v-for="e in egresos?.data" :key="e.id">
                <td class="text-nowrap">{{ fmtFecha(e.fecha) }}</td>
                <td class="fw-medium">{{ e.asesor }}</td>
                <td class="text-center">
                  <span class="badge bg-light text-dark border" v-if="e.nota_venta_id">#{{ e.nota_venta_id }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span class="badge bg-light text-secondary border" v-if="e.propiedad !== '-'">{{ e.propiedad }}</span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>{{ e.cliente }}</td>
                <td class="text-center">
                  <span class="badge rounded-pill" :class="e.moneda === '$' ? 'text-bg-info' : 'text-bg-primary'">
                    {{ e.moneda === '$' ? 'USD' : 'Bs.' }}
                  </span>
                </td>
                <td class="text-end fw-bold text-nowrap">{{ fmtMonto(e.moneda, e.monto) }}</td>
                <td class="text-center">
                  <span class="badge rounded-pill"
                    :class="e.estado === 'PAGADO' ? 'text-bg-success' : 'text-bg-warning'">
                    {{ e.estado === 'PAGADO' ? 'Pagado' : 'Pendiente' }}
                  </span>
                </td>
                <td class="text-muted small">{{ e.comprobante || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <nav v-if="egresos && egresos.last_page > 1" class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
          <small class="text-muted">
            Mostrando {{ egresos.from }}–{{ egresos.to }} de {{ egresos.total }}
          </small>
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" :class="{ disabled: egresos.current_page === 1 }">
              <button class="page-link" @click="cambiarPagina(egresos.current_page - 1)">
                <i class="bi bi-chevron-left"></i>
              </button>
            </li>
            <li v-for="p in paginas" :key="p" class="page-item" :class="{ active: p === egresos.current_page }">
              <button class="page-link" @click="cambiarPagina(p)">{{ p }}</button>
            </li>
            <li class="page-item" :class="{ disabled: egresos.current_page === egresos.last_page }">
              <button class="page-link" @click="cambiarPagina(egresos.current_page + 1)">
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
    reporte="comisiones"
    titulo="Comisiones"
    :params="{ desde: desde, hasta: hasta, estado: estado, moneda: moneda, asesor_id: asesorId }"
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
</style>
