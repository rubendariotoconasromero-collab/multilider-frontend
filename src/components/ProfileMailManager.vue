<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'

const props = defineProps({ email: { type: String, default: '' } })
const eligible = computed(() => props.email.toLowerCase().endsWith('@tecnoweb.space'))
const connected = ref(false)
const password = ref('')
const showPassword = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const folder = ref('INBOX')
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const messages = ref([])
const selected = ref(null)
const composing = ref(false)
const draft = ref({ to: '', subject: '', body: '' })
const folders = [{id:'INBOX',name:'Entrada'}, {id:'Sent',name:'Enviados'}, {id:'Trash',name:'Papelera'}]

function handleError(e) {
  error.value = e.response?.data?.errors ? Object.values(e.response.data.errors).flat().join(' ') : (e.response?.data?.message || 'No se pudo conectar con el servidor de correo.')
  if (e.response?.status === 429) {
    const seconds = Math.max(1, Number(e.response.headers?.['retry-after']) || 60)
    error.value = `Demasiados intentos. Espera ${seconds} segundos antes de volver a conectar.`
  }
  if (e.response?.status === 409) {
    connected.value = false
    messages.value = []
    selected.value = null
  }
}
async function load() {
  const {data} = await api.get('/perfil/correo/mensajes', { params: {folder:folder.value,page:page.value} })
  messages.value = data.data
  page.value = data.page
  lastPage.value = data.last_page
  total.value = data.total
}
async function refresh(targetPage = page.value) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  page.value = targetPage
  try { await load() } catch(e) { handleError(e) } finally { busy.value = false }
}
async function check() {
  password.value = ''
  showPassword.value = false
  connected.value = false
  messages.value = []
  selected.value = null
  composing.value = false
  draft.value = {to:'',subject:'',body:''}
  if (!eligible.value) return
  busy.value = true
  error.value = ''
  try {
    const {data} = await api.get('/perfil/correo/estado')
    connected.value = data.connected
    if (data.connected) await load()
  } catch(e) { handleError(e) } finally { busy.value = false }
}
async function connect() {
  if (busy.value || !password.value) return
  busy.value = true
  error.value = ''
  try {
    await api.post('/perfil/correo/conectar', {password:password.value})
    password.value = ''
    connected.value = true
    folder.value = 'INBOX'
    page.value = 1
    await load()
  } catch(e) { handleError(e) } finally { showPassword.value = false; busy.value = false }
}
async function disconnect() {
  busy.value = true
  try {
    await api.post('/perfil/correo/desconectar')
    connected.value = false
    selected.value = null
    messages.value = []
    composing.value = false
    draft.value = {to:'',subject:'',body:''}
    notice.value = ''
  } catch(e) { handleError(e) } finally { busy.value = false }
}
async function changeFolder(id) {
  folder.value = id
  selected.value = null
  composing.value = false
  await refresh(1)
}
async function open(row) {
  busy.value = true
  error.value = ''
  composing.value = false
  try {
    const {data} = await api.get(`/perfil/correo/mensajes/${row.uid}`, {params:{folder:folder.value}})
    selected.value = data
    row.seen = true
  } catch(e) { handleError(e) } finally { busy.value = false }
}
function compose(reply = false) {
  draft.value = reply ? {to:selected.value.reply_to, subject:/^re:/i.test(selected.value.subject) ? selected.value.subject : `Re: ${selected.value.subject}`, body:''} : {to:'',subject:'',body:''}
  composing.value = true
  notice.value = ''
}
async function send() {
  if (busy.value) return
  const confirmation = await Swal.fire({title:'¿Enviar este correo?',text:`Destinatario: ${draft.value.to}`,icon:'question',showCancelButton:true,confirmButtonText:'Enviar',cancelButtonText:'Cancelar'})
  if (!confirmation.isConfirmed) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const {data} = await api.post('/perfil/correo/enviar', draft.value)
    notice.value = data.message
    composing.value = false
    draft.value = {to:'',subject:'',body:''}
    if (folder.value === 'Sent') await load()
  } catch(e) { handleError(e) } finally { busy.value = false }
}
async function move() {
  const restoring = folder.value === 'Trash'
  const confirmation = await Swal.fire({title:restoring ? '¿Restaurar el mensaje?' : '¿Mover a Papelera?',text:restoring ? 'Se moverá a la bandeja de entrada.' : 'Puedes recuperarlo desde Papelera.',showCancelButton:true,confirmButtonText:restoring ? 'Restaurar' : 'Mover',cancelButtonText:'Cancelar'})
  if (!confirmation.isConfirmed) return
  busy.value = true
  error.value = ''
  try {
    await api.post(`/perfil/correo/mensajes/${selected.value.uid}/mover`, {folder:folder.value})
    selected.value = null
    await load()
  } catch(e) { handleError(e) } finally { busy.value = false }
}
onMounted(check)
watch(() => props.email, check)
</script>

