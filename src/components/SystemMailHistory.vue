<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api/axios'
import MailDocumentList from './MailDocumentList.vue'

const route = useRoute()
const section = ref(null), rows = ref([]), detail = ref(null), busy = ref(false), error = ref('')
const page = ref(1), lastPage = ref(1)
const filters = ref({ search: '', modulo: '', estado: '', desde: '', hasta: '' })
let controller, detailController
const labels = { pendiente: 'Pendiente', incierto: 'Resultado por confirmar', aceptado_smtp: 'Aceptado por SMTP', enviado: 'Aceptado por SMTP', fallido: 'Con incidencias', enviando: 'Resultado por confirmar' }
const files = () => (detail.value?.adjuntos || []).map(file => ({ ...file, url: `/correo/envios/${detail.value.id}/archivos/${file.id}` }))
async function load(target = 1) {
  controller?.abort(); controller = new AbortController(); busy.value = true; error.value = ''; detail.value = null
  try {
    const params = Object.fromEntries(Object.entries(filters.value).filter(([, value]) => value !== ''))
    const { data } = await api.get('/correo/envios', { params: { ...params, page: target }, signal: controller.signal })
    rows.value = data.data; page.value = data.current_page; lastPage.value = data.last_page
  } catch (e) { if (e.code !== 'ERR_CANCELED') error.value = e.response?.data?.message || 'No se pudo consultar el historial.' }
  finally { busy.value = false }
}
async function show(id, recipientPage = 1) {
  detailController?.abort(); detailController = new AbortController(); detail.value = null; error.value = ''
  try { const { data } = await api.get(`/correo/envios/${id}`, { params: {recipient_page:recipientPage}, signal: detailController.signal }); detail.value = data }
  catch (e) { if (e.code !== 'ERR_CANCELED') error.value = e.response?.data?.message || 'No se pudo abrir este envío.' }
}
async function focus() {
  const id = route.query.envio
  if (typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)) { await show(id); section.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
}
onMounted(async () => { await load(); await focus() })
watch(() => route.query.envio, focus)
onBeforeUnmount(() => { controller?.abort(); detailController?.abort() })
</script>

<template>
  <section ref="section" class="card border-0 shadow-sm mt-4" aria-labelledby="system-mail-title">
    <div class="card-body p-4">
      <h3 id="system-mail-title" class="h5">Envíos del sistema</h3>
      <p class="text-muted small">Informes y campañas solicitados por ti. Aceptado por SMTP indica que el servidor aceptó el envío.</p>
      <p class="text-muted small">Las copias de informes se conservan desde esta actualización. Los adjuntos que sigan en tu buzón están en Mi correo.</p>
      <form class="row g-2 mb-3" @submit.prevent="load(1)">
        <div class="col-md"><input v-model="filters.search" aria-label="Buscar asunto" class="form-control" placeholder="Buscar asunto" maxlength="200"></div>
        <div class="col-md"><select v-model="filters.modulo" aria-label="Módulo del envío" class="form-select"><option value="">Todos los módulos</option><option value="reporte">Reportes</option><option value="campana">Campañas</option></select></div>
        <div class="col-md"><select v-model="filters.estado" aria-label="Estado del envío" class="form-select"><option value="">Todos los estados</option><option v-for="state in ['pendiente','aceptado_smtp','incierto','fallido']" :key="state" :value="state">{{ labels[state] }}</option></select></div>
        <div class="col-md"><input v-model="filters.desde" type="date" aria-label="Desde" class="form-control"></div>
        <div class="col-md"><input v-model="filters.hasta" type="date" aria-label="Hasta" class="form-control"></div>
        <div class="col-auto"><button type="submit" class="btn btn-outline-primary" :disabled="busy">Buscar envíos</button></div>
      </form>
      <p v-if="busy" role="status">Consultando envíos…</p>
      <div v-if="error" role="alert" class="alert alert-warning">{{ error }}</div>
      <div class="table-responsive"><table class="table align-middle"><thead><tr><th>Fecha</th><th>Asunto</th><th>Origen</th><th>Estado</th><th>Archivos</th><th></th></tr></thead><tbody>
        <tr v-for="row in rows" :key="row.id"><td>{{ new Date(row.fecha).toLocaleString('es-BO') }}</td><td>{{ row.asunto }}</td><td>{{ row.modulo === 'reporte' ? 'Reporte' : 'Campaña' }}</td><td>{{ labels[row.estado] }}</td><td>{{ row.adjuntos.length }}</td><td><button type="button" class="btn btn-sm btn-outline-primary" @click="show(row.id)">Ver envío</button></td></tr>
        <tr v-if="!rows.length && !busy"><td colspan="6" class="text-muted">Todavía no tienes envíos archivados.</td></tr>
      </tbody></table></div>
      <div v-if="lastPage > 1" class="d-flex gap-3 align-items-center"><button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy || page <= 1" @click="load(page-1)">Anterior</button><span>{{ page }} / {{ lastPage }}</span><button type="button" class="btn btn-sm btn-outline-secondary" :disabled="busy || page >= lastPage" @click="load(page+1)">Siguiente</button></div>
      <article v-if="detail" :key="detail.id" class="border rounded p-3 mt-3">
        <div class="d-flex justify-content-between gap-2"><h4 class="h6">{{ detail.asunto }}</h4><button type="button" class="btn btn-sm btn-outline-secondary" @click="detail = null">Cerrar detalle</button></div>
        <p class="small text-muted">De: {{ detail.remitente }} · {{ labels[detail.estado] }}</p>
        <p v-if="detail.mensaje" class="mail-history-text">{{ detail.mensaje }}</p>
        <details><summary>Destinatarios ({{ detail.total }})</summary><ul class="small"><li v-for="recipient in detail.destinatarios" :key="recipient.correo">{{ recipient.nombre }} · {{ recipient.correo }} · {{ labels[recipient.estado] || recipient.estado }}</li></ul></details>
        <div v-if="detail.destinatarios_last_page > 1" class="d-flex gap-2 align-items-center small"><button class="btn btn-sm btn-outline-secondary" :disabled="detail.destinatarios_page <= 1" @click="show(detail.id, detail.destinatarios_page - 1)">Destinatarios anteriores</button><span>{{ detail.destinatarios_page }} / {{ detail.destinatarios_last_page }}</span><button class="btn btn-sm btn-outline-secondary" :disabled="detail.destinatarios_page >= detail.destinatarios_last_page" @click="show(detail.id, detail.destinatarios_page + 1)">Más destinatarios</button></div>
        <MailDocumentList :files="files()" />
      </article>
    </div>
  </section>
</template>

<style scoped>.mail-history-text { white-space:pre-wrap; overflow-wrap:anywhere; }</style>
