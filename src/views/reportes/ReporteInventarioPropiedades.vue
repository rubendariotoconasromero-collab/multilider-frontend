<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/api/axios'
import ModalEnviarInforme from '@/components/ModalEnviarInforme.vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, Title, Tooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

// ─── Filtros ────────────────────────────────────────────────────────────────
const tipo        = ref('Todos')
const estado      = ref('Todos')
const moneda      = ref('Todos')
const precioMin   = ref('')
const precioMax   = ref('')
const ciudadId    = ref('')
const distritoId  = ref('')
const sectorId    = ref('')
const page        = ref(1)
const perPage     = ref(15)

// ─── Catálogos para filtros ──────────────────────────────────────────────────
const ciudades       = ref([])
const distritos      = ref([])
const sectores       = ref([])
const tiposDisponibles = ['Todos', 'Casa', 'Lote', 'Local', 'Departamento', 'Terreno', 'Otro']
const estadosDisponibles = ['Todos', 'Disponible', 'Vendido', 'Reservado']

// ─── Estado de carga ────────────────────────────────────────────────────────
const loading           = ref(false)
const errorCarga = ref('')
let consulta
const loadingExcel      = ref(false)
const loadingPdf        = ref(false)
const mostrarModalEnvio = ref(false)

// ─── Datos ──────────────────────────────────────────────────────────────────
const kpis         = ref(null)
const propiedades  = ref({ data: [], current_page: 1, last_page: 1, total: 0, per_page: 15 })
const graficoEstados = ref([])
const graficoTipos   = ref([])

// ─── Parámetros actuales ─────────────────────────────────────────────────────
const params = computed(() => {
  const p = { page: page.value, per_page: perPage.value }
  if (tipo.value       !== 'Todos') p.tipo       = tipo.value
  if (estado.value     !== 'Todos') p.estado     = estado.value
  if (moneda.value     !== 'Todos') p.moneda     = moneda.value
  if (precioMin.value)  p.precio_min = precioMin.value
  if (precioMax.value)  p.precio_max = precioMax.value
  if (ciudadId.value)   p.ciudad_id  = ciudadId.value
  if (distritoId.value) p.distrito_id = distritoId.value
  if (sectorId.value)   p.sector_urbano_id = sectorId.value
  return p
})

// ─── Catálogos ───────────────────────────────────────────────────────────────
async function cargarCiudades() {
  const { data } = await api.get('/ciudades', { params: { per_page: 100 } })
  ciudades.value = data.data ?? data
}

watch(ciudadId, async (val) => {
  distritoId.value = ''
  sectorId.value   = ''
  distritos.value  = []
  sectores.value   = []
  if (!val) return
  const { data } = await api.get('/distritos', { params: { ciudad_id: val, per_page: 100 } })
  distritos.value = data.data ?? data
})

watch(distritoId, async (val) => {
  sectorId.value = ''
  sectores.value = []
  if (!val) return
  const { data } = await api.get('/sectores-urbanos/por-distrito/' + val)
  sectores.value = data
})

// ─── Carga de datos ──────────────────────────────────────────────────────────
async function cargar() {
  consulta?.abort()
  const actual = new AbortController()
  consulta = actual
  errorCarga.value = ''
  loading.value = true
  try {
    const { data } = await api.get('/reportes/inventario-propiedades', { params: params.value, signal: actual.signal })
    kpis.value          = data.kpis
    propiedades.value   = data.propiedades
    graficoEstados.value = data.grafico_estados
    graficoTipos.value   = data.grafico_tipos
  } catch (error) {
    if (actual.signal.aborted) return
    kpis.value = null
    propiedades.value = { data: [], current_page: 1, last_page: 1, total: 0, per_page: perPage.value }
    errorCarga.value = error?.response?.data?.message ?? 'No se pudo cargar el inventario.'
  } finally {
    if (consulta === actual) loading.value = false
  }
}

function aplicarFiltros() {
  page.value = 1
  cargar()
}

function limpiarFiltros() {
  tipo.value       = 'Todos'
  estado.value     = 'Todos'
  moneda.value     = 'Todos'
  precioMin.value  = ''
  precioMax.value  = ''
  ciudadId.value   = ''
  distritoId.value = ''
  sectorId.value   = ''
  page.value       = 1
  cargar()
}

