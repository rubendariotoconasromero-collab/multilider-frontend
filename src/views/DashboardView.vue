<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS, Title, Tooltip, Legend,
  BarElement, CategoryScale, LinearScale,
  ArcElement, PointElement, LineElement,
} from 'chart.js'
import { useAuthStore } from '../stores/auth'
import api from '../api/axios'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement, PointElement, LineElement)

const authStore = useAuthStore()

const isAdmin = computed(() => {
  const asignaciones = authStore.user?.roles_permisos ?? authStore.user?.rolesPermisos ?? []
  return asignaciones.some(item => {
    const rol = item.rol_permiso?.rol ?? item.rolPermiso?.rol
    return rol?.nombre === 'Administrador'
  })
})

const hoy          = new Date().toISOString().slice(0, 10)
const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const desde        = ref(primerDiaMes)
const hasta        = ref(hoy)
const cargando     = ref(false)
const adminData    = ref(null)
const asesorData   = ref(null)
const moneda = ref('BOB')
const permiteMoneda = ref(false)
const simbolo = computed(() => (adminData.value ?? asesorData.value)?.moneda === 'USD' ? 'USD' : 'Bs')
const errorCarga = ref('')
let consulta

const fmt    = (n) => new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n ?? 0)
const fmtInt = (n) => new Intl.NumberFormat('es-BO').format(n ?? 0)
const fmtFecha = (v) => {
  if (!v) return '-'
  const [y, m, d] = String(v).slice(0, 10).split('-')
  return d + '/' + m + '/' + y
}
const MESES    = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const labelMes = (anio, mes) => MESES[mes - 1] + ' ' + anio
const diasAtraso = (fecha) => {
  const d = Math.floor((new Date() - new Date(String(fecha).slice(0, 10))) / 86400000)
  return d > 0 ? d : 0
}

const isDark = computed(() => document.documentElement.getAttribute('data-theme') === 'dark')

const chartColors = computed(() => ({
  text: isDark.value ? '#9CA3AF' : '#6c757d',
  grid: isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
}))

const cargar = async () => {
  consulta?.abort()
  const actual = new AbortController()
  consulta = actual
  errorCarga.value = ''
  cargando.value = true
  try {
    const admin = isAdmin.value
    const params = { desde: desde.value, hasta: hasta.value, moneda: moneda.value }
    const { data } = await api.get(admin ? '/dashboard/admin' : '/dashboard/asesor', { params, signal: actual.signal })
    permiteMoneda.value = Boolean(data.moneda)
    adminData.value = admin ? data : null
    asesorData.value = admin ? null : data
  } catch (e) {
    if (actual.signal.aborted) return
    adminData.value = null
    asesorData.value = null
    errorCarga.value = e?.response?.data?.message ?? 'No se pudieron cargar los datos del dashboard.'
  } finally {
    if (consulta === actual) cargando.value = false
  }
}

onMounted(cargar)
watch([desde, hasta, moneda], cargar)

// ── Charts Admin ──────────────────────────────────────────────────────────────
const chartVentasPorMes = computed(() => {
  const d = adminData.value?.graficos?.ventas_por_mes ?? []
  return {
    labels: d.map(r => labelMes(r.anio, r.mes)),
    datasets: [
      { label: `Monto (${simbolo.value})`, data: d.map(r => +r.monto), backgroundColor: '#0d6efd', borderRadius: 6 },
      { label: 'Cantidad', data: d.map(r => +r.cantidad), backgroundColor: '#6ea8fe', borderRadius: 6, yAxisID: 'y1' },
    ],
  }
})
const optsVentasPorMes = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { 
    legend: { position: 'top', labels: { color: chartColors.value.text } } 
  },
  scales: {
    y:  { 
      beginAtZero: true, 
      title: { display: true, text: simbolo.value, color: chartColors.value.text },
      ticks: { color: chartColors.value.text },
      grid: { color: chartColors.value.grid }
    },
    y1: { 
      beginAtZero: true, 
      position: 'right', 
      grid: { drawOnChartArea: false }, 
      title: { display: true, text: 'Ventas', color: chartColors.value.text },
      ticks: { color: chartColors.value.text }
    },
    x: {
      ticks: { color: chartColors.value.text },
      grid: { color: chartColors.value.grid }
    }
  },
}))

