<script setup>
import { ref, nextTick, onBeforeUnmount, useId } from 'vue'
import api from '../api/axios'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const dialog = ref(null), canvas = ref(null), file = ref(null), loading = ref(false), error = ref('')
const imageUrl = ref(''), text = ref(''), rows = ref([]), sheets = ref([]), sheet = ref(0), tablePage = ref(1), hasMore = ref(false), notice = ref('')
const pdfPage = ref(1), pdfPages = ref(0)
const titleId = `mail-document-${useId()}`
let controller, pdfTask, pdf, renderTask, generation = 0, previousFocus
function clear() {
  controller?.abort(); controller = null
  renderTask?.cancel(); renderTask = null
  if (pdfTask) { Promise.resolve(pdfTask.destroy()).catch(() => {}); pdfTask = null }
  pdf = null
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''; text.value = ''; rows.value = []; sheets.value = []; error.value = ''; notice.value = ''; pdfPages.value = 0
}
function close() { generation++; clear(); file.value = null; dialog.value?.close(); previousFocus?.focus?.() }
async function message(e) {
  let data = e.response?.data
  if (data instanceof Blob) { try { data = JSON.parse(await data.text()) } catch { data = null } }
  return data?.message || (e.name === 'PasswordException' ? 'Documento protegido. Descarga el original para abrirlo.' : 'No se pudo abrir la vista previa. Puedes descargar el original.')
}
async function renderPage() {
  if (!pdf) return
  const version = generation
  loading.value = true; error.value = ''
  try {
    renderTask?.cancel()
    const page = await pdf.getPage(pdfPage.value)
    if (version !== generation) return
    await nextTick()
    const original = page.getViewport({ scale: 1 })
    const scale = Math.min(1.4, 1000 / original.width, 1400 / original.height)
    const viewport = page.getViewport({ scale })
    const density = Math.min(window.devicePixelRatio || 1, 2)
    canvas.value.width = Math.ceil(viewport.width * density); canvas.value.height = Math.ceil(viewport.height * density)
    canvas.value.style.width = `${viewport.width}px`; canvas.value.style.height = `${viewport.height}px`
    renderTask = page.render({ canvasContext: canvas.value.getContext('2d'), viewport, transform: density === 1 ? null : [density, 0, 0, density, 0, 0] })
    await renderTask.promise
  } catch (e) { if (version === generation && e.name !== 'RenderingCancelledException') error.value = await message(e) }
  finally { if (version === generation) loading.value = false }
}
async function table() {
  const version = generation
  loading.value = true; error.value = ''
  try {
    const { data } = await api.get(file.value.url, { params: { preview: 1, page: tablePage.value, sheet: sheet.value }, signal: controller.signal })
    if (version !== generation) return
    rows.value = data.rows || []; sheets.value = data.sheets || []; hasMore.value = data.has_more || false
    text.value = data.text || ''; notice.value = data.notice || (data.truncated ? 'Se muestra un fragmento. Descarga el original para ver el contenido completo.' : '')
  } catch (e) { if (version === generation && e.code !== 'ERR_CANCELED') error.value = await message(e) }
  finally { if (version === generation) loading.value = false }
}
async function open(document) {
  generation++; clear(); const version = generation
  previousFocus = window.document.activeElement
  file.value = document; loading.value = true; pdfPage.value = 1; tablePage.value = 1; sheet.value = 0
  controller = new AbortController()
  await nextTick(); if (!dialog.value.open) dialog.value.showModal()
  try {
    if (['table', 'text'].includes(document.preview_type)) { await table(); return }
    const { data } = await api.get(document.url, { responseType: 'blob', params: { inline: 1 }, signal: controller.signal })
    if (version !== generation) return
    if (document.preview_type === 'image') { imageUrl.value = URL.createObjectURL(data); return }
    const library = await import('pdfjs-dist')
    if (version !== generation) return
    library.GlobalWorkerOptions.workerSrc = workerUrl
    const bytes = new Uint8Array(await data.arrayBuffer())
    if (version !== generation) return
    const task = library.getDocument({ data: bytes, isEvalSupported: false, enableXfa: false,
      useSystemFonts: false, disableAutoFetch: true })
    pdfTask = task
    const loaded = await task.promise
    if (version !== generation) { await loaded.destroy(); return }
    pdf = loaded
    pdfPages.value = pdf.numPages
    await renderPage()
  } catch (e) { if (version === generation && e.code !== 'ERR_CANCELED') error.value = await message(e) }
  finally { if (version === generation) loading.value = false }
}
function changePdf(delta) { if (!loading.value) { pdfPage.value += delta; renderPage() } }
function changeTable(delta) { tablePage.value += delta; table() }
function sessionChanged(event) { if (event.type === 'auth:cleared' || event.key === 'auth_token') close() }
window.addEventListener('auth:cleared', sessionChanged)
window.addEventListener('storage', sessionChanged)
onBeforeUnmount(() => { generation++; clear(); dialog.value?.close(); window.removeEventListener('auth:cleared', sessionChanged); window.removeEventListener('storage', sessionChanged) })
defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="mail-document-dialog rounded border shadow" :aria-labelledby="titleId" @cancel.prevent="close">
      <div class="d-flex align-items-center justify-content-between gap-3 border-bottom p-3">
        <h3 :id="titleId" class="h6 mb-0 text-break">{{ file?.nombre }}</h3>
        <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Cerrar vista previa" @click="close">Cerrar</button>
      </div>
      <div class="p-3 mail-document-body">
        <p v-if="loading" role="status">Cargando documento…</p>
        <div v-if="error" role="alert" class="alert alert-warning">{{ error }}</div>
        <p v-if="notice" class="small text-muted">{{ notice }}</p>
        <template v-if="file?.preview_type === 'pdf'">
          <div v-if="pdfPages" class="d-flex gap-3 align-items-center mb-2">
            <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || pdfPage <= 1" @click="changePdf(-1)">Anterior</button>
            <span>Página {{ pdfPage }} / {{ pdfPages }}</span>
            <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || pdfPage >= pdfPages" @click="changePdf(1)">Siguiente</button>
          </div>
          <div class="mail-pdf-scroll"><canvas ref="canvas" aria-label="Página del documento PDF"></canvas></div>
        </template>
        <img v-if="imageUrl" :src="imageUrl" :alt="file?.nombre" class="mail-image">
        <pre v-if="file?.preview_type === 'text'" class="mail-text">{{ text }}</pre>
        <template v-if="file?.preview_type === 'table'">
          <select v-if="sheets.length > 1" v-model.number="sheet" class="form-select mb-2" aria-label="Hoja del libro" :disabled="loading" @change="tablePage = 1; table()">
            <option v-for="(name, index) in sheets" :key="index" :value="index">{{ name }}</option>
          </select>
          <div class="table-responsive"><table class="table table-sm table-bordered mail-preview-table"><tbody><tr v-for="(line, index) in rows" :key="index"><td v-for="(value, column) in line" :key="column">{{ value }}</td></tr></tbody></table></div>
          <p v-if="!loading && !error && !rows.length" class="text-muted">Sin celdas en este tramo.</p>
          <div class="d-flex gap-3 align-items-center">
            <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || tablePage <= 1" @click="changeTable(-1)">Filas anteriores</button>
            <span>Tramo {{ tablePage }}</span>
            <button type="button" class="btn btn-sm btn-outline-primary" :disabled="loading || !hasMore" @click="changeTable(1)">Más filas</button>
          </div>
        </template>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.mail-document-dialog { padding:0; width:min(1100px,96vw); max-height:92vh; background:var(--bg-card,#fff); color:var(--text-main,#212529); }
.mail-document-dialog .btn-outline-secondary { color:var(--text-main,#212529); border-color:var(--text-muted,#6c757d); }
.mail-document-body { max-height:calc(92vh - 72px); overflow:auto; }
.mail-document-dialog::backdrop { background:rgba(0,0,0,.55); }
.mail-pdf-scroll { overflow:auto; max-height:65vh; }
.mail-image { max-width:100%; max-height:65vh; object-fit:contain; }
.mail-text { white-space:pre-wrap; overflow-wrap:anywhere; max-height:65vh; }
.mail-preview-table td { min-width:90px; max-width:300px; white-space:pre-wrap; overflow-wrap:anywhere; }
</style>