<template>
  <section class="card border-0 shadow-sm mt-4 correo-perfil" aria-labelledby="correo-title">
    <div class="card-body p-4">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div><h3 id="correo-title" class="h5 fw-bold mb-1"><i class="bi bi-envelope me-2"></i>Mi correo</h3><div class="text-muted small">{{ email }}</div></div>
        <div v-if="connected" class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" :disabled="busy" @click="refresh()">Actualizar</button>
          <button class="btn btn-primary btn-sm" :disabled="busy" @click="compose()">Redactar</button>
          <button class="btn btn-outline-secondary btn-sm" :disabled="busy" @click="disconnect">Desconectar</button>
        </div>
      </div>
      <div v-if="error" role="alert" class="alert alert-danger py-2">{{ error }}</div>
      <div v-if="notice" role="status" class="alert alert-success py-2">{{ notice }}</div>
      <p v-if="!eligible" class="text-muted mb-0">Este gestor está disponible para buzones @tecnoweb.space. Solicita al administrador un buzón para tu usuario.</p>
      <form v-else-if="!connected" @submit.prevent="connect" class="row g-2 align-items-end">
        <div class="col-12"><p class="small text-muted mb-2">Conecta tu buzón con la contraseña del correo. Puede ser distinta de la contraseña del sistema. La conexión dura 20 minutos.</p></div>
        <div class="col-md-8">
          <label for="correo-password" class="form-label small">Contraseña del correo</label>
          <div class="input-group">
            <input id="correo-password" v-model="password" class="form-control" :type="showPassword ? 'text' : 'password'" autocomplete="off" maxlength="256" required :disabled="busy">
            <button type="button" class="btn btn-outline-secondary" :disabled="busy" :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'" :aria-pressed="showPassword" aria-controls="correo-password" @click="showPassword = !showPassword">{{ showPassword ? 'Ocultar' : 'Mostrar' }}</button>
          </div>
        </div>
        <div class="col-md-4"><button type="submit" class="btn btn-primary w-100" :disabled="busy">{{ busy ? 'Conectando…' : 'Conectar buzón' }}</button></div>
      </form>
      <template v-else>
        <div class="d-flex gap-2 mb-3"><button v-for="item in folders" :key="item.id" class="btn btn-sm" :class="folder === item.id ? 'btn-primary' : 'btn-outline-secondary'" :disabled="busy" @click="changeFolder(item.id)">{{ item.name }}</button></div>
        <div class="row g-3">
          <div class="col-lg-5">
            <div class="d-flex justify-content-between small text-muted mb-2"><span>{{ total }} mensajes</span><span v-if="busy" role="status">Cargando…</span></div>
            <div class="list-group correo-lista">
              <button v-for="row in messages" :key="row.uid" type="button" class="list-group-item list-group-item-action" :class="{'active':selected?.uid === row.uid,'fw-bold':!row.seen}" :disabled="busy" @click="open(row)">
                <div class="text-truncate">{{ row.subject || '(Sin asunto)' }}</div><div class="small text-truncate opacity-75">{{ folder === 'Sent' ? row.to : row.from }}</div><div class="small opacity-75">{{ row.date }}</div>
              </button>
              <div v-if="!messages.length && !busy" class="border rounded p-4 text-muted text-center">Esta carpeta está vacía.</div>
            </div>
            <div v-if="lastPage > 1" class="d-flex justify-content-between align-items-center mt-2"><button class="btn btn-sm btn-outline-secondary" :disabled="busy || page <= 1" @click="refresh(page-1)">Anterior</button><span class="small">{{ page }} / {{ lastPage }}</span><button class="btn btn-sm btn-outline-secondary" :disabled="busy || page >= lastPage" @click="refresh(page+1)">Siguiente</button></div>
          </div>
          <div class="col-lg-7">
            <form v-if="composing" @submit.prevent="send" class="border rounded p-3">
              <h4 class="h6 fw-bold">Nuevo mensaje</h4>
              <label for="correo-to" class="form-label small">Para</label><input id="correo-to" v-model="draft.to" type="email" class="form-control mb-2" maxlength="254" required :disabled="busy">
              <label for="correo-subject" class="form-label small">Asunto</label><input id="correo-subject" v-model="draft.subject" class="form-control mb-2" maxlength="200" required :disabled="busy">
              <label for="correo-body" class="form-label small">Mensaje</label><textarea id="correo-body" v-model="draft.body" class="form-control mb-3" rows="8" maxlength="20000" required :disabled="busy"></textarea>
              <div class="d-flex gap-2"><button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? 'Enviando…' : 'Enviar' }}</button><button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="composing=false">Cancelar</button></div>
            </form>
            <article v-else-if="selected" class="border rounded p-3">
              <h4 class="h6 fw-bold text-break">{{ selected.subject }}</h4><div class="small text-muted text-break mb-3">De: {{ selected.from }}<br>Para: {{ selected.to }}<br>{{ selected.date }}</div>
              <div class="correo-body text-break">{{ selected.body || 'Este mensaje no contiene texto disponible en el gestor.' }}</div>
              <div class="d-flex gap-2 mt-3"><button v-if="selected.reply_to" class="btn btn-sm btn-primary" :disabled="busy" @click="compose(true)">Responder</button><button class="btn btn-sm btn-outline-secondary" :disabled="busy" @click="move">{{ folder === 'Trash' ? 'Restaurar' : 'Mover a Papelera' }}</button></div>
            </article>
            <div v-else class="border rounded p-4 text-muted text-center">Selecciona un mensaje para leerlo o pulsa Redactar.</div>
          </div>
        </div>
        <p class="text-muted small mt-3 mb-0">Los mensajes se muestran como texto. Para gestionar adjuntos, utiliza Thunderbird.</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.correo-lista { max-height: 440px; overflow-y: auto; }
.correo-body { white-space: pre-wrap; max-height: 480px; overflow-y: auto; }
</style>