const chartCobros = computed(() => {
  const cobros = adminData.value?.graficos?.cobros_por_mes ?? []
  const ventas = adminData.value?.graficos?.ventas_por_mes ?? []
  const labels = ventas.map(r => labelMes(r.anio, r.mes))
  const map = {}
  cobros.forEach(c => { map[labelMes(c.anio, c.mes)] = +c.monto })
  return {
    labels,
    datasets: [{ label: `Cobros (${simbolo.value})`, data: labels.map(l => map[l] ?? 0), backgroundColor: '#198754', borderRadius: 6 }],
  }
})

const chartDistribucion = computed(() => {
  const d = adminData.value?.graficos?.distribucion_tipo_venta ?? []
  return {
    labels: d.map(r => r.tipo_venta === 'CREDITO' ? 'Crédito' : 'Contado'),
    datasets: [{ data: d.map(r => +r.monto), backgroundColor: ['#0d6efd', '#20c997'], hoverOffset: 6 }],
  }
})

const chartTopAsesores = computed(() => {
  const d = adminData.value?.graficos?.top_asesores ?? []
  return {
    labels: d.map(r => r.asesor?.nombre_completo ?? 'Sin nombre'),
    datasets: [{
      label: `Ventas (${simbolo.value})`,
      data: d.map(r => +r.monto),
      backgroundColor: ['#0d6efd','#6f42c1','#20c997','#fd7e14','#dc3545'],
      borderRadius: 6,
    }],
  }
})

const optsBar = computed(() => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { 
    legend: { position: 'top', labels: { color: chartColors.value.text } } 
  },
  scales: { 
    y: { 
      beginAtZero: true,
      ticks: { color: chartColors.value.text },
      grid: { color: chartColors.value.grid }
    },
    x: {
      ticks: { color: chartColors.value.text },
      grid: { color: chartColors.value.grid }
    }
  },
}))

const optsDoughnut = computed(() => ({ 
  responsive: true, 
  maintainAspectRatio: false, 
  plugins: { 
    legend: { position: 'bottom', labels: { color: chartColors.value.text } } 
  } 
}))

const optsHBar = computed(() => ({
  indexAxis: 'y',
  responsive: true, maintainAspectRatio: false,
  plugins: { 
    legend: { display: false } 
  },
  scales: { 
    x: { 
      beginAtZero: true,
      ticks: { color: chartColors.value.text },
      grid: { color: chartColors.value.grid }
    },
    y: {
      ticks: { color: chartColors.value.text },
      grid: { color: chartColors.value.grid }
    }
  },
}))

// ── Charts Asesor ─────────────────────────────────────────────────────────────
const chartMisVentas = computed(() => {
  const d = asesorData.value?.graficos?.ventas_por_mes ?? []
  return {
    labels: d.map(r => labelMes(r.anio, r.mes)),
    datasets: [{ label: `Monto (${simbolo.value})`, data: d.map(r => +r.monto), backgroundColor: '#0d6efd', borderRadius: 6 }],
  }
})

const chartMiCartera = computed(() => {
  const c = asesorData.value?.graficos?.mi_cartera ?? {}
  return {
    labels: ['Cartera Vigente', 'Cuotas Vencidas'],
    datasets: [{ data: [c.saldo_vigente ?? 0, c.monto_cuotas_vencidas ?? 0], backgroundColor: ['#20c997', '#dc3545'], hoverOffset: 6 }],
  }
})
</script>