// ─── Paginación ──────────────────────────────────────────────────────────────
function irPagina(p) {
  if (p < 1 || p > propiedades.value.last_page) return
  page.value = p
  cargar()
}

// ─── Exportar ────────────────────────────────────────────────────────────────
async function descargar(tipo_export) {
  const flag = tipo_export === 'excel' ? loadingExcel : loadingPdf
  flag.value = true
  try {
    const ext  = tipo_export === 'excel' ? 'xlsx' : 'pdf'
    const mime = tipo_export === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf'
    const { data } = await api.get(
      `/reportes/inventario-propiedades/${tipo_export}`,
      { params: params.value, responseType: 'blob' }
    )
    const url = URL.createObjectURL(new Blob([data], { type: mime }))
    const a   = document.createElement('a')
    a.href     = url
    a.download = `inventario_propiedades_${new Date().toISOString().slice(0,10)}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    flag.value = false
  }
}

// ─── Charts ──────────────────────────────────────────────────────────────────
const coloresEstado = {
  Disponible: 'rgba(34,197,94,.8)',
  Vendido:    'rgba(59,130,246,.8)',
  Reservado:  'rgba(245,158,11,.8)',
}

const chartEstados = computed(() => {
  const labels = graficoEstados.value.map(r => r.estado)
  const values = graficoEstados.value.map(r => r.total)
  const bgColors = labels.map(l => coloresEstado[l] ?? 'rgba(107,114,128,.7)')
  return {
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 2 }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} propiedades` } },
      },
    },
  }
})

