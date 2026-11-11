<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../api/axios'

// ── Estado principal ──────────────────────────────────────────────────────────
const pestana = ref('composer')   // 'composer' | 'historial'

// Formulario de composición
const asunto   = ref('')
const mensaje  = ref('')
const tipoSel  = ref('activos')
const ciudadId = ref(null)

// Datos de grupos / ciudades
const grupos    = ref([])
const ciudades  = ref([])
const loadGrupos = ref(false)

// Preview de destinatarios
const preview          = ref([])
const previewTotal     = ref(0)
const loadPreview      = ref(false)
const previewVisible   = ref(false)
const previewToken     = ref(null)
const requestKey       = ref(null)
const busquedaPreview  = ref('')

// Selección manual de clientes
const clientesDisp     = ref([])
const clienteSelIds    = ref([])
const busquedaClientes = ref('')
const loadClientes     = ref(false)

// Envío
const enviando    = ref(false)
const campanaId   = ref(null)
const pollingId   = ref(null)
const estadoCampana = ref(null)

// Historial
const historial      = ref([])
const loadHistorial  = ref(false)
const historialPage  = ref(1)
const historialMeta  = ref(null)

// Alertas
const alerta = ref({ tipo: '', msg: '' })

// ── Computed ──────────────────────────────────────────────────────────────────
const grupoActual = computed(() => grupos.value.find(g => g.value === tipoSel.value))

const previewFiltrado = computed(() => {
  if (!busquedaPreview.value) return preview.value
  const q = busquedaPreview.value.toLowerCase()
  return preview.value.filter(d =>
    d.nombre?.toLowerCase().includes(q) || d.correo?.toLowerCase().includes(q)
  )
})

const clientesFiltrados = computed(() => {
  if (!busquedaClientes.value) return clientesDisp.value
  const q = busquedaClientes.value.toLowerCase()
  return clientesDisp.value.filter(c =>
    c.nombre_completo?.toLowerCase().includes(q) || c.correo?.toLowerCase().includes(q)
  )
})

const progresoPct = computed(() => {
  if (!estadoCampana.value || !estadoCampana.value.total_destinatarios) return 0
  return estadoCampana.value.progreso
})

const formularioValido = computed(() => {
  if (!asunto.value.trim() || !mensaje.value.trim()) return false
  if (tipoSel.value === 'ciudad' && !ciudadId.value) return false
  if (tipoSel.value === 'seleccionados' && clienteSelIds.value.length === 0) return false
  return true
})

// ── Ciclo de vida ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await cargarGrupos()
})

watch(pestana, (val) => {
  if (val === 'historial') cargarHistorial()
})

// ── Métodos ───────────────────────────────────────────────────────────────────
async function cargarGrupos() {
  loadGrupos.value = true
  try {
    const { data } = await api.get('/correo-masivo/grupos')
    grupos.value  = data.grupos
    ciudades.value = data.ciudades
  } catch {
    mostrarAlerta('danger', 'No se pudieron cargar los grupos de destinatarios.')
  } finally {
    loadGrupos.value = false
  }
}

async function cargarClientesDisponibles() {
  loadClientes.value = true
  try {
    const { data } = await api.get('/correo-masivo/destinatarios')
    clientesDisp.value = data.data.map(c => ({ ...c, nombre_completo: c.nombre }))
  } catch {
    mostrarAlerta('danger', 'No se pudo cargar la lista de clientes.')
  } finally {
    loadClientes.value = false
  }
}

watch(tipoSel, (val) => {
  previewVisible.value = false
  preview.value = []
  previewTotal.value = 0
  clienteSelIds.value = []
  if (val === 'seleccionados' && clientesDisp.value.length === 0) {
    cargarClientesDisponibles()
  }
})

watch(() => JSON.stringify(buildPayload()), () => {
  previewToken.value = null
  requestKey.value = null
  previewTotal.value = 0
  previewVisible.value = false
})

watch([asunto, mensaje], () => { requestKey.value = null })

