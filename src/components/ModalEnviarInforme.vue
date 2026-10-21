<script setup>
import { ref, computed, watch } from 'vue'
import api from '@/api/axios'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  reporte:    { type: String,  required: true },
  params:     { type: Object,  default: () => ({}) },
  titulo:     { type: String,  default: 'Informe' },
})

const emit = defineEmits(['update:modelValue'])

const usuarios       = ref([])
const seleccionados  = ref([])
const busqueda       = ref('')
const cargando       = ref(false)
const enviando       = ref(false)
const resultado      = ref(null)

const close = () => {
  emit('update:modelValue', false)
  resultado.value = null
  seleccionados.value = []
  busqueda.value = ''
}

watch(() => props.modelValue, async (val) => {
  if (val) {
    cargando.value = true
    try {
      const { data } = await api.get('/reportes/destinatarios')
      usuarios.value = (data.data ?? data).filter(a => a.correo)
    } catch {
      usuarios.value = []
    } finally {
      cargando.value = false
    }
  }
  if (!val) {
    resultado.value = null
    seleccionados.value = []
    busqueda.value = ''
  }
})

const usuariosFiltrados = computed(() => {
  if (!busqueda.value) return usuarios.value
  const q = busqueda.value.toLowerCase()
  return usuarios.value.filter(a =>
    a.nombre?.toLowerCase().includes(q) ||
    a.correo?.toLowerCase().includes(q)
  )
})

const todosSeleccionados = computed(
  () => usuarios.value.length > 0 && seleccionados.value.length === usuarios.value.length
)

function toggleTodos() {
  if (todosSeleccionados.value) {
    seleccionados.value = []
  } else {
    seleccionados.value = usuarios.value.map(a => a.id)
  }
}

async function enviar() {
  if (seleccionados.value.length === 0) return
  enviando.value = true
  resultado.value = null
  try {
    const { data } = await api.post('/reportes/enviar-informe', {
      reporte:    props.reporte,
      usuario_ids: seleccionados.value,
      params:     props.params,
    })
    resultado.value = { tipo: 'success', msg: `Informe enviado a ${data.enviados} usuario(es).` + (data.fallidos > 0 ? ` ${data.fallidos} fallaron.` : '') }
    seleccionados.value = []
  } catch (e) {
    const msg = e?.response?.data?.message ?? 'Error al enviar el informe.'
    resultado.value = { tipo: 'danger', msg }
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-backdrop-custom" @click.self="close">
      <div class="modal-dialog-custom">
        <!-- Cabecera -->
        <div class="modal-header-custom">
          <h6 class="fw-bold mb-0">
            <i class="bi bi-envelope-arrow-up me-2"></i>Enviar Informe: {{ titulo }}
          </h6>
          <button type="button" class="btn-close btn-close-white" @click="close"></button>
        </div>

        <!-- Cuerpo -->
        <div class="modal-body-custom">
          <p class="text-muted small mb-3">
            Seleccione los usuarios que recibirán el informe PDF por correo electrónico.
          </p>

          <!-- Resultado -->
          <div v-if="resultado" class="alert" :class="'alert-' + resultado.tipo" role="alert">
            <i class="bi me-2" :class="resultado.tipo === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle'"></i>
            {{ resultado.msg }}
          </div>

          <!-- Cargando usuarios -->
          <div v-if="cargando" class="text-center py-3">
            <span class="spinner-border spinner-border-sm text-primary"></span>
            <span class="ms-2 small">Cargando usuarios...</span>
          </div>

          <template v-else>
            <!-- Sin usuarios con correo -->
            <div v-if="usuarios.length === 0" class="text-center text-muted py-3">
              <i class="bi bi-person-x fs-4 d-block mb-1"></i>
              No hay usuarios con correo registrado.
            </div>

            <template v-else>
              <!-- Buscador -->
              <div class="mb-2">
                <input
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Buscar usuario..."
                  v-model="busqueda"
                />
              </div>

              <!-- Seleccionar todos -->
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small text-muted">
                  {{ seleccionados.length }} de {{ usuarios.length }} seleccionados
                </span>
                <button type="button" class="btn btn-link btn-sm p-0" @click="toggleTodos">
                  {{ todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos' }}
                </button>
              </div>

              <!-- Lista -->
              <div class="lista-usuarios border rounded">
                <div
                  v-for="usuario in usuariosFiltrados"
                  :key="usuario.id"
                  class="lista-item d-flex align-items-center gap-2 px-3 py-2"
                  :class="{ 'item-seleccionado': seleccionados.includes(usuario.id) }"
                  @click="seleccionados.includes(usuario.id)
                    ? seleccionados.splice(seleccionados.indexOf(usuario.id), 1)
                    : seleccionados.push(usuario.id)"
                >
                  <input
                    type="checkbox"
                    class="form-check-input mt-0 flex-shrink-0"
                    :checked="seleccionados.includes(usuario.id)"
                    @click.stop
                    @change="seleccionados.includes(usuario.id)
                      ? seleccionados.splice(seleccionados.indexOf(usuario.id), 1)
                      : seleccionados.push(usuario.id)"
                  />
                  <div>
                    <div class="small fw-semibold mb-0 lh-1">{{ usuario.nombre }}</div>
                    <div class="x-small text-muted">{{ usuario.correo }}</div>
                  </div>
                </div>
                <div v-if="usuariosFiltrados.length === 0" class="text-center text-muted py-3 small">
                  Sin resultados para "{{ busqueda }}"
                </div>
              </div>
            </template>
          </template>
        </div>

        <!-- Pie -->
        <div class="modal-footer-custom">
          <button type="button" class="btn btn-sm btn-secondary" @click="close">Cerrar</button>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="seleccionados.length === 0 || enviando"
            @click="enviar"
          >
            <span v-if="enviando" class="spinner-border spinner-border-sm me-1"></span>
            <i v-else class="bi bi-send me-1"></i>
            Enviar informe
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  z-index: 1055;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-dialog-custom {
  background: #fff;
  border-radius: 10px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,.18);
}

.modal-header-custom {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #fff;
  padding: 16px 20px;
  border-radius: 10px 10px 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-body-custom {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer-custom {
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.lista-usuarios {
  max-height: 260px;
  overflow-y: auto;
}

.lista-item {
  cursor: pointer;
  transition: background .12s;
  border-bottom: 1px solid #f1f5f9;
}

.lista-item:last-child {
  border-bottom: none;
}

.lista-item:hover {
  background: #f8fafc;
}

.item-seleccionado {
  background: #eef2ff;
}

.x-small {
  font-size: 0.72rem;
}
</style>
