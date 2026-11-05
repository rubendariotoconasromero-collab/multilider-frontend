<script setup>
import { ref, watch, onUnmounted } from 'vue'
import api from '../api/axios'
const props = defineProps({ image: Object, client: { type: Function, default: api } })
const src = ref('')
let objectUrl, generation = 0
function clear() { generation++; if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null; src.value = '' }
async function load() {
  clear(); const current = generation
  const client = props.client
  const image = props.image
  if (!image) return
  const origin = new URL(client.defaults.baseURL, window.location.href).origin
  if (image.preview_url) {
    if (!/^\/api\/catalogo\/imagenes\/[1-9][0-9]*\/contenido$/.test(image.preview_url)) return
    const identity = localStorage.getItem('auth_token')
    if (!identity) return
    try {
      const result = await client.get(image.preview_url.replace(/^\/api/, ''), { responseType: 'blob' })
      if (current !== generation || identity !== localStorage.getItem('auth_token')) return
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(result.data.type)) return
      objectUrl = URL.createObjectURL(result.data); src.value = objectUrl
    } catch { src.value = '' }
  } else if (image.url) {
    const url = new URL(image.url, origin)
    if (url.origin === origin && ['/storage/', '/catalogo/media/', '/api/public/catalogo/imagenes/'].some(p => url.pathname.startsWith(p))) src.value = url.href
  }
}
watch(() => [props.image, props.client], load, { immediate: true, deep: true })
window.addEventListener('auth:cleared', clear)
function storageChanged(event) { if (event.key === null || ['auth_token','auth_user'].includes(event.key)) clear() }
window.addEventListener('storage', storageChanged)
onUnmounted(() => { clear(); window.removeEventListener('auth:cleared', clear); window.removeEventListener('storage', storageChanged) })
</script>
<template><img :src="src || undefined" alt="Imagen de propiedad"></template>