<template>
  <div class="dash-wrap pb-5 px-3">

    <!-- Encabezado + Filtros -->
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pt-3">
      <div>
        <h4 class="mb-0 fw-bold">
          <i class="bi bi-grid-1x2-fill me-2 text-primary"></i>
          Dashboard
          <span class="badge bg-primary ms-2" style="font-size:.65rem">
            {{ isAdmin ? 'Administrador' : 'Asesor' }}
          </span>
        </h4>
        <small class="text-muted" v-if="!isAdmin && asesorData">{{ asesorData.asesor?.nombre_completo }}</small>
      </div>

      <div class="d-flex align-items-center gap-2 flex-wrap">
        <div class="input-group input-group-sm" style="width:auto">
          <span class="input-group-text"><i class="bi bi-calendar-range"></i></span>
          <input type="date" class="form-control" v-model="desde" :max="hasta" />
          <span class="input-group-text">—</span>
          <input type="date" class="form-control" v-model="hasta" :min="desde" :max="hoy" />
        </div>
        <select v-if="permiteMoneda" v-model="moneda" class="form-select form-select-sm w-auto" aria-label="Moneda">
          <option value="BOB">Bolivianos (BOB)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
        <button class="btn btn-primary btn-sm px-3" @click="cargar" :disabled="cargando">
          <i class="bi bi-arrow-clockwise" :class="{ 'spin': cargando }"></i>
          {{ cargando ? 'Cargando…' : 'Actualizar' }}
        </button>
      </div>
    </div>

    <!-- Spinner -->
    <div v-if="cargando" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Cargando datos…</p>
    </div>

    <!-- ═══════════════════════ ADMIN ═══════════════════════ -->
    <template v-if="!cargando && isAdmin && adminData">

      <!-- KPIs -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-4 col-xl-3">
          <div class="kpi border-primary">
            <div class="kpi-icon bg-primary-subtle text-primary"><i class="bi bi-cart-check-fill fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Ventas del período</div>
              <div class="kpi-val">{{ simbolo }} {{ fmt(adminData.kpis.ventas_monto) }}</div>
              <div class="kpi-sub">{{ fmtInt(adminData.kpis.ventas_cantidad) }} venta(s)</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
          <div class="kpi border-success">
            <div class="kpi-icon bg-success-subtle text-success"><i class="bi bi-cash-coin fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Cobros del período</div>
              <div class="kpi-val">{{ simbolo }} {{ fmt(adminData.kpis.cobros_monto) }}</div>
              <div class="kpi-sub">Ingresos confirmados</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
          <div class="kpi border-danger">
            <div class="kpi-icon bg-danger-subtle text-danger"><i class="bi bi-exclamation-circle-fill fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Mora acumulada</div>
              <div class="kpi-val text-danger">{{ simbolo }} {{ fmt(adminData.kpis.mora_acumulada) }}</div>
              <div class="kpi-sub">Cuotas vencidas totales</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
          <div class="kpi border-info">
            <div class="kpi-icon bg-info-subtle text-info"><i class="bi bi-wallet2 fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Cartera activa</div>
              <div class="kpi-val">{{ simbolo }} {{ fmt(adminData.kpis.cartera_activa) }}</div>
              <div class="kpi-sub">{{ fmtInt(adminData.kpis.clientes_credito) }} cliente(s) crédito</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4 col-xl-3">
          <div class="kpi border-warning">
            <div class="kpi-icon bg-warning-subtle text-warning"><i class="bi bi-person-badge-fill fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Comisiones pagadas</div>
              <div class="kpi-val">{{ simbolo }} {{ fmt(adminData.kpis.comisiones_pagadas) }}</div>
              <div class="kpi-sub">En el período</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts fila 1 -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-8">
          <div class="chart-card">
            <div class="chart-ttl"><i class="bi bi-bar-chart-fill me-2 text-primary"></i>Ventas por mes (últimos 6 meses)</div>
            <div style="height:260px"><Bar :key="isDark" :data="chartVentasPorMes" :options="optsVentasPorMes" /></div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="chart-card">
            <div class="chart-ttl"><i class="bi bi-pie-chart-fill me-2 text-success"></i>Contado vs Crédito</div>
            <div style="height:260px" class="d-flex align-items-center justify-content-center">
              <Doughnut v-if="adminData.graficos.distribucion_tipo_venta.length" :key="isDark" :data="chartDistribucion" :options="optsDoughnut" />
              <span v-else class="text-muted small">Sin datos en el período</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts fila 2 -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-7">
          <div class="chart-card">
            <div class="chart-ttl"><i class="bi bi-graph-up-arrow me-2 text-success"></i>Cobros por mes</div>
            <div style="height:240px"><Bar :key="isDark" :data="chartCobros" :options="optsBar" /></div>
          </div>
        </div>
        <div class="col-12 col-lg-5">
          <div class="chart-card">
            <div class="chart-ttl"><i class="bi bi-trophy-fill me-2 text-warning"></i>Top 5 Asesores del período</div>
            <div style="height:240px">
              <Bar v-if="adminData.graficos.top_asesores.length" :key="isDark" :data="chartTopAsesores" :options="optsHBar" />
              <span v-else class="text-muted d-flex align-items-center justify-content-center h-100 small">Sin datos</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Listados Admin -->
      <div class="row g-3">
        <div class="col-12 col-xl-6">
          <div class="list-card">
            <div class="list-ttl"><i class="bi bi-clock-history me-2 text-primary"></i>Últimas ventas registradas</div>
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light">
                  <tr><th>Fecha</th><th>Cliente</th><th>Asesor</th><th>Tipo</th><th class="text-end">Monto</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!adminData.listados.ultimas_ventas.length">
                    <td colspan="5" class="text-center text-muted py-3">Sin ventas en el período</td>
                  </tr>
                  <tr v-for="v in adminData.listados.ultimas_ventas" :key="v.id">
                    <td class="text-nowrap">{{ fmtFecha(v.fecha) }}</td>
                    <td>{{ v.cliente?.nombre_completo ?? '-' }}</td>
                    <td>{{ v.asesor?.nombre_completo ?? '-' }}</td>
                    <td>
                      <span class="badge" :class="v.tipo_venta === 'CREDITO' ? 'bg-primary-subtle text-primary' : 'bg-success-subtle text-success'">
                        {{ v.tipo_venta === 'CREDITO' ? 'Crédito' : 'Contado' }}
                      </span>
                    </td>
                    <td class="text-end fw-semibold">{{ simbolo }} {{ fmt(v.monto_total) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-6">
          <div class="list-card">
            <div class="list-ttl"><i class="bi bi-exclamation-triangle-fill me-2 text-danger"></i>Cuotas vencidas (más antiguas)</div>
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light">
                  <tr><th>Cliente</th><th>N° Cuota</th><th>Vencimiento</th><th>Atraso</th><th class="text-end">Monto</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!adminData.listados.cuotas_vencidas.length">
                    <td colspan="5" class="text-center text-muted py-3">Sin cuotas vencidas</td>
                  </tr>
                  <tr v-for="c in adminData.listados.cuotas_vencidas" :key="c.id">
                    <td>{{ c.plan_pago?.nota_venta?.cliente?.nombre_completo ?? '-' }}</td>
                    <td class="text-center">{{ c.numero_cuota }}</td>
                    <td class="text-nowrap text-danger">{{ fmtFecha(c.fecha_vencimiento) }}</td>
                    <td><span class="badge bg-danger-subtle text-danger">{{ diasAtraso(c.fecha_vencimiento) }}d</span></td>
                    <td class="text-end fw-semibold">{{ simbolo }} {{ fmt(c.monto_cuota) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-12">
          <div class="list-card">
            <div class="list-ttl"><i class="bi bi-people-fill me-2 text-info"></i>Top deudores por saldo pendiente</div>
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light">
                  <tr><th>#</th><th>Cliente</th><th>Fecha venta</th><th class="text-end">Saldo pendiente</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!adminData.listados.top_deudores.length">
                    <td colspan="4" class="text-center text-muted py-3">Sin deudores activos</td>
                  </tr>
                  <tr v-for="(d, i) in adminData.listados.top_deudores" :key="d.id">
                    <td class="text-muted">{{ i + 1 }}</td>
                    <td class="fw-semibold">{{ d.cliente?.nombre_completo ?? '-' }}</td>
                    <td>{{ fmtFecha(d.fecha) }}</td>
                    <td class="text-end fw-bold text-primary">{{ simbolo }} {{ fmt(d.saldo_credito) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- ═══════════════════════ ASESOR ═══════════════════════ -->
    <template v-if="!cargando && !isAdmin && asesorData">

      <!-- KPIs -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="kpi border-primary">
            <div class="kpi-icon bg-primary-subtle text-primary"><i class="bi bi-cart-check-fill fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Mis ventas</div>
              <div class="kpi-val">{{ simbolo }} {{ fmt(asesorData.kpis.ventas_monto) }}</div>
              <div class="kpi-sub">{{ fmtInt(asesorData.kpis.ventas_cantidad) }} venta(s)</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="kpi border-success">
            <div class="kpi-icon bg-success-subtle text-success"><i class="bi bi-award-fill fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Comisión estimada</div>
              <div class="kpi-val text-success">{{ simbolo }} {{ fmt(asesorData.kpis.comision_estimada) }}</div>
              <div class="kpi-sub">En el período</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="kpi border-danger">
            <div class="kpi-icon bg-danger-subtle text-danger"><i class="bi bi-exclamation-circle-fill fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Cuotas vencidas</div>
              <div class="kpi-val text-danger">{{ fmtInt(asesorData.kpis.cuotas_vencidas) }}</div>
              <div class="kpi-sub">De mis clientes</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="kpi border-warning">
            <div class="kpi-icon bg-warning-subtle text-warning"><i class="bi bi-alarm-fill fs-4"></i></div>
            <div>
              <div class="kpi-lbl">Vencen en 7 días</div>
              <div class="kpi-val">{{ fmtInt(asesorData.kpis.proximas_cuotas_7dias) }}</div>
              <div class="kpi-sub">Cuotas próximas</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-8">
          <div class="chart-card">
            <div class="chart-ttl"><i class="bi bi-bar-chart-fill me-2 text-primary"></i>Mis ventas por mes (últimos 6 meses)</div>
            <div style="height:260px"><Bar :key="isDark" :data="chartMisVentas" :options="optsBar" /></div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="chart-card">
            <div class="chart-ttl"><i class="bi bi-pie-chart-fill me-2 text-success"></i>Estado de mi cartera</div>
            <div style="height:260px" class="d-flex align-items-center justify-content-center">
              <Doughnut
                v-if="asesorData.graficos.mi_cartera.saldo_vigente > 0 || asesorData.graficos.mi_cartera.monto_cuotas_vencidas > 0"
                :key="isDark"
                :data="chartMiCartera"
                :options="optsDoughnut"
              />
              <span v-else class="text-muted small">Sin cartera activa</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Listados Asesor -->
      <div class="row g-3">
        <div class="col-12 col-xl-6">
          <div class="list-card">
            <div class="list-ttl"><i class="bi bi-exclamation-triangle-fill me-2 text-danger"></i>Mis clientes con mora</div>
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light">
                  <tr><th>Cliente</th><th>N° Cuota</th><th>Vencimiento</th><th>Atraso</th><th class="text-end">Monto</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!asesorData.listados.clientes_con_mora.length">
                    <td colspan="5" class="text-center text-muted py-3">Sin mora registrada</td>
                  </tr>
                  <tr v-for="c in asesorData.listados.clientes_con_mora" :key="c.id">
                    <td>{{ c.plan_pago?.nota_venta?.cliente?.nombre_completo ?? '-' }}</td>
                    <td class="text-center">{{ c.numero_cuota }}</td>
                    <td class="text-nowrap text-danger">{{ fmtFecha(c.fecha_vencimiento) }}</td>
                    <td><span class="badge bg-danger-subtle text-danger">{{ diasAtraso(c.fecha_vencimiento) }}d</span></td>
                    <td class="text-end fw-semibold">{{ simbolo }} {{ fmt(c.monto_cuota) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="col-12 col-xl-6">
          <div class="list-card">
            <div class="list-ttl"><i class="bi bi-calendar-check-fill me-2 text-warning"></i>Próximas cuotas a vencer (30 días)</div>
            <div class="table-responsive">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light">
                  <tr><th>Cliente</th><th>N° Cuota</th><th>Vencimiento</th><th class="text-end">Monto</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!asesorData.listados.proximas_cuotas.length">
                    <td colspan="4" class="text-center text-muted py-3">Sin cuotas próximas</td>
                  </tr>
                  <tr v-for="c in asesorData.listados.proximas_cuotas" :key="c.id">
                    <td>{{ c.plan_pago?.nota_venta?.cliente?.nombre_completo ?? '-' }}</td>
                    <td class="text-center">{{ c.numero_cuota }}</td>
                    <td class="text-nowrap">{{ fmtFecha(c.fecha_vencimiento) }}</td>
                    <td class="text-end fw-semibold">{{ simbolo }} {{ fmt(c.monto_cuota) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- Sin datos -->
    <div v-if="!cargando && errorCarga" class="alert alert-danger" role="alert">
      {{ errorCarga }}
    </div>

  </div>
</template>

<style scoped>
.dash-wrap { max-width: 1400px; margin: 0 auto; }

.kpi {
  background: var(--bg-card);
  color: var(--text-main);
  border-radius: 10px;
  padding: 1rem 1.1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 15px rgba(11, 37, 69, 0.05);
  height: 100%;
  border-left-width: 4px !important;
  border-left-style: solid !important;
  transition: background-color 0.3s ease, color 0.3s ease;
}
.kpi-icon {
  width: 52px; height: 52px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.kpi-lbl { font-size: .78rem; color: var(--text-muted); font-weight: 500; }
.kpi-val { font-size: 1.2rem; font-weight: 700; line-height: 1.2; color: var(--text-main); }
.kpi-sub { font-size: .73rem; color: var(--text-muted); }

.chart-card,
.list-card {
  background: var(--bg-card);
  color: var(--text-main);
  border-radius: 10px;
  padding: 1rem 1.2rem;
  box-shadow: 0 4px 15px rgba(11, 37, 69, 0.05);
  height: 100%;
  transition: background-color 0.3s ease, color 0.3s ease;
}
.chart-ttl,
.list-ttl {
  font-size: .84rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: .75rem;
  padding-bottom: .5rem;
  border-bottom: 1px solid var(--border-color);
}

.table th { 
  font-size: .75rem; 
  font-weight: 600; 
  color: var(--text-muted);
}
.table td { 
  font-size: .82rem; 
  vertical-align: middle; 
  color: var(--text-main);
}

/* Ajustes para inputs en modo oscuro dentro del dash */
.input-group-text {
  background-color: var(--bg-card) !important;
  border-color: var(--border-color) !important;
  color: var(--text-main) !important;
}

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .7s linear infinite; display: inline-block; }

[data-theme="dark"] .kpi-icon.bg-primary-subtle { background-color: rgba(96, 165, 250, 0.15) !important; }
[data-theme="dark"] .kpi-icon.bg-success-subtle { background-color: rgba(52, 211, 153, 0.15) !important; }
[data-theme="dark"] .kpi-icon.bg-danger-subtle { background-color: rgba(251, 113, 133, 0.15) !important; }
[data-theme="dark"] .kpi-icon.bg-info-subtle { background-color: rgba(56, 189, 248, 0.15) !important; }
[data-theme="dark"] .kpi-icon.bg-warning-subtle { background-color: rgba(251, 191, 36, 0.15) !important; }
</style>
