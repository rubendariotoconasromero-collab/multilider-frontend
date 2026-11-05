<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api/axios'
import { useCompanyStore } from '@/stores/company'

// ── Tema ─────────────────────────────────────────────────────────────────────
const isDark = ref(false)
const toggleTheme = () => {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme-override', theme)
}

const route = useRoute()
const companyStore = useCompanyStore()
const baseUrl = import.meta.env.VITE_API_URL

// ── Estado del wizard ────────────────────────────────────────────────────────
const step = ref(1)
const buscando = ref(false)
const procesando = ref(false)

// ── Paso 1 ───────────────────────────────────────────────────────────────────
const ciInput = ref('')
const errorBusqueda = ref('')

// ── Paso 2 ───────────────────────────────────────────────────────────────────
const cliente = ref(null)
const pagosContado = ref([])
const cuotasPendientes = ref([])
const cuotasSeleccionadas = ref([])
const pagoContadoSeleccionado = ref(null)

// ── Paso 3 ───────────────────────────────────────────────────────────────────
const formPagador = ref({
  ci_pagador: '',
  telefono_pagador: '',
  nombres_pagador: '',
  apellidos_pagador: '',
  correo_pagador: '',
})
const aceptaTerminos = ref(false)
const erroresPagador = ref({})

// ── Paso 4 ───────────────────────────────────────────────────────────────────
const urlPago = ref('')
const qrUrl = ref('')
const idTransaccion = ref('')
const estadoPago = ref('PENDIENTE')
const storageKey = 'payment-test-reference:' + import.meta.env.VITE_API_URL
const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let remembered = ''
try { remembered = sessionStorage.getItem(storageKey) || '' } catch { /* optional recovery storage */ }
if (!uuidFormat.test(remembered)) remembered = ''
const operacionPrueba = ref(remembered || crypto.randomUUID())
let pollingInterval = null
let pollingTimeout  = null   // handle del setTimeout de 15 min
let pollingBusy     = false  // guard: evita peticiones solapadas

// ── Computed ─────────────────────────────────────────────────────────────────
const pagoIdsSeleccionados = computed(() => {
  const ids = []
  if (pagoContadoSeleccionado.value) ids.push(pagoContadoSeleccionado.value)
  return ids
})

const totalSeleccionado = computed(() => ((pagoIdsSeleccionados.value.length + cuotasSeleccionadas.value.length) * 0.20).toFixed(2))

const haySeleccion = computed(() =>
  pagoContadoSeleccionado.value !== null || cuotasSeleccionadas.value.length > 0
)

const formularioPagadorValido = computed(() => {
  const f = formPagador.value
  return f.ci_pagador && f.telefono_pagador && f.nombres_pagador && f.apellidos_pagador && f.correo_pagador && aceptaTerminos.value
})

// ── Paso 1: Buscar cliente ────────────────────────────────────────────────────
const buscarCliente = async () => {
  if (!ciInput.value.trim() || !companyStore.testPaymentsAvailable) return
  errorBusqueda.value = ''
  buscando.value = true
  try {
    const res = await api.post('/public/clientes/buscar', { ci: ciInput.value.trim() })
    cliente.value = res.data.cliente
    pagosContado.value = res.data.pagos_contado
    cuotasPendientes.value = res.data.cuotas_pendientes
    pagoContadoSeleccionado.value = null
    cuotasSeleccionadas.value = []
    step.value = 2
  } catch (err) {
    if (err.response?.status === 404) {
      errorBusqueda.value = err.response.data.message || 'CI no encontrado.'
    } else {
      errorBusqueda.value = 'Error al buscar. Intente nuevamente.'
    }
  } finally {
    buscando.value = false
  }
}

// ── Paso 2: Selección ────────────────────────────────────────────────────────
const toggleCuota = (cuotaId) => {
  const idx = cuotasSeleccionadas.value.indexOf(cuotaId)
  if (idx === -1) cuotasSeleccionadas.value.push(cuotaId)
  else cuotasSeleccionadas.value.splice(idx, 1)
}

const toggleContado = (pagoId) => {
  pagoContadoSeleccionado.value = pagoContadoSeleccionado.value === pagoId ? null : pagoId
}

const irPaso3 = () => {
  if (!haySeleccion.value) return
  formPagador.value.ci_pagador = cliente.value.ci || ''
  formPagador.value.telefono_pagador = cliente.value.telefono || ''
  formPagador.value.correo_pagador = cliente.value.correo || ''
  const parts = (cliente.value.nombre_completo || '').split(' ')
  formPagador.value.nombres_pagador = parts.slice(0, Math.ceil(parts.length / 2)).join(' ')
  formPagador.value.apellidos_pagador = parts.slice(Math.ceil(parts.length / 2)).join(' ')
  step.value = 3
}