const chartTipos = computed(() => {
  const sorted = [...graficoTipos.value].sort((a, b) => b.total - a.total)
  return {
    data: {
      labels: sorted.map(r => r.tipo),
      datasets: [{
        label: 'Propiedades',
        data: sorted.map(r => r.total),
        backgroundColor: 'rgba(11,37,69,.75)',
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 } },
        y: { ticks: { font: { size: 11 } } },
      },
    },
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
function estadoBadgeClass(est) {
  return {
    Disponible: 'badge-disponible',
    Vendido:    'badge-vendido',
    Reservado:  'badge-reservado',
  }[est] ?? 'bg-secondary'
}

function fmtPrecio(precio, mon) {
  return (mon === 'USD' ? 'USD ' : 'Bs. ') +
    Number(precio).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(async () => {
  await cargarCiudades()
  cargar()
})
</script>

<template>
  <div class="inv-wrapper">

    <!-- Encabezado -->
    <div class="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
      <div>
        <h4 class="mb-0 fw-bold" style="color:#0b2545;">
          <i class="bi bi-houses me-2" style="color:#06b6d4;"></i>Inventario de Propiedades
        </h4>
        <p class="text-muted small mb-0">Estado actual del stock de propiedades</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-success" @click="descargar('excel')" :disabled="loadingExcel">
          <i class="bi bi-file-earmark-excel me-1"></i>
          {{ loadingExcel ? 'Generando…' : 'Excel' }}
        </button>
        <button class="btn btn-sm btn-outline-danger" @click="descargar('pdf')" :disabled="loadingPdf">
          <i class="bi bi-file-earmark-pdf me-1"></i>
          {{ loadingPdf ? 'Generando…' : 'PDF' }}
        </button>
        <button class="btn btn-sm btn-outline-primary" @click="mostrarModalEnvio = true" :disabled="loading">
          <i class="bi bi-envelope-arrow-up me-1"></i> Enviar
        </button>
      </div>
    </div>

    <!-- Filtros -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body py-3">
        <div class="row g-2 align-items-end">

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Tipo</label>
            <select v-model="tipo" class="form-select form-select-sm">
              <option v-for="t in tiposDisponibles" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Estado</label>
            <select v-model="estado" class="form-select form-select-sm">
              <option v-for="e in estadosDisponibles" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Moneda</label>
            <select v-model="moneda" class="form-select form-select-sm">
              <option value="Todos">Todas</option>
              <option value="USD">USD</option>
              <option value="BOB">Bs.</option>
            </select>
          </div>

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Ciudad</label>
            <select v-model="ciudadId" class="form-select form-select-sm">
              <option value="">Todas</option>
              <option v-for="c in ciudades" :key="c.id" :value="c.id">{{ c.nombre }}</option>
            </select>
          </div>

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Distrito</label>
            <select v-model="distritoId" class="form-select form-select-sm" :disabled="!ciudadId">
              <option value="">Todos</option>
              <option v-for="d in distritos" :key="d.id" :value="d.id">{{ d.nombre }}</option>
            </select>
          </div>

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Sector Urbano</label>
            <select v-model="sectorId" class="form-select form-select-sm" :disabled="!distritoId">
              <option value="">Todos</option>
              <option v-for="s in sectores" :key="s.id" :value="s.id">{{ s.nombre }}</option>
            </select>
          </div>

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Precio Mín.</label>
            <input v-model="precioMin" type="number" min="0" class="form-control form-control-sm" placeholder="0">
          </div>

          <div class="col-6 col-md-3 col-lg-2">
            <label class="form-label small fw-semibold mb-1">Precio Máx.</label>
            <input v-model="precioMax" type="number" min="0" class="form-control form-control-sm" placeholder="Sin límite">
          </div>

          <div class="col-12 col-md-auto d-flex gap-2 ms-auto mt-1">
            <button class="btn btn-sm btn-primary px-3" @click="aplicarFiltros" :disabled="loading">
              <i class="bi bi-search me-1"></i>Filtrar
            </button>
            <button class="btn btn-sm btn-outline-secondary" @click="limpiarFiltros">
              <i class="bi bi-x-circle me-1"></i>Limpiar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div v-if="kpis" class="row g-3 mb-4">
      <div class="col-6 col-md-4 col-lg-2">
        <div class="kpi-card kpi-total">
          <div class="kpi-val">{{ kpis.total }}</div>
          <div class="kpi-lbl">Total Propiedades</div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-lg-2">
        <div class="kpi-card kpi-disp">
          <div class="kpi-val">{{ kpis.disponibles }}</div>
          <div class="kpi-lbl">Disponibles</div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-lg-2">
        <div class="kpi-card kpi-vend">
          <div class="kpi-val">{{ kpis.vendidas }}</div>
          <div class="kpi-lbl">Vendidas</div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-lg-2">
        <div class="kpi-card kpi-res">
          <div class="kpi-val">{{ kpis.reservadas }}</div>
          <div class="kpi-lbl">Reservadas</div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-lg-2">
        <div class="kpi-card kpi-valor">
          <div class="kpi-val" style="font-size:1rem;">
            USD {{ Number(kpis.valor_disponible_usd).toLocaleString('es-BO', {minimumFractionDigits:0}) }}
          </div>
          <div class="kpi-lbl">Valor Disp. (USD)</div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-lg-2">
        <div class="kpi-card kpi-sup">
          <div class="kpi-val">{{ kpis.superficie_promedio }} m²</div>
          <div class="kpi-lbl">Sup. Promedio</div>
        </div>
      </div>
    </div>

    <!-- Gráficos -->
    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="chart-title">Distribución por Estado</h6>
            <div v-if="graficoEstados.length" style="max-height:220px;display:flex;justify-content:center;">
              <Doughnut
                :data="chartEstados.data"
                :options="chartEstados.options"
                style="max-height:200px;"
              />
            </div>
            <div v-else class="text-center text-muted py-4 small">Sin datos</div>
          </div>
        </div>
      </div>
      <div class="col-md-8">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <h6 class="chart-title">Propiedades por Tipo</h6>
            <div v-if="graficoTipos.length">
              <Bar
                :data="chartTipos.data"
                :options="chartTipos.options"
                :style="{ height: Math.max(160, graficoTipos.length * 40) + 'px' }"
              />
            </div>
            <div v-else class="text-center text-muted py-4 small">Sin datos</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card border-0 shadow-sm">
      <div class="card-body p-0">
        <div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
          <span class="small fw-semibold text-muted">
            {{ propiedades.total }} propiedad{{ propiedades.total !== 1 ? 'es' : '' }} encontrada{{ propiedades.total !== 1 ? 's' : '' }}
          </span>
          <select v-model="perPage" @change="aplicarFiltros" class="form-select form-select-sm" style="width:90px;">
            <option :value="10">10</option>
            <option :value="15">15</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
        </div>

        <div v-if="errorCarga" class="alert alert-danger" role="alert">{{ errorCarga }}</div>
        <div v-else-if="loading" class="text-center py-5">
          <div class="spinner-border spinner-border-sm text-primary"></div>
          <span class="ms-2 small text-muted">Cargando…</span>
        </div>

        <div v-else class="table-responsive">
          <table class="table table-hover table-sm mb-0 align-middle">
            <thead class="table-dark">
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Sector Urbano</th>
                <th>Distrito</th>
                <th class="text-end">Sup. (m²)</th>
                <th class="text-end">Const. (m²)</th>
                <th class="text-center">Hab./Baños</th>
                <th class="text-end">Precio Venta</th>
                <th class="text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in propiedades.data" :key="p.id">
                <td class="fw-semibold" style="font-size:.8rem;">{{ p.codigo || '-' }}</td>
                <td>{{ p.tipo }}</td>
                <td class="text-muted" style="font-size:.8rem;">{{ p.sector_urbano || '-' }}</td>
                <td class="text-muted" style="font-size:.8rem;">{{ p.distrito || '-' }}</td>
                <td class="text-end">{{ Number(p.superficie_m2).toLocaleString('es-BO', {minimumFractionDigits:2}) }}</td>
                <td class="text-end text-muted">
                  {{ p.superficie_construida_m2
                    ? Number(p.superficie_construida_m2).toLocaleString('es-BO', {minimumFractionDigits:2})
                    : '—' }}
                </td>
                <td class="text-center text-muted" style="font-size:.8rem;">
                  <span v-if="p.habitaciones || p.banos">
                    {{ p.habitaciones ?? '—' }} / {{ p.banos ?? '—' }}
                  </span>
                  <span v-else>—</span>
                </td>
                <td class="text-end fw-semibold" style="font-size:.85rem;">
                  {{ fmtPrecio(p.precio_venta, p.moneda) }}
                </td>
                <td class="text-center">
                  <span class="badge" :class="estadoBadgeClass(p.estado)">{{ p.estado }}</span>
                </td>
              </tr>
              <tr v-if="!propiedades.data.length">
                <td colspan="9" class="text-center text-muted py-4">No hay propiedades con los filtros seleccionados.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div v-if="propiedades.last_page > 1" class="d-flex justify-content-center align-items-center gap-2 py-3">
          <button class="btn btn-sm btn-outline-secondary" @click="irPagina(propiedades.current_page - 1)" :disabled="propiedades.current_page === 1">
            <i class="bi bi-chevron-left"></i>
          </button>
          <span class="small text-muted">
            Página {{ propiedades.current_page }} de {{ propiedades.last_page }}
          </span>
          <button class="btn btn-sm btn-outline-secondary" @click="irPagina(propiedades.current_page + 1)" :disabled="propiedades.current_page === propiedades.last_page">
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>

      </div>
    </div>

  </div>

  <ModalEnviarInforme
    v-model="mostrarModalEnvio"
    reporte="inventario-propiedades"
    titulo="Inventario de Propiedades"
    :params="{ tipo: tipo, estado: estado, moneda: moneda, ciudad_id: ciudadId, distrito_id: distritoId, sector_urbano_id: sectorId, precio_min: precioMin, precio_max: precioMax }"
  />
</template>

<style scoped>
.inv-wrapper { padding-bottom: 2rem; }

.kpi-card {
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid transparent;
  text-align: center;
}
.kpi-val { font-size: 1.5rem; font-weight: 700; line-height: 1.1; }
.kpi-lbl { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; margin-top: 4px; opacity: .75; }

.kpi-total { background: #f8fafc; border-color: #e2e8f0; color: #0b2545; }
.kpi-disp  { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.kpi-vend  { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
.kpi-res   { background: #fffbeb; border-color: #fde68a; color: #b45309; }
.kpi-valor { background: #f8fafc; border-color: #e2e8f0; color: #0b2545; }
.kpi-sup   { background: #f0fdfa; border-color: #99f6e4; color: #0d9488; }

.chart-title {
  font-size: .8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: #64748b;
  margin-bottom: 12px;
}

.badge-disponible { background: #dcfce7; color: #16a34a; }
.badge-vendido    { background: #dbeafe; color: #1d4ed8; }
.badge-reservado  { background: #fef9c3; color: #b45309; }
</style>
