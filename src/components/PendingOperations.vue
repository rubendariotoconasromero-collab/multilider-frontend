<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import api from '../api/axios'
import { pendingOperations, consultOperation } from '../api/operations'
const items = ref([])
const checking = ref(false)
const message = ref('')
const refresh = () => { items.value = pendingOperations(api) }
onMounted(() => { refresh(); window.addEventListener('business-operations', refresh); window.addEventListener('storage', refresh) })
onUnmounted(() => { window.removeEventListener('business-operations', refresh); window.removeEventListener('storage', refresh) })
async function check() {
  checking.value = true
  try {
    for (const item of [...items.value]) {
      const result = await consultOperation(api, item.id)
      const state = result.state || result.estado_operacion
      message.value = state === 'Completada' ? 'Operación completada. Puedes actualizar la vista.' :
        result.error_code === 'CREDENTIAL_REQUIRED' ? 'Completa la contraseña y vuelve a enviar el mismo formulario.' :
        result.error_code === 'REAUTHORIZATION_REQUIRED' ? 'Inicia sesión de nuevo y reenvía la misma operación.' :
        result.error_code === 'IDENTITY_CONFLICT' ? 'El vínculo de identidad necesita revisión antes de continuar.' :
        state === 'RequiereRevision' ? 'Una operación requiere revisión antes de continuar.' :
        ['Compensada', 'Rechazada'].includes(state) ? 'Una operación fue cancelada sin completarse.' : 'La operación continúa en proceso.'
    }
  } catch { message.value = 'No se pudo comprobar el resultado. Conservamos la operación para volver a consultarla.' }
  finally { checking.value = false; refresh() }
}
</script>
<template>
  <aside v-if="items.length || message" class="alert alert-info mb-0" role="status" aria-live="polite">
    <span v-if="items.length">Tienes {{ items.length }} operación(es) pendientes. Consulta su resultado antes de repetirlas.</span>
    <span v-if="message" class="ms-2">{{ message }}</span>
    <button v-if="items.length" class="btn btn-sm btn-outline-primary ms-2" :disabled="checking" @click="check">
      {{ checking ? 'Verificando…' : 'Verificar resultado' }}
    </button>
    <button v-if="!items.length && message" class="btn btn-sm btn-link" @click="message = ''">Cerrar</button>
  </aside>
</template>