// ── Paso 3: Procesar ─────────────────────────────────────────────────────────
const procesarPago = async () => {
  if (procesando.value || !companyStore.testPaymentsAvailable) return
  erroresPagador.value = {}
  procesando.value = true
  try { sessionStorage.setItem(storageKey, operacionPrueba.value) } catch { /* do not store payer details */ }
  try {
    const payload = {
      operacion_id: operacionPrueba.value,
      pago_ids:   pagoIdsSeleccionados.value,
      cuota_ids:  cuotasSeleccionadas.value,
      cliente_id: cliente.value.id,
      ...formPagador.value,
    }
    const res = await api.post('/public/pagos/procesar', payload)
    idTransaccion.value = res.data.id_transaccion
    urlPago.value = res.data.url_pago || ''
    qrUrl.value = res.data.qr_url || ''
    estadoPago.value = 'PENDIENTE'

    if (urlPago.value && companyStore.libelulaEnabled === 0) {
      // Modo 0: redirige en la misma pestaña, sin mostrar el paso 4
      window.location.href = urlPago.value
      return
    }

    step.value = 4
    iniciarPolling()

    if (urlPago.value && companyStore.libelulaEnabled === 2) {
      // Modo 2: abre la pasarela en popup; BroadcastChannel notifica esta pestaña al completar
      abrirPopup()
    }
  } catch (err) {
    if (err.response?.status === 422) {
      erroresPagador.value = err.response.data.errors || {}
    }
    const msg = err.response?.data?.message || 'Error al procesar el pago.'
    alert(msg)
  } finally {
    procesando.value = false
  }
}

// ── Canal entre pestañas (BroadcastChannel) ──────────────────────────────────
const pagoChannel = new BroadcastChannel('multilider_pagos')

// ── Paso 4: Polling ───────────────────────────────────────────────────────────
const confirmarPago = (data) => {
  if (data?.estado !== 'PAGADO_PRUEBA') return
  estadoPago.value = 'PAGADO_PRUEBA'
  try { sessionStorage.removeItem(storageKey) } catch { /* storage optional */ }
  detenerPolling()
}

const iniciarPolling = () => {
  if (pollingInterval) return  // guard: evita doble arranque

  pollingInterval = setInterval(async () => {
    if (pollingBusy) return    // skip si la petición anterior aún no terminó
    pollingBusy = true
    try {
      const res = await api.get(`/public/pagos/verificar/${idTransaccion.value}`)
      if (res.data.estado === 'PAGADO_PRUEBA') confirmarPago(res.data)
    } catch (err) {
      if (err.response?.status === 404) detenerPolling()  // txn inválida, detener
    } finally {
      pollingBusy = false
    }
  }, 3000)

  // Guardar el handle para poder cancelarlo si el pago se confirma antes
  pollingTimeout = setTimeout(detenerPolling, 15 * 60 * 1000)
}

const detenerPolling = () => {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
  if (pollingTimeout)  { clearTimeout(pollingTimeout);  pollingTimeout  = null }
  pollingBusy = false
}


onMounted(async () => {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'

  const txn = route.query.txn || (remembered ? `TEMP-${remembered}` : null)

  if (!txn) {
    // Registrar el listener ANTES de cualquier await para evitar la race condition
    // donde el mensaje del BroadcastChannel llega mientras fetchCompany está en curso
    pagoChannel.onmessage = (event) => {
      if (event.data?.tipo === 'PAGO_CONFIRMADO' && event.data.txn === idTransaccion.value) {
        verificarPago()
      }
    }
  }

  // Hidratar datos de empresa si se recargó directamente esta página
  if (!companyStore.company) {
    await companyStore.fetchCompany().catch(() => {})
  }

  if (txn) {
    idTransaccion.value = txn
    step.value = 4
    estadoPago.value = 'PENDIENTE'
    try {
      const result = await api.post('/public/pagos/confirmar-retorno', { id_transaccion: txn })
      urlPago.value = result.data.url_pago || ''
      qrUrl.value = result.data.qr_url || ''
      if (result.data.estado === 'PAGADO_PRUEBA') {
        confirmarPago(result.data)
        pagoChannel.postMessage({ tipo: 'PAGO_CONFIRMADO', txn })
      } else iniciarPolling()
    } catch (error) {
      if (error.response?.status === 404 && !route.query.txn) {
        step.value = 1
        errorBusqueda.value = 'Todavía no encontramos la orden. Si reenvías los mismos datos se conservará la referencia.'
      } else iniciarPolling()
    }
  }
})

onUnmounted(() => {
  detenerPolling()
  pagoChannel.close()
})

// Modo 0: redirige en la misma pestaña
const abrirPagina = () => { window.location.href = urlPago.value }

// Modo 2: abre ventana popup centrada
const popupBloqueado = ref(false)

const abrirPopup = () => {
  const w = 960, h = 720
  const left = Math.round((screen.width - w) / 2)
  const top  = Math.round((screen.height - h) / 2)
  const popup = window.open(
    urlPago.value,
    'libelula_pago',
    `width=${w},height=${h},scrollbars=yes,resizable=yes,left=${left},top=${top}`
  )
  popupBloqueado.value = !popup || popup.closed
}

const verificandoPago = ref(false)
const mensajeVerificacion = ref('')
const tipoMensaje = ref('') // 'ok' | 'error'

