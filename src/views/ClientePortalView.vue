<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios'

const cargando = ref(true)
const error    = ref(null)
const cliente  = ref(null)
const ventas   = ref([])
const comprobantePendiente = ref(null)
const errorComprobante = ref('')

async function descargarComprobante(id) {
  comprobantePendiente.value = id
  errorComprobante.value = ''
  try {
    const { data } = await api.get(`/mi-cartera/pagos/${id}/comprobante`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `comprobante-${id}.pdf`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    errorComprobante.value = 'No se pudo descargar el comprobante. Vuelve a intentarlo.'
  } finally {
    comprobantePendiente.value = null
  }
}

onMounted(async () => {
  try {
    const res = await api.get('/mi-cartera')
    cliente.value = res.data.cliente
    ventas.value  = res.data.ventas
  } catch (e) {
    error.value = 'No se pudo cargar tu información. Intenta más tarde.'
  } finally {
    cargando.value = false
  }
})

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const estadoCuotaClass = (estado) => ({
  'badge bg-success'  : estado === 'Pagada',
  'badge bg-danger'   : estado === 'Vencida',
  'badge bg-secondary': estado === 'Pendiente',
})

const resumenVenta = (venta) => {
  const cuotas   = venta.plan_pago?.cuotas ?? []
  const pagadas  = cuotas.filter(c => c.estado === 'Pagada').length
  const vencidas = cuotas.filter(c => c.estado === 'Vencida').length
  const proxima  = cuotas.find(c => c.estado === 'Pendiente' || c.estado === 'Vencida')
  return { total: cuotas.length, pagadas, vencidas, proxima }
}

const ventasCredito  = computed(() => ventas.value.filter(v => v.tipo_venta === 'CREDITO'))
const ventasContado  = computed(() => ventas.value.filter(v => v.tipo_venta === 'CONTADO'))
</script>

<template>
  <div class="portal-wrapper min-vh-100 py-4 px-3">

    <!-- CARGANDO -->
    <div v-if="cargando" class="text-center py-5">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;"></div>
      <p class="mt-3 text-muted">Cargando tu información...</p>
    </div>

    <!-- ERROR -->
    <div v-else-if="error" class="container" style="max-width:700px">
      <div class="alert alert-danger rounded-4 shadow-sm">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
      </div>
    </div>

    <div v-else class="container" style="max-width:960px">

      <!-- ENCABEZADO DEL CLIENTE -->
      <div class="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
        <div class="card-body p-0">
          <div class="d-flex flex-column flex-md-row align-items-center gap-4 p-4"
               style="background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));">
            <div class="rounded-circle bg-white d-flex align-items-center justify-content-center flex-shrink-0"
                 style="width:70px;height:70px;">
              <i class="bi bi-person-fill fs-1" style="color:var(--primary-color);"></i>
            </div>
            <div class="text-white text-center text-md-start">
              <h4 class="fw-bold mb-1">{{ cliente.nombre_completo }}</h4>
              <div class="d-flex flex-wrap gap-3 justify-content-center justify-content-md-start opacity-90 small">
                <span><i class="bi bi-card-text me-1"></i>CI: {{ cliente.ci }} {{ cliente.lugar_expedicion }}</span>
                <span v-if="cliente.telefono"><i class="bi bi-telephone me-1"></i>{{ cliente.telefono }}</span>
                <span v-if="cliente.correo"><i class="bi bi-envelope me-1"></i>{{ cliente.correo }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SIN VENTAS -->
      <div v-if="ventas.length === 0" class="text-center py-5">
        <i class="bi bi-folder2-open display-4 text-muted opacity-50"></i>
        <p class="mt-3 text-muted">No tienes compras registradas aún.</p>
      </div>

      <!-- VENTAS A CRÉDITO -->
      <template v-if="ventasCredito.length">
        <h5 class="fw-bold mb-3" style="color:var(--text-main)">
          <i class="bi bi-credit-card-2-front me-2 text-primary"></i>Mis Créditos
        </h5>

        <div v-for="venta in ventasCredito" :key="venta.id" class="card border-0 shadow-sm rounded-4 mb-4">

          <!-- Cabecera propiedad -->
          <div class="card-header border-0 rounded-top-4 py-3 px-4"
               style="background:var(--bg-card)">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <span class="fw-bold text-primary me-2">
                  {{ venta.propiedad?.codigo }} — {{ venta.propiedad?.tipo }}
                </span>
                <small class="text-muted">
                  <i class="bi bi-geo-alt-fill text-danger me-1"></i>
                  {{ venta.propiedad?.sector_urbano?.nombre }}
                  <template v-if="venta.propiedad?.sector_urbano?.distrito?.ciudad?.nombre">
                    , {{ venta.propiedad.sector_urbano.distrito.ciudad.nombre }}
                  </template>
                </small>
              </div>
              <div class="text-end">
                <div class="small text-muted">Precio total</div>
                <div class="fw-bold">{{ venta.propiedad?.moneda }} {{ fmt(venta.monto_total) }}</div>
              </div>
            </div>
          </div>

          <div class="card-body p-4">

            <!-- Resumen del plan -->
            <div v-if="venta.plan_pago" class="row g-3 mb-4">
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3 text-center" style="background:var(--bg-body)">
                  <div class="small text-muted mb-1">Cuota inicial</div>
                  <div class="fw-bold text-success">{{ venta.propiedad?.moneda }} {{ fmt(venta.cuota_inicial) }}</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3 text-center" style="background:var(--bg-body)">
                  <div class="small text-muted mb-1">Saldo crédito</div>
                  <div class="fw-bold text-danger">{{ venta.propiedad?.moneda }} {{ fmt(venta.saldo_credito) }}</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3 text-center" style="background:var(--bg-body)">
                  <div class="small text-muted mb-1">Plazo</div>
                  <div class="fw-bold">{{ venta.plan_pago.plazo }}</div>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="p-3 rounded-3 text-center" style="background:var(--bg-body)">
                  <div class="small text-muted mb-1">Tasa interés</div>
                  <div class="fw-bold">{{ venta.plan_pago.tasa_interes }}% anual</div>
                </div>
              </div>
            </div>

            <!-- Progreso de cuotas -->
            <template v-if="venta.plan_pago?.cuotas?.length">
              <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="small fw-bold text-muted text-uppercase">Progreso de cuotas</span>
                <span class="small text-muted">
                  {{ resumenVenta(venta).pagadas }} / {{ resumenVenta(venta).total }} pagadas
                </span>
              </div>
              <div class="progress mb-3 rounded-pill" style="height:8px;">
                <div class="progress-bar bg-success rounded-pill" role="progressbar"
                  :style="{ width: (resumenVenta(venta).pagadas / resumenVenta(venta).total * 100) + '%' }">
                </div>
              </div>

              <!-- Próxima cuota -->
              <div v-if="resumenVenta(venta).proxima"
                   class="alert py-2 px-3 mb-3 rounded-3 border-0 d-flex align-items-center gap-2"
                   :class="resumenVenta(venta).proxima.estado === 'Vencida' ? 'alert-danger' : 'alert-warning'">
                <i class="bi"
                   :class="resumenVenta(venta).proxima.estado === 'Vencida' ? 'bi-exclamation-circle-fill' : 'bi-calendar-event-fill'"></i>
                <span class="small">
                  <strong>
                    {{ resumenVenta(venta).proxima.estado === 'Vencida' ? 'Cuota vencida:' : 'Próxima cuota:' }}
                  </strong>
                  Cuota #{{ resumenVenta(venta).proxima.numero_cuota }} —
                  Vence {{ resumenVenta(venta).proxima.fecha_vencimiento }} —
                  <strong>{{ venta.propiedad?.moneda }} {{ fmt(resumenVenta(venta).proxima.monto_cuota) }}</strong>
                </span>
              </div>

              <!-- Tabla de cuotas -->
              <div class="table-responsive rounded-3 border">
                <table class="table table-sm table-hover mb-0" style="font-size:0.82rem;">
                  <thead style="background:var(--bg-body)">
                    <tr class="text-muted small text-uppercase">
                      <th class="py-2 ps-3">#</th>
                      <th>Vencimiento</th>
                      <th class="text-end">Cuota</th>
                      <th class="text-end">Capital</th>
                      <th class="text-end">Interés</th>
                      <th class="text-end">Saldo</th>
                      <th class="text-center pe-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="cuota in venta.plan_pago.cuotas" :key="cuota.id"
                        :class="{ 'table-danger': cuota.estado === 'Vencida', 'table-success bg-opacity-50': cuota.estado === 'Pagada' }">
                      <td class="py-2 ps-3 fw-bold text-muted">{{ cuota.numero_cuota }}</td>
                      <td>{{ cuota.fecha_vencimiento }}</td>
                      <td class="text-end fw-bold">{{ fmt(cuota.monto_cuota) }}</td>
                      <td class="text-end">{{ fmt(cuota.monto_capital) }}</td>
                      <td class="text-end text-danger">{{ fmt(cuota.monto_interes) }}</td>
                      <td class="text-end">{{ fmt(cuota.saldo_capital) }}</td>
                      <td class="text-center pe-3">
                        <span :class="estadoCuotaClass(cuota.estado)" style="font-size:0.7rem;">
                          {{ cuota.estado }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>

          </div>
        </div>
      </template>

      <!-- VENTAS AL CONTADO -->
      <template v-if="ventasContado.length">
        <h5 class="fw-bold mb-3" style="color:var(--text-main)">
          <i class="bi bi-house-check me-2 text-success"></i>Compras al Contado
        </h5>

        <div v-for="venta in ventasContado" :key="venta.id"
             class="card border-0 shadow-sm rounded-4 mb-3">
          <div class="card-body p-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <div class="fw-bold text-primary">
                {{ venta.propiedad?.codigo }} — {{ venta.propiedad?.tipo }}
              </div>
              <div class="small text-muted">
                <i class="bi bi-geo-alt-fill text-danger me-1"></i>
                {{ venta.propiedad?.sector_urbano?.nombre }}
                <template v-if="venta.propiedad?.sector_urbano?.distrito?.ciudad?.nombre">
                  , {{ venta.propiedad.sector_urbano.distrito.ciudad.nombre }}
                </template>
              </div>
              <div class="small text-muted mt-1">
                <i class="bi bi-calendar2-check me-1"></i>Fecha de venta: {{ venta.fecha }}
              </div>
            </div>
            <div class="text-end">
              <div class="small text-muted">Monto pagado</div>
              <div class="h5 fw-bold text-success mb-0">
                {{ venta.propiedad?.moneda }} {{ fmt(venta.monto_liquido ?? venta.monto_total) }}
              </div>
              <span class="badge bg-success mt-1">Pagado al contado</span>
            </div>
          </div>
        </div>
      </template>

      <section v-if="ventas.some(venta => venta.pagos?.length)" class="card border-0 shadow-sm rounded-4 my-4">
        <div class="card-body p-4">
          <h5 class="fw-bold mb-3">Comprobantes de pago</h5>
          <p v-if="errorComprobante" class="alert alert-danger" role="alert">{{ errorComprobante }}</p>
          <template v-for="venta in ventas" :key="venta.id">
            <div v-for="pago in venta.pagos" :key="pago.id" class="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom py-2">
              <span>{{ venta.propiedad?.codigo }} · {{ pago.fecha_pago }} · {{ venta.moneda ?? venta.propiedad?.moneda }} {{ fmt(pago.monto) }}</span>
              <button class="btn btn-sm btn-outline-primary" :disabled="comprobantePendiente !== null" @click="descargarComprobante(pago.id)">
                {{ comprobantePendiente === pago.id ? 'Descargando…' : 'Descargar PDF' }}
              </button>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.portal-wrapper {
  background-color: var(--bg-body);
}
.rounded-top-4 {
  border-radius: 1rem 1rem 0 0 !important;
}
</style>