async function verPreview() {
  if (tipoSel.value === 'ciudad' && !ciudadId.value) {
    mostrarAlerta('warning', 'Selecciona una ciudad primero.')
    return
  }
  loadPreview.value = true
  previewToken.value = null
  previewVisible.value = false
  try {
    const payload = buildPayload()
    const filterKey = JSON.stringify(payload)
    const { data } = await api.post('/correo-masivo/preview-destinatarios', payload)
    if (filterKey !== JSON.stringify(buildPayload())) return
    preview.value     = data.destinatarios
    previewTotal.value = data.total
    previewToken.value = data.preview_token
    previewVisible.value = true
  } catch (e) {
    mostrarAlerta('danger', e?.response?.data?.message ?? 'Error al obtener la vista previa.')
  } finally {
    loadPreview.value = false
  }
}

async function enviarCampana() {
  if (!formularioValido.value) return
  if (!previewToken.value) await verPreview()
  if (!previewToken.value || !previewTotal.value) return

  if (!confirm(`¿Confirmas el envío a ${previewTotal.value} destinatarios?`)) return

  enviando.value = true
  estadoCampana.value = null
  campanaId.value = null
  clearInterval(pollingId.value)

  try {
    requestKey.value ??= crypto.randomUUID()
    const payload = { ...buildPayload(), asunto: asunto.value, mensaje: mensaje.value,
      preview_token: previewToken.value, request_key: requestKey.value }
    const { data } = await api.post('/correo-masivo/enviar', payload)
    campanaId.value = data.campana_id
    mostrarAlerta('success', `Campaña iniciada. Enviando a ${data.total} destinatarios en segundo plano.`)
    iniciarPolling()
  } catch (e) {
    if (e?.response?.status === 409) {
      previewToken.value = null
      requestKey.value = null
    }
    mostrarAlerta('danger', e?.response?.data?.message ?? 'Error al iniciar la campaña.')
    enviando.value = false
  }
}

function iniciarPolling() {
  pollingId.value = setInterval(async () => {
    try {
      const { data } = await api.get(`/correo-masivo/estado/${campanaId.value}`)
      estadoCampana.value = data
      if (['completado', 'fallido'].includes(data.estado)) {
        clearInterval(pollingId.value)
        enviando.value = false
        if (pestana.value === 'historial') cargarHistorial()
      }
    } catch {
      clearInterval(pollingId.value)
      enviando.value = false
    }
  }, 3000)
}

async function cargarHistorial(page = 1) {
  loadHistorial.value = true
  historialPage.value = page
  try {
    const { data } = await api.get('/correo-masivo/historial', { params: { page, per_page: 10 } })
    historial.value    = data.data
    historialMeta.value = data
  } catch {
    mostrarAlerta('danger', 'No se pudo cargar el historial.')
  } finally {
    loadHistorial.value = false
  }
}

function buildPayload() {
  const base = { tipo: tipoSel.value }
  if (tipoSel.value === 'ciudad')        base.ciudad_id    = ciudadId.value
  if (tipoSel.value === 'seleccionados') base.cliente_ids  = [...clienteSelIds.value]
  return base
}

function toggleClienteSel(id) {
  const idx = clienteSelIds.value.indexOf(id)
  if (idx === -1) clienteSelIds.value.push(id)
  else            clienteSelIds.value.splice(idx, 1)
}

function seleccionarTodos() {
  clienteSelIds.value = clientesFiltrados.value.map(c => c.id)
}

function deseleccionarTodos() {
  clienteSelIds.value = []
}

function mostrarAlerta(tipo, msg) {
  alerta.value = { tipo, msg }
  setTimeout(() => { alerta.value = { tipo: '', msg: '' } }, 6000)
}

function badgeEstado(estado) {
  return {
    completado: 'success',
    procesando: 'primary',
    pendiente:  'secondary',
    fallido:    'danger',
  }[estado] ?? 'secondary'
}