const verificarPago = async () => {
  mensajeVerificacion.value = ''
  verificandoPago.value = true
  try {
    const res = await api.get(`/public/pagos/verificar/${idTransaccion.value}`)
    if (res.data.estado === 'PAGADO_PRUEBA') {
      confirmarPago(res.data)
    } else {
      tipoMensaje.value = 'error'
      mensajeVerificacion.value = 'Aún no confirmamos tu pago. Si ya pagaste, espera unos segundos e intenta nuevamente.'
    }
  } catch {
    tipoMensaje.value = 'error'
    mensajeVerificacion.value = 'No se pudo verificar el estado. Intenta nuevamente.'
  } finally {
    verificandoPago.value = false
  }
}
const nuevoPago = () => {
  operacionPrueba.value = crypto.randomUUID()
  step.value = 1; ciInput.value = ''; errorBusqueda.value = ''
  cliente.value = null; pagosContado.value = []; cuotasPendientes.value = []
  cuotasSeleccionadas.value = []; pagoContadoSeleccionado.value = null
  urlPago.value = ''; qrUrl.value = ''; idTransaccion.value = ''; estadoPago.value = 'PENDIENTE'
  aceptaTerminos.value = false; erroresPagador.value = {}
  mensajeVerificacion.value = ''; tipoMensaje.value = ''
  detenerPolling()
}

