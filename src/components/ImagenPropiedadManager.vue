<script setup>
import { ref, watch } from 'vue'
import api from '../api/axios'
import Swal from 'sweetalert2'
import CatalogImage from './CatalogImage.vue'
import { catalogCommand } from '../utils/catalogCommands'

const props = defineProps({
  propiedadId: {
    type: [Number, String],
    required: true
  },
  imagenes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['updated'])

const imagenesLocal = ref([...props.imagenes])

// Sincronizar estado local cuando las props cambian (desde el padre)
watch(() => props.imagenes, (newVal) => {
  imagenesLocal.value = [...newVal]
}, { deep: true })

const subiendo = ref(false)
const inputArchivos = ref(null)

const handleFileSelect = () => {
  inputArchivos.value.click()
}

const onFileChange = async (e) => {
  const files = e.target.files
  if (!files.length) return
  if (files.length > 10 || Array.from(files).some(f => f.size > 2048 * 1024 || !['image/jpeg','image/png','image/gif'].includes(f.type))) { await Swal.fire('Revisa las imágenes', 'Selecciona hasta 10 imágenes JPEG, PNG o GIF de máximo 2 MiB cada una.', 'warning'); return }

  const formData = new FormData()
  for (let i = 0; i < files.length; i++) {
    formData.append('imagenes[]', files[i])
  }

  subiendo.value = true
  try {
    await catalogCommand(api, 'post', `/propiedades/${props.propiedadId}/imagenes`, formData)
    
    // Notificar al padre para que recargue la propiedad completa
    // Esto asegura que tanto el listado como el modal estén sincronizados
    emit('updated')

    Swal.fire({
      icon: 'success',
      title: 'Imágenes subidas correctamente',
      toast: true,
      position: 'top-end',
      timer: 3000,
      showConfirmButton: false
    })
    
    // Limpiar input
    inputArchivos.value.value = ''
  } catch (error) {
    console.error('Error al subir imágenes:', error)
    Swal.fire('Error', 'No se pudieron subir las imágenes', 'error')
  } finally {
    subiendo.value = false
  }
}

const eliminarImagen = async (id) => {
  const result = await Swal.fire({
    title: '¿Estás seguro?',
    text: "Esta acción no se puede deshacer",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#fb7185',
    cancelButtonColor: '#9ca3af',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  })

  if (result.isConfirmed) {
    try {
      await catalogCommand(api, 'delete', `/imagenes-propiedades/${id}`)
      imagenesLocal.value = imagenesLocal.value.filter(img => img.id !== id)
      emit('updated')
      Swal.fire({
        icon: 'success',
        title: 'Imagen eliminada',
        toast: true,
        position: 'top-end',
        timer: 2000,
        showConfirmButton: false
      })
    } catch (error) {
      Swal.fire('Error', 'No se pudo eliminar la imagen', 'error')
    }
  }
}

const marcarPrincipal = async (id) => {
  try {
    await catalogCommand(api, 'patch', `/imagenes-propiedades/${id}/principal`)
    
    // Actualizar estado local
    imagenesLocal.value = imagenesLocal.value.map(img => ({
      ...img,
      es_principal: img.id === id
    }))
    
    emit('updated')
    
    Swal.fire({
      icon: 'success',
      title: 'Imagen principal actualizada',
      toast: true,
      position: 'top-end',
      timer: 2000,
      showConfirmButton: false
    })
  } catch (error) {
    Swal.fire('Error', 'No se pudo establecer como principal', 'error')
  }
}

</script>

<template>
  <div class="image-manager">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h6 class="fw-bold mb-0 text-muted">Galería de Imágenes</h6>
      <div>
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          class="d-none" 
          ref="inputArchivos" 
          @change="onFileChange"
        >
        <button 
          class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 shadow-sm"
          style="background-color: var(--primary-color);"
          @click="handleFileSelect"
          :disabled="subiendo"
        >
          <span v-if="subiendo" class="spinner-border spinner-border-sm"></span>
          <i v-else class="bi bi-cloud-upload"></i>
          {{ subiendo ? 'Subiendo...' : 'Subir Imágenes' }}
        </button>
      </div>
    </div>

    <div v-if="imagenesLocal.length === 0" class="text-center py-5 border rounded-3 bg-light bg-opacity-50">
      <i class="bi bi-images fs-1 text-muted d-block mb-2"></i>
      <p class="text-muted small">No hay imágenes para esta propiedad.</p>
      <button class="btn btn-outline-primary btn-sm" @click="handleFileSelect">Comenzar a subir</button>
    </div>

    <div v-else class="row g-3">
      <div v-for="img in imagenesLocal" :key="img.id" class="col-6 col-md-4 col-lg-3">
        <div class="card h-100 border-0 shadow-sm overflow-hidden image-card" :class="{'border-primary-main': img.es_principal}">
          <div class="position-relative">
            <CatalogImage :client="api" :image="img" class="card-img-top object-fit-cover" alt="Imagen propiedad" style="height: 160px;"  />
            
            <div class="position-absolute top-0 end-0 p-2 d-flex flex-column gap-1">
              <button 
                class="btn btn-sm btn-danger shadow-sm p-1 d-flex align-items-center justify-content-center"
                style="width: 28px; height: 28px; border-radius: 6px;"
                @click="eliminarImagen(img.id)"
                title="Eliminar"
              >
                <i class="bi bi-trash small"></i>
              </button>
            </div>

            <div v-if="img.es_principal" class="position-absolute top-0 start-0 p-2">
              <span class="badge bg-primary shadow-sm small">Principal</span>
            </div>
          </div>
          
          <div class="card-footer bg-white p-2 border-0">
            <button 
              v-if="!img.es_principal"
              class="btn btn-outline-secondary btn-sm w-100 smaller py-1"
              @click="marcarPrincipal(img.id)"
            >
              Hacer Principal
            </button>
            <div v-else class="text-center py-1">
              <span class="smaller text-primary fw-bold"><i class="bi bi-check-circle-fill me-1"></i> Imagen de Portada</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-card {
  transition: transform 0.2s ease;
}
.image-card:hover {
  transform: translateY(-3px);
}
.border-primary-main {
  border: 2px solid var(--primary-color) !important;
}
.smaller {
  font-size: 0.75rem;
}
.object-fit-cover {
  object-fit: cover;
}
</style>
