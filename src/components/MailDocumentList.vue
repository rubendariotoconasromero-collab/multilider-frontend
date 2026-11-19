<script setup>
import { ref, onBeforeUnmount } from 'vue'
import api from '../api/axios'
import MailDocumentViewer from './MailDocumentViewer.vue'

defineProps({ files: { type: Array, default: () => [] } })
const viewer = ref(null)
const downloading = ref(false)
const error = ref('')
let controller = null, generation = 0
const urls = new Set()
const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
function clear() {
  generation++; controller?.abort(); controller = null
  for (const url of urls) URL.revokeObjectURL(url)
  urls.clear(); downloading.value = false; error.value = ''; viewer.value?.close()
}
function sessionChanged(event) { if (event.type === 'auth:cleared' || event.key === 'auth_token') clear() }
async function download(file) {
  if (downloading.value) return
  const version = generation
  error.value = ''; downloading.value = true
  controller = new AbortController()
  try {
    const { data } = await api.get(file.url, { responseType: 'blob', signal: controller.signal })
    if (version !== generation) return
    const url = URL.createObjectURL(data); urls.add(url)
    const link = document.createElement('a'); link.href = url; link.download = file.nombre
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url) }, 1000)
  } catch (e) {
    if (version === generation && e.code !== 'ERR_CANCELED') {
      let data = e.response?.data
      if (data instanceof Blob) { try { data = JSON.parse(await data.text()) } catch { data = null } }
      error.value = data?.message || 'No se pudo descargar. Actualiza el mensaje o vuelve a conectar el buzón.'
    }
  } finally { if (version === generation) downloading.value = false }
}
window.addEventListener('auth:cleared', sessionChanged)
window.addEventListener('storage', sessionChanged)
onBeforeUnmount(() => { clear(); window.removeEventListener('auth:cleared', sessionChanged); window.removeEventListener('storage', sessionChanged) })
</script>

<template>
  <div class="mt-3" aria-label="Archivos adjuntos">
    <h5 class="h6">Archivos adjuntos</h5>
    <p v-if="!files.length" class="text-muted small">Sin adjuntos.</p>
    <div v-for="file in files" :key="file.id" class="border rounded p-2 mb-2 d-flex flex-wrap align-items-center gap-2">
      <i class="bi bi-paperclip" aria-hidden="true"></i>
      <div class="flex-grow-1 text-break"><strong class="small">{{ file.nombre }}</strong><div class="text-muted small">{{ file.mime }} · {{ file.size_estimated ? '≈ ' : '' }}{{ size(file.bytes) }}</div></div>
      <button v-if="file.preview_available" type="button" class="btn btn-sm btn-outline-primary" @click="viewer.open(file)">Ver</button>
      <span v-else class="small text-muted">Vista previa no disponible</span>
      <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="downloading" @click="download(file)">Descargar</button>
    </div>
    <div v-if="error" role="alert" class="alert alert-warning py-2">{{ error }}</div>
    <MailDocumentViewer ref="viewer" />
  </div>
</template>