// Fix: strip time component (e.g. "2024-01-15T00:00:00Z") before parsing to avoid "Invalid Date"
const formatFecha = (f) => {
  if (!f) return '-'
  const datePart = String(f).substring(0, 10)
  return new Date(datePart + 'T00:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}
const formatMonto = (m) => new Intl.NumberFormat('es-BO').format(m)
</script>

<template>
  <div class="alert alert-warning text-center mb-0" role="status">Modo de prueba: Bs 0,20 por concepto. La prueba no liquida la deuda real.</div>
  <div v-if="step === 4 && estadoPago !== 'PAGADO_PRUEBA' && !cliente" class="alert alert-info text-center" role="status">
    Estamos verificando la prueba de pago.
    <button v-if="urlPago" class="btn btn-sm btn-outline-primary ms-2" @click="abrirPagina">Abrir pasarela</button>
    <button class="btn btn-sm btn-outline-primary ms-2" @click="verificarPago" :disabled="verificandoPago">Verificar resultado</button>
  </div>
  <div v-if="!companyStore.testPaymentsAvailable && step === 1" class="alert alert-secondary text-center">El registro de nuevas pruebas no está disponible.</div>
  <div class="pp-bg min-vh-100 d-flex flex-column">

    <!-- Header -->
    <header class="pp-header py-2 shadow-sm">
      <div class="container-xl d-flex align-items-center justify-content-between">
        <RouterLink to="/" class="d-flex align-items-center gap-2 text-decoration-none group">
          <div class="logo-box rounded-3 p-1 transition-all">
             <img v-if="companyStore.company?.logo" 
                  :src="baseUrl + companyStore.company.logo" 
                  class="pp-logo-filter"
                  style="max-height: 40px; object-fit: contain;">
             <i v-else class="bi bi-hexagon-fill fs-3 pp-accent-color"></i>
          </div>
          <span class="fw-black fs-4 text-dark tracking-tighter d-none d-sm-inline">
            {{ companyStore.company?.nombre || 'Multilider' }}
          </span>
        </RouterLink>

        <div class="d-flex align-items-center gap-2 gap-sm-3">
          <RouterLink to="/" class="btn btn-sm btn-light border rounded-pill px-3 d-flex align-items-center gap-1">
            <i class="bi bi-house"></i> <span class="d-none d-sm-inline">Inicio</span>
          </RouterLink>
          <button
            class="btn btn-link p-2 border-0 text-decoration-none"
            @click="toggleTheme"
            :title="isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          >
            <i class="fs-5" :class="isDark ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-stars-fill text-secondary'"></i>
          </button>
          <span class="text-muted small border-start ps-2 ps-sm-3 d-flex align-items-center">
            <i class="bi bi-shield-lock-fill text-success me-1"></i>
            <span class="d-none d-md-inline">Pago seguro</span>
          </span>
        </div>
      </div>
    </header>

    <div class="flex-grow-1 py-4 py-lg-5 px-3">
      <div class="container-xl">

        <!-- ═══ PASO 1: BUSCAR (Diseño centrado) ═══ -->
        <div v-if="step === 1" class="pp-card shadow-lg mx-auto" style="max-width: 500px;">
          <div class="text-center mb-5">
            <h4 class="fw-bold mb-1">Consultar mis pagos pendientes</h4>
            <p class="text-muted small mb-0">Ingresa tu número de cédula de identidad para continuar</p>
          </div>

          <div class="mx-auto">
            <label class="form-label fw-semibold small text-uppercase letter-spacing-1">Número de CI</label>
            <div class="input-group input-group-lg pp-input-group">
              <span class="input-group-text">
                <i class="bi bi-card-text pp-accent-color"></i>
              </span>
              <input
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errorBusqueda }"
                v-model="ciInput"
                placeholder="Ej: 12345678"
                @keyup.enter="buscarCliente"
                :disabled="buscando"
              >
              <button
                class="btn btn-primary px-4 fw-bold"
                @click="buscarCliente"
                :disabled="buscando || !ciInput.trim() || !companyStore.testPaymentsAvailable"
              >
                <span v-if="buscando" class="spinner-border spinner-border-sm me-1"></span>
                {{ buscando ? 'Buscando…' : 'Buscar' }}
              </button>
            </div>
            <div v-if="errorBusqueda" class="alert alert-danger d-flex align-items-center gap-2 mt-3 py-2 small">
              <i class="bi bi-exclamation-circle-fill flex-shrink-0"></i>
              <span>{{ errorBusqueda }}</span>
            </div>
            <p class="text-muted text-center mt-4" style="font-size:.78rem">
              <i class="bi bi-info-circle me-1"></i>
              Solo se mostrarán pagos pendientes asociados a tu CI registrado en el sistema.
            </p>
          </div>
        </div>

        <!-- ═══ PASOS 2, 3 y 4: SELECCIÓN, CONFIRMACIÓN Y QR (Dos columnas) ═══ -->
        <div v-else-if="(step === 2 || step === 3 || (step === 4 && estadoPago !== 'PAGADO_PRUEBA')) && cliente" class="row g-4 justify-content-center">
          
          <!-- Columna Izquierda: Stepper + Content -->
          <div class="col-lg-8">
            <div class="pp-card shadow-sm p-4 p-md-5">
              
              <!-- Stepper -->
              <div class="pp-stepper mb-5">
                <template v-for="(label, i) in ['Buscar', 'Seleccionar', 'Confirmar', 'Pagar']" :key="i">
                  <div class="pp-step" :class="{ 'pp-step--done': step > i + 1, 'pp-step--current': step === i + 1 }">
                    <div class="pp-step-circle">
                      <i v-if="step > i + 1" class="bi bi-check-lg"></i>
                      <span v-else>{{ i + 1 }}</span>
                    </div>
                    <span class="pp-step-label d-none d-md-block">{{ label }}</span>
                  </div>
                  <div v-if="i < 3" class="pp-step-line" :class="{ 'pp-step-line--active': step > i + 1 }"></div>
                </template>
              </div>

              <!-- PASO 2: SELECCIONAR -->
              <div v-if="step === 2" class="paso-fade">
                <!-- ... existing step 2 content ... -->
                <div class="pp-cliente-card d-flex align-items-center gap-3 mb-5">
                  <div class="pp-avatar">{{ cliente.nombre_completo?.charAt(0) }}</div>
                  <div class="flex-grow-1 min-w-0">
                    <div class="fw-bold fs-5 text-truncate">{{ cliente.nombre_completo }}</div>
                    <div class="text-muted small">
                      CI: <strong>{{ cliente.ci }}</strong>
                      <span v-if="cliente.telefono" class="ms-3 d-none d-sm-inline">
                        <i class="bi bi-telephone me-1"></i>{{ cliente.telefono }}
                      </span>
                    </div>
                  </div>
                  <button class="btn btn-sm btn-light border flex-shrink-0" @click="step = 1">
                    <i class="bi bi-arrow-left me-1"></i>Cambiar
                  </button>
                </div>

                <!-- Sin pagos -->
                <div v-if="!pagosContado.length && !cuotasPendientes.length" class="text-center py-5">
                  <i class="bi bi-check-circle-fill text-success display-3 d-block mb-3"></i>
                  <h5 class="fw-bold">¡Sin pagos pendientes!</h5>
                  <p class="text-muted">No tienes ningún pago pendiente en este momento.</p>
                  <RouterLink to="/" class="btn btn-primary mt-2">Volver al inicio</RouterLink>
                </div>

                <template v-else>
                  <!-- Pagos al contado -->
                  <div v-if="pagosContado.length" class="mb-4">
                    <div class="pp-section-header mb-3">
                      <i class="bi bi-cash-coin text-success me-2"></i>
                      <span>Pagos al Contado / Cuota Inicial</span>
                      <span class="pp-section-badge">Selección única</span>
                    </div>
                    <div class="d-flex flex-column gap-2">
                      <div
                        v-for="pago in pagosContado"
                        :key="pago.id"
                        class="pp-sel-card"
                        :class="{ 'pp-sel-card--active': pagoContadoSeleccionado === pago.id }"
                        @click="toggleContado(pago.id)"
                        role="radio"
                        :aria-checked="pagoContadoSeleccionado === pago.id"
                      >
                        <div class="pp-indicator pp-indicator--radio">
                          <div class="pp-indicator-dot"></div>
                        </div>
                        <div class="flex-grow-1 min-w-0">
                          <div class="pp-sel-title">{{ pago.tipo }}</div>
                          <div class="pp-sel-meta text-truncate">{{ pago.tipo_prop }} · {{ pago.propiedad }}</div>
                        </div>
                        <div class="pp-sel-amount">
                          <span class="pp-amount-currency">{{ pago.moneda }}</span>
                          <span class="pp-amount-value">{{ formatMonto(pago.monto) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Cuotas de crédito -->
                  <div v-if="cuotasPendientes.length" class="mb-4">
                    <div class="pp-section-header mb-2">
                      <i class="bi bi-calendar-check pp-accent-color me-2"></i>
                      <span>Cuotas de Crédito Pendientes</span>
                      <span class="pp-section-badge pp-section-badge--blue">Selección múltiple</span>
                    </div>
                    <p class="text-muted mb-3" style="font-size:.8rem">
                      Puedes marcar una o varias cuotas para pagarlas en una sola transacción.
                    </p>
                    <div class="d-flex flex-column gap-2">
                      <div
                        v-for="cuota in cuotasPendientes"
                        :key="cuota.cuota_id"
                        class="pp-sel-card"
                        :class="{ 'pp-sel-card--active': cuotasSeleccionadas.includes(cuota.cuota_id) }"
                        @click="toggleCuota(cuota.cuota_id)"
                        role="checkbox"
                        :aria-checked="cuotasSeleccionadas.includes(cuota.cuota_id)"
                      >
                        <div class="pp-indicator pp-indicator--checkbox">
                          <i class="bi bi-check2" style="font-size:.72rem"></i>
                        </div>
                        <div class="flex-grow-1 min-w-0">
                          <div class="pp-sel-title">Cuota N° {{ cuota.numero_cuota }}</div>
                          <div class="pp-sel-meta d-flex flex-wrap align-items-center gap-2">
                            <span class="text-truncate">{{ cuota.tipo_prop }} · {{ cuota.propiedad }}</span>
                            <span class="pp-fecha-badge">
                              <i class="bi bi-calendar3 me-1"></i>Vence: {{ formatFecha(cuota.fecha_vencimiento) }}
                            </span>
                          </div>
                        </div>
                        <div class="pp-sel-amount">
                          <span class="pp-amount-currency">{{ cuota.moneda }}</span>
                          <span class="pp-amount-value pp-amount-value--blue">{{ formatMonto(cuota.monto_cuota) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

              <!-- PASO 3: CONFIRMAR -->
              <div v-if="step === 3" class="paso-fade">
                <h5 class="fw-bold mb-4">
                  <i class="bi bi-person-vcard me-2 pp-accent-color"></i>Datos de quien realiza el pago
                </h5>
                <p class="text-muted small mb-4">Esta información identifica a la persona que efectúa la transferencia.</p>

                <div class="row g-3 mb-4">
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">CI *</label>
                    <input type="text" class="form-control" :class="{ 'is-invalid': erroresPagador.ci_pagador }"
                      v-model="formPagador.ci_pagador" placeholder="12345678">
                    <div v-if="erroresPagador.ci_pagador" class="invalid-feedback">{{ erroresPagador.ci_pagador[0] }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">Teléfono *</label>
                    <input type="text" class="form-control" :class="{ 'is-invalid': erroresPagador.telefono_pagador }"
                      v-model="formPagador.telefono_pagador" placeholder="70000000">
                    <div v-if="erroresPagador.telefono_pagador" class="invalid-feedback">{{ erroresPagador.telefono_pagador[0] }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">Correo electrónico *</label>
                    <input type="email" class="form-control" :class="{ 'is-invalid': erroresPagador.correo_pagador }"
                      v-model="formPagador.correo_pagador" placeholder="correo@email.com">
                    <div v-if="erroresPagador.correo_pagador" class="invalid-feedback">{{ erroresPagador.correo_pagador[0] }}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-semibold">Nombre(s) *</label>
                    <input type="text" class="form-control" :class="{ 'is-invalid': erroresPagador.nombres_pagador }"
                      v-model="formPagador.nombres_pagador" placeholder="Juan Carlos">
                    <div v-if="erroresPagador.nombres_pagador" class="invalid-feedback">{{ erroresPagador.nombres_pagador[0] }}</div>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-semibold">Apellido(s) *</label>
                    <input type="text" class="form-control" :class="{ 'is-invalid': erroresPagador.apellidos_pagador }"
                      v-model="formPagador.apellidos_pagador" placeholder="Pérez García">
                    <div v-if="erroresPagador.apellidos_pagador" class="invalid-feedback">{{ erroresPagador.apellidos_pagador[0] }}</div>
                  </div>
                </div>

                <!-- Método de pago -->
                <h6 class="fw-bold mb-3"><i class="bi bi-credit-card me-2"></i>Método de pago</h6>
                <div class="pp-metodo-card pp-metodo-card--active mb-4">
                  <div class="pp-metodo-icon"><i class="bi bi-qr-code"></i></div>
                  <div class="flex-grow-1">
                    <div class="fw-semibold">Transferencia QR</div>
                    <div class="text-muted small">BNB, BISA, Banco Unión, BCP, Tigo Money y más</div>
                  </div>
                  <i class="bi bi-check-circle-fill pp-accent-color fs-5"></i>
                </div>

                <!-- Términos -->
                <div class="form-check mb-4">
                  <input class="form-check-input" type="checkbox" id="chkTerminos" v-model="aceptaTerminos">
                  <label class="form-check-label small" for="chkTerminos">
                    He leído y acepto los <a href="#" class="fw-semibold pp-accent-color">Términos y Condiciones</a>
                  </label>
                </div>

                <div class="d-flex gap-3">
                  <button class="btn btn-light border px-4" @click="step = 2">
                    <i class="bi bi-arrow-left me-1"></i>Volver
                  </button>
                </div>
              </div>

              <!-- PASO 4: PAGO -->
              <div v-if="step === 4" class="paso-fade text-center">

                <!-- ── Modo 1: redirect mismo tab ── -->
                <template v-if="companyStore.libelulaEnabled === 1">
                  <h4 class="fw-bold mb-2">Completa tu pago</h4>
                  <p class="text-muted small mb-4 px-3">
                    Haz clic en el botón para ir a la pasarela de pago. Al finalizar serás redirigido aquí automáticamente.
                  </p>
                  <div v-if="urlPago" class="mb-4">
                    <button class="btn btn-primary btn-lg px-5 fw-bold shadow-sm" @click="abrirPagina">
                      <i class="bi bi-credit-card me-2"></i>Ir a pagar ahora
                      <i class="bi bi-arrow-right ms-2"></i>
                    </button>
                    <p class="text-muted mt-2" style="font-size:.78rem">
                      Serás redirigido a la pasarela segura de Libélula y al completar el pago volverás automáticamente.
                    </p>
                  </div>
                </template>

                <!-- ── Modo 2: popup ── -->
                <template v-else-if="companyStore.libelulaEnabled === 2">
                  <h4 class="fw-bold mb-2">Completa tu pago en la ventana emergente</h4>
                  <p class="text-muted small mb-4 px-3">
                    Se abrió una ventana con la pasarela de pago. Completa el pago allí y esta página se actualizará automáticamente.
                  </p>
                  <!-- Popup bloqueado por el navegador -->
                  <div v-if="popupBloqueado" class="alert alert-warning d-inline-flex align-items-center gap-2 mb-4 px-4">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <span>Tu navegador bloqueó la ventana emergente.</span>
                    <button class="btn btn-sm btn-warning fw-semibold ms-1" @click="abrirPopup">
                      <i class="bi bi-window-stack me-1"></i>Abrir manualmente
                    </button>
                  </div>
                  <!-- Popup abierto correctamente -->
                  <div v-else class="mb-4">
                    <div class="pp-popup-icon mx-auto mb-3">
                      <i class="bi bi-window-stack"></i>
                    </div>
                    <p class="text-muted small mb-3">¿Se cerró la ventana antes de completar el pago?</p>
                    <button class="btn btn-outline-primary fw-semibold px-4" @click="abrirPopup">
                      <i class="bi bi-arrow-repeat me-2"></i>Reabrir ventana de pago
                    </button>
                  </div>
                </template>

                <!-- ── Separador + QR (solo modos 1 y 2) ── -->
                <template v-if="companyStore.libelulaEnabled !== 0">
                  <div class="d-flex align-items-center gap-3 mx-auto mb-4" style="max-width:400px">
                    <hr class="flex-grow-1 opacity-25">
                    <span class="text-muted small">o escanea con tu app bancaria</span>
                    <hr class="flex-grow-1 opacity-25">
                  </div>

                  <div v-if="qrUrl" class="pp-qr-container mx-auto mb-3">
                    <div class="pp-qr-box shadow-sm">
                      <img :src="qrUrl" alt="Código QR de pago">
                      <div class="qr-corner top-left"></div>
                      <div class="qr-corner top-right"></div>
                      <div class="qr-corner bottom-left"></div>
                      <div class="qr-corner bottom-right"></div>
                    </div>
                  </div>

                  <p class="text-muted mb-4" style="font-size:.78rem">
                    <i class="bi bi-info-circle me-1"></i>
                    Al escanear el QR con tu app bancaria, esta pantalla se actualizará automáticamente cuando el pago sea procesado.
                  </p>

                  <div class="pp-waiting mb-3">
                    <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                    <span class="text-muted small">Verificando automáticamente cada 3 segundos…</span>
                  </div>

                  <!-- Verificación manual para pagos por QR (app bancaria) -->
                  <div class="pp-verify-box mx-auto mb-4">
                    <p class="small text-muted mb-2">
                      <i class="bi bi-phone me-1"></i>
                      ¿Pagaste con tu app bancaria escaneando el QR?
                    </p>
                    <button
                      class="btn btn-outline-success fw-semibold px-4"
                      @click="verificarPago"
                      :disabled="verificandoPago"
                    >
                      <span v-if="verificandoPago" class="spinner-border spinner-border-sm me-2"></span>
                      <i v-else class="bi bi-patch-check me-2"></i>
                      {{ verificandoPago ? 'Verificando…' : 'Ya pagué — Verificar ahora' }}
                    </button>
                    <div v-if="mensajeVerificacion" class="mt-2">
                      <span :class="tipoMensaje === 'ok' ? 'text-success' : 'text-danger'" class="small">
                        <i :class="tipoMensaje === 'ok' ? 'bi bi-check-circle-fill' : 'bi bi-x-circle-fill'" class="me-1"></i>
                        {{ mensajeVerificacion }}
                      </span>
                    </div>
                  </div>
                </template>

                <button class="btn btn-link text-muted small" @click="nuevoPago">
                  <i class="bi bi-arrow-left me-1"></i>Cancelar y volver al inicio
                </button>
              </div>

            </div>
          </div>

          <!-- Columna Derecha: Panel de Resumen Sticky (Desktop) -->
          <div class="col-lg-4 d-none d-lg-block">
            <div class="pp-sidebar-sticky">
              <div class="pp-card shadow-sm p-4 border-0">
                <h5 class="fw-bold mb-4">Resumen de Pago</h5>
                
                <!-- Lista de items seleccionados -->
                <div class="mb-4">
                  <template v-if="pagoContadoSeleccionado">
                    <div v-for="pago in pagosContado.filter(p => p.id === pagoContadoSeleccionado)" :key="pago.id" class="d-flex justify-content-between mb-2 small">
                      <span class="text-muted">{{ pago.tipo }}</span>
                      <span class="fw-semibold">{{ pago.moneda }} {{ formatMonto(pago.monto) }}</span>
                    </div>
                  </template>
                  <template v-for="cid in cuotasSeleccionadas" :key="cid">
                    <div v-for="cuota in cuotasPendientes.filter(c => c.cuota_id === cid)" :key="cuota.cuota_id" class="d-flex justify-content-between mb-2 small">
                      <span class="text-muted">Cuota N° {{ cuota.numero_cuota }}</span>
                      <span class="fw-semibold">{{ cuota.moneda }} {{ formatMonto(cuota.monto_cuota) }}</span>
                    </div>
                  </template>
                  <div v-if="!haySeleccion" class="text-center text-muted py-3 small border border-dashed rounded">
                    Ningún pago seleccionado
                  </div>
                </div>

                <hr class="my-4 opacity-10">

                <div class="d-flex justify-content-between align-items-end mb-2">
                  <span class="text-muted small fw-bold text-uppercase">Total de prueba</span>
                  <span class="fw-black pp-accent-color fs-3" :class="{ 'opacity-25': !haySeleccion }">
                    Bs {{ formatMonto(totalSeleccionado) }}
                  </span>
                </div>



                <button
                  v-if="step === 2"
                  class="btn btn-primary btn-lg w-100 fw-bold py-3 mt-2 shadow-sm"
                  :disabled="!haySeleccion"
                  @click="irPaso3"
                >
                  Continuar <i class="bi bi-arrow-right ms-2"></i>
                </button>

                <button
                  v-if="step === 3"
                  class="btn btn-success btn-lg w-100 fw-bold py-3 mt-2 shadow-sm"
                  :disabled="!formularioPagadorValido || procesando"
                  @click="procesarPago"
                >
                  <span v-if="procesando" class="spinner-border spinner-border-sm me-2"></span>
                  {{ procesando ? 'Procesando…' : 'Pagar ahora' }}
                  <i v-if="!procesando" class="bi bi-qr-code ms-2"></i>
                </button>

                <!-- Info adicional en paso 4 -->
                <div v-if="step === 4" class="alert alert-info border-0 small mt-3 mb-0">
                  <i class="bi bi-shield-lock-fill me-1"></i>
                  Pago 100% seguro a través de Libélula.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ PASO FINAL: ÉXITO (Diseño centrado) ═══ -->
        <div v-else-if="step === 4 && estadoPago === 'PAGADO_PRUEBA'" class="pp-card shadow-lg mx-auto text-center paso-fade" style="max-width: 600px;">
          <div class="py-4">
            <div class="pp-success-circle mx-auto mb-4">
              <i class="bi bi-check-lg"></i>
            </div>
            <h4 class="fw-bold text-success mb-2">¡Prueba de pago confirmada!</h4>
            <p class="text-muted mb-4">
              Se confirmó el importe de prueba de Bs 0,20 por concepto.<br>
              La deuda real permanece pendiente; esta prueba no la liquida.
            </p>
            <div class="alert alert-success d-inline-block py-2 px-4">
              <i class="bi bi-receipt me-1"></i>
              Transacción: <strong>{{ idTransaccion }}</strong>
            </div>
            <div class="mt-4">
              <button class="btn btn-primary px-5" @click="nuevoPago">Realizar otro pago</button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══ Barra de Resumen Móvil (Sticky Bottom) ═══ -->
    <div v-if="(step === 2 || step === 3) && haySeleccion" class="pp-mobile-bottom-bar d-lg-none">
       <div class="d-flex align-items-center justify-content-between gap-3">
          <div class="flex-grow-1">
             <div class="text-muted small text-uppercase fw-bold letter-spacing-1" style="font-size: .65rem;">Total de prueba</div>
             <div class="fw-black pp-accent-color fs-4">Bs {{ formatMonto(totalSeleccionado) }}</div>
          </div>
          <button
            v-if="step === 2"
            class="btn btn-primary fw-bold px-4 py-2 shadow-sm"
            @click="irPaso3"
          >
            Continuar <i class="bi bi-arrow-right ms-1"></i>
          </button>
          <button
            v-if="step === 3"
            class="btn btn-success fw-bold px-4 py-2 shadow-sm"
            :disabled="!formularioPagadorValido || procesando"
            @click="procesarPago"
          >
            <span v-if="procesando" class="spinner-border spinner-border-sm me-1"></span>
            {{ procesando ? '...' : 'Pagar' }} <i v-if="!procesando" class="bi bi-qr-code ms-1"></i>
          </button>
       </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Variables locales adaptativas ─────────────────────────────────────────── */
.pp-bg {
  --pp-accent:      var(--primary-color);
  --pp-accent-mid:  var(--accent-color);
  --pp-accent-soft: rgba(96, 165, 250, 0.1);
  --pp-accent-border: var(--border-color);
  
  background: var(--bg-body);
  transition: background 0.3s ease;
}

[data-theme="dark"] .pp-bg {
  background: radial-gradient(circle at top right, #111827, #0A0E14);
}

/* ── Header ────────────────────────────────────────────────────────────────── */
.pp-header {
  background: var(--bg-card);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border-color);
  position: sticky; top: 0; z-index: 100;
}

[data-theme="dark"] .pp-logo-filter {
  filter: brightness(0) invert(1);
}

/* ── Wizard card ───────────────────────────────────────────────────────────── */
.pp-card {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 24px;
  padding: 2.5rem;
  color: var(--text-main);
}
@media (max-width: 576px) {
  .pp-card { padding: 1.5rem 1.25rem; border-radius: 16px; }
}

/* ── Mobile Bottom Bar ────────────────────────────────────────────────────── */
.pp-mobile-bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: var(--bg-card);
  box-shadow: 0 -10px 30px rgba(0,0,0,0.15);
  padding: 1rem 1.25rem;
  z-index: 1050;
  border-top: 1px solid var(--border-color);
}

/* ── Stepper ───────────────────────────────────────────────────────────────── */
.pp-stepper { display: flex; align-items: center; justify-content: center; }
.pp-step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pp-step-circle {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: .88rem;
  background: var(--bg-body); color: var(--text-muted);
  border: 2px solid var(--border-color);
  transition: all .3s;
}
.pp-step--done .pp-step-circle,
.pp-step--current .pp-step-circle {
  background: var(--primary-color); color: #fff;
  border-color: var(--primary-color);
}
.pp-step--current .pp-step-circle {
  box-shadow: 0 0 0 5px var(--pp-accent-soft);
}
.pp-step-label {
  font-size: .7rem; color: var(--text-muted); font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em;
}
.pp-step--done .pp-step-label,
.pp-step--current .pp-step-label { color: var(--primary-color); }
.pp-step-line {
  flex: 1; height: 2px; background: var(--border-color);
  margin: 0 6px; margin-bottom: 22px;
  border-radius: 2px; transition: background .3s;
  min-width: 20px; max-width: 80px;
}
.pp-step-line--active { background: var(--primary-color); }

/* ── Input grupo ───────────────────────────────────────────────────────────── */
.pp-input-group .input-group-text {
  background: var(--bg-body); border-color: var(--border-color); color: var(--text-muted);
}
.pp-input-group .form-control {
  background: var(--bg-body); border-color: var(--border-color); color: var(--text-main);
}
.pp-input-group .form-control:focus {
  border-color: var(--primary-color);
}

/* ── Card cliente ──────────────────────────────────────────────────────────── */
.pp-cliente-card {
  background: var(--pp-accent-soft);
  border: 1px solid var(--border-color);
  border-radius: 14px; padding: 1rem 1.25rem;
}
.pp-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  background: var(--primary-color); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem; font-weight: 900; flex-shrink: 0;
}

/* ── Section header ────────────────────────────────────────────────────────── */
.pp-section-header {
  display: flex; align-items: center;
  font-weight: 700; font-size: .95rem; color: var(--text-main);
}
.pp-section-badge {
  margin-left: auto;
  font-size: .68rem; font-weight: 600; text-transform: uppercase;
  background: var(--bg-body); color: var(--text-muted);
  border-radius: 20px; padding: 2px 10px; letter-spacing: .04em;
}

/* ── Tarjeta de selección ──────────────────────────────────────────────────── */
.pp-sel-card {
  display: flex; align-items: center; gap: 1rem;
  padding: .9rem 1.1rem;
  border-radius: 12px;
  border: 1.5px solid var(--border-color);
  cursor: pointer;
  transition: all .18s;
  background: var(--bg-card);
  box-shadow: inset 4px 0 0 transparent;
  user-select: none;
}

.pp-sel-card:hover {
  border-color: var(--primary-hover);
  background: var(--pp-accent-soft);
}

.pp-sel-card--active {
  border-color: var(--primary-color);
  background: var(--pp-accent-soft);
  box-shadow: inset 4px 0 0 var(--primary-color);
}

.pp-indicator {
  width: 22px; height: 22px;
  border: 2px solid var(--border-color);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all .18s;
  background: var(--bg-body);
  color: transparent;
}
.pp-indicator--radio    { border-radius: 50%; }
.pp-indicator--checkbox { border-radius: 5px; }

.pp-sel-card--active .pp-indicator {
  border-color: var(--primary-color);
  background: var(--primary-color);
  color: #fff;
}

.pp-sel-title { font-weight: 600; font-size: .92rem; color: var(--text-main); }
.pp-sel-meta { font-size: .76rem; color: var(--text-muted); }

.pp-fecha-badge {
  display: inline-flex; align-items: center;
  background: var(--bg-body); border-radius: 4px;
  padding: 1px 7px; color: var(--text-muted);
}

.pp-amount-currency { color: var(--text-muted); }
.pp-amount-value { color: var(--text-main); }
.pp-amount-value--blue { color: var(--primary-color); }

/* ── Método de pago ────────────────────────────────────────────────────────── */
.pp-metodo-card {
  display: flex; align-items: center; gap: 1rem;
  border: 1.5px solid var(--border-color); border-radius: 12px;
  padding: 1rem 1.25rem;
  background: var(--bg-card);
}
.pp-metodo-card--active {
  border-color: var(--primary-color);
  background: var(--pp-accent-soft);
}
.pp-metodo-icon {
  width: 44px; height: 44px; border-radius: 10px;
  background: var(--primary-color); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem;
}

/* ── Paso 4: QR ────────────────────────────────────────────────────────────── */
.pp-qr-box {
  background: #fff; /* QR siempre blanco para lectura */
  border-radius: 20px;
  padding: 15px;
  border: 4px solid var(--primary-color);
}

.pp-verify-box {
  background: var(--pp-accent-soft);
  border: 1.5px solid var(--primary-color);
  border-radius: 14px;
  padding: 1rem 1.25rem;
}

/* ── Éxito ─────────────────────────────────────────────────────────────────── */
.pp-success-circle {
  width: 100px; height: 100px; border-radius: 50%;
  background: rgba(16, 185, 129, 0.2); color: #10b981;
  display: flex; align-items: center; justify-content: center;
  font-size: 3.5rem;
}

.pp-bg { transition: background-color 0.3s ease; }
</style>