function formatFecha(fecha) {
  if (!fecha) return '-'
  return new Date(fecha).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<template>
  <div class="container-fluid py-4">

    <!-- Encabezado -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <h4 class="mb-0 fw-bold">
          <i class="bi bi-envelope-paper me-2" style="color:var(--primary-color)"></i>
          Correo Masivo
        </h4>
        <small class="text-muted">Envía mensajes a múltiples clientes simultáneamente</small>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm"
          :class="pestana === 'composer' ? 'btn-primary' : 'btn-outline-secondary'"
          @click="pestana = 'composer'">
          <i class="bi bi-pencil-square me-1"></i> Redactar
        </button>
        <button class="btn btn-sm"
          :class="pestana === 'historial' ? 'btn-primary' : 'btn-outline-secondary'"
          @click="pestana = 'historial'">
          <i class="bi bi-clock-history me-1"></i> Historial
        </button>
      </div>
    </div>

    <!-- Alerta global -->
    <div v-if="alerta.msg" :class="`alert alert-${alerta.tipo} alert-dismissible fade show`" role="alert">
      {{ alerta.msg }}
      <button type="button" class="btn-close" @click="alerta.msg = ''"></button>
    </div>

    <!-- ═══════════════ PESTAÑA REDACTAR ═══════════════ -->
    <template v-if="pestana === 'composer'">
      <div class="row g-4">

        <!-- Columna izquierda: formulario -->
        <div class="col-lg-7">
          <div class="card border-0 shadow-sm">
            <div class="card-header bg-transparent border-bottom fw-semibold">
              <i class="bi bi-send me-2"></i>Composición del correo
            </div>
            <div class="card-body">

              <!-- Asunto -->
              <div class="mb-3">
                <label class="form-label fw-medium">Asunto <span class="text-danger">*</span></label>
                <input v-model="asunto" type="text" class="form-control"
                  placeholder="Ej: Aviso importante para nuestros clientes"
                  maxlength="255">
                <div class="form-text">{{ asunto.length }}/255 caracteres</div>
              </div>

              <!-- Mensaje -->
              <div class="mb-3">
                <label class="form-label fw-medium">Mensaje <span class="text-danger">*</span></label>
                <textarea v-model="mensaje" class="form-control" rows="10"
                  placeholder="Escribe aquí el contenido del correo...&#10;&#10;Puedes usar múltiples párrafos."
                  maxlength="10000"></textarea>
                <div class="form-text">{{ mensaje.length }}/10000 caracteres</div>
              </div>

              <!-- Remitente info -->
              <div class="alert alert-light border d-flex align-items-start gap-2 py-2 px-3 mb-0">
                <i class="bi bi-info-circle text-primary mt-1 flex-shrink-0"></i>
                <div class="small">
                  <strong>Remitente:</strong> contacto@tecnoweb.space &nbsp;·&nbsp;
                  <strong>Servidor:</strong> Postfix (localhost:25 con DKIM/SPF)
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- Columna derecha: destinatarios -->
        <div class="col-lg-5">
          <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-transparent border-bottom fw-semibold">
              <i class="bi bi-people me-2"></i>Destinatarios
            </div>
            <div class="card-body">

              <div v-if="loadGrupos" class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary"></div>
              </div>

              <template v-else>
                <!-- Selección de grupo -->
                <label class="form-label fw-medium">Grupo de envío</label>
                <div class="d-flex flex-column gap-2 mb-3">
                  <div v-for="g in grupos" :key="g.value"
                       class="form-check card border p-3 rounded-3 cursor-pointer mb-0"
                       :class="tipoSel === g.value ? 'border-primary bg-primary bg-opacity-10' : 'border-light'"
                       style="cursor:pointer"
                       @click="tipoSel = g.value">
                    <input class="form-check-input" type="radio"
                           :value="g.value" v-model="tipoSel">
                    <label class="form-check-label w-100" style="cursor:pointer">
                      <span class="fw-medium">{{ g.label }}</span>
                      <span v-if="g.total !== null" class="badge bg-secondary ms-2">{{ g.total }}</span>
                      <br>
                      <small class="text-muted">{{ g.descripcion }}</small>
                    </label>
                  </div>
                </div>

                <!-- Selector de ciudad -->
                <div v-if="tipoSel === 'ciudad'" class="mb-3">
                  <label class="form-label fw-medium">Ciudad <span class="text-danger">*</span></label>
                  <select v-model="ciudadId" class="form-select">
                    <option :value="null">-- Elige una ciudad --</option>
                    <option v-for="c in ciudades" :key="c.id" :value="c.id">
                      {{ c.nombre }}
                    </option>
                  </select>
                </div>

                <!-- Selección manual -->
                <template v-if="tipoSel === 'seleccionados'">
                  <label class="form-label fw-medium">
                    Seleccionar clientes
                    <span class="badge bg-primary ms-1">{{ clienteSelIds.length }} sel.</span>
                  </label>
                  <input v-model="busquedaClientes" type="text" class="form-control form-control-sm mb-2"
                    placeholder="Buscar por nombre o correo...">
                  <div class="d-flex gap-2 mb-2">
                    <button class="btn btn-outline-secondary btn-sm" @click="seleccionarTodos">Todos</button>
                    <button class="btn btn-outline-secondary btn-sm" @click="deseleccionarTodos">Ninguno</button>
                  </div>
                  <div v-if="loadClientes" class="text-center py-2">
                    <div class="spinner-border spinner-border-sm text-primary"></div>
                  </div>
                  <div v-else class="list-group list-group-flush border rounded"
                       style="max-height:220px;overflow-y:auto">
                    <label v-for="c in clientesFiltrados" :key="c.id"
                           class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2"
                           style="cursor:pointer">
                      <input type="checkbox" class="form-check-input mt-0"
                        :value="c.id"
                        :checked="clienteSelIds.includes(c.id)"
                        @change="toggleClienteSel(c.id)">
                      <div class="small">
                        <div class="fw-medium">{{ c.nombre_completo }}</div>
                        <div class="text-muted">{{ c.correo }}</div>
                      </div>
                    </label>
                    <div v-if="clientesFiltrados.length === 0" class="list-group-item text-muted small text-center py-3">
                      Sin resultados
                    </div>
                  </div>
                </template>

                <!-- Botón vista previa -->
                <div class="mt-3 d-flex gap-2">
                  <button class="btn btn-outline-primary btn-sm flex-grow-1"
                    :disabled="loadPreview || (tipoSel === 'ciudad' && !ciudadId)"
                    @click="verPreview">
                    <span v-if="loadPreview" class="spinner-border spinner-border-sm me-1"></span>
                    <i v-else class="bi bi-eye me-1"></i>
                    Vista previa destinatarios
                  </button>
                </div>
              </template>
            </div>
          </div>

          <!-- Botón enviar -->
          <button class="btn btn-primary w-100 py-2 fw-semibold"
            :disabled="!formularioValido || enviando"
            @click="enviarCampana">
            <span v-if="enviando" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-send-fill me-2"></i>
            {{ enviando ? 'Enviando...' : 'Enviar campaña' }}
          </button>

          <!-- Progreso de envío -->
          <div v-if="estadoCampana" class="card border-0 shadow-sm mt-3">
            <div class="card-body py-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="fw-medium small">Progreso de envío</span>
                <span :class="`badge bg-${badgeEstado(estadoCampana.estado)}`">
                  {{ estadoCampana.estado }}
                </span>
              </div>
              <div class="progress mb-2" style="height:8px">
                <div class="progress-bar progress-bar-striped progress-bar-animated"
                  :class="estadoCampana.estado === 'fallido' ? 'bg-danger' : 'bg-success'"
                  :style="`width:${progresoPct}%`"></div>
              </div>
              <div class="d-flex justify-content-between small text-muted">
                <span>
                  <i class="bi bi-check-circle text-success me-1"></i>{{ estadoCampana.total_enviados }} enviados
                </span>
                <span>
                  <i class="bi bi-x-circle text-danger me-1"></i>{{ estadoCampana.total_fallidos }} fallidos
                  <span v-if="estadoCampana.total_inciertos"> · {{ estadoCampana.total_inciertos }} sin confirmar</span>
                </span>
                <span>
                  <i class="bi bi-people me-1"></i>{{ estadoCampana.total_destinatarios }} total
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview de destinatarios -->
      <div v-if="previewVisible" class="card border-0 shadow-sm mt-4">
        <div class="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
          <span class="fw-semibold">
            <i class="bi bi-people me-2"></i>
            Destinatarios ({{ previewTotal }} con correo válido)
          </span>
          <button class="btn btn-sm btn-outline-secondary" @click="previewVisible = false">
            <i class="bi bi-x"></i>
          </button>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <input v-model="busquedaPreview" type="text" class="form-control form-control-sm"
              placeholder="Filtrar por nombre o correo...">
          </div>
          <div class="table-responsive" style="max-height:300px;overflow-y:auto">
            <table class="table table-sm table-hover align-middle mb-0">
              <thead class="table-light sticky-top">
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, i) in previewFiltrado" :key="d.id">
                  <td class="text-muted small">{{ i + 1 }}</td>
                  <td>{{ d.nombre }}</td>
                  <td><code>{{ d.correo }}</code></td>
                  <td>
                    <span :class="`badge bg-${d.estado ? 'success' : 'secondary'}`">
                      {{ d.estado ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="previewFiltrado.length === 0">
                  <td colspan="4" class="text-center text-muted py-3">Sin resultados</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════════════ PESTAÑA HISTORIAL ═══════════════ -->
    <template v-if="pestana === 'historial'">
      <div class="card border-0 shadow-sm">
        <div class="card-header bg-transparent border-bottom fw-semibold d-flex justify-content-between align-items-center">
          <span><i class="bi bi-clock-history me-2"></i>Historial de campañas</span>
          <button class="btn btn-sm btn-outline-secondary" @click="cargarHistorial(historialPage)">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
        </div>
        <div class="card-body p-0">
          <div v-if="loadHistorial" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>
          <template v-else>
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Asunto</th>
                    <th>Tipo</th>
                    <th>Enviados</th>
                    <th>Fallidos</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Enviado por</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in historial" :key="c.id">
                    <td class="text-muted">#{{ c.id }}</td>
                    <td class="fw-medium" style="max-width:200px">
                      <div class="text-truncate" :title="c.asunto">{{ c.asunto }}</div>
                    </td>
                    <td>
                      <span class="badge bg-light text-dark border">{{ c.tipo_destinatario }}</span>
                    </td>
                    <td>
                      <span class="text-success fw-medium">{{ c.total_enviados }}</span>
                    </td>
                    <td>
                      <span class="text-danger fw-medium">{{ c.total_fallidos }}</span>
                      <span v-if="c.total_inciertos"> · {{ c.total_inciertos }} sin confirmar</span>
                    </td>
                    <td>{{ c.total_destinatarios }}</td>
                    <td>
                      <span :class="`badge bg-${badgeEstado(c.estado)}`">{{ c.estado }}</span>
                    </td>
                    <td class="small text-muted">{{ c.usuario?.nombre ?? '-' }}</td>
                    <td class="small text-muted">{{ formatFecha(c.created_at) }}</td>
                  </tr>
                  <tr v-if="historial.length === 0">
                    <td colspan="9" class="text-center text-muted py-5">
                      <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                      No hay campañas registradas
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Paginación -->
            <div v-if="historialMeta && historialMeta.last_page > 1"
                 class="d-flex justify-content-between align-items-center px-3 py-2 border-top">
              <small class="text-muted">
                Página {{ historialMeta.current_page }} de {{ historialMeta.last_page }}
              </small>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-secondary"
                  :disabled="historialMeta.current_page === 1"
                  @click="cargarHistorial(historialMeta.current_page - 1)">
                  <i class="bi bi-chevron-left"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary"
                  :disabled="historialMeta.current_page === historialMeta.last_page"
                  @click="cargarHistorial(historialMeta.current_page + 1)">
                  <i class="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

  </div>
</template>
