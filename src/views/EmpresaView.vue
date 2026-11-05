<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useCompanyStore } from '@/stores/company'
import Swal from 'sweetalert2'

const companyStore = useCompanyStore()
const activeTab = ref('general')

const form = reactive({
  nombre: '',
  eslogan: '',
  descripcion_nosotros: '',
  mision: '',
  vision: '',
  valores: '',
  direccion: '',
  telefono: '',
  whatsapp: '',
  email: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  color_primario: '#3b82f6',
  color_secundario: '#1e293b',
  mapa_iframe: ''
})

const files = reactive({
  logo: null,
  logo_login: null,
  logo_sidebar: null,
  logo_sidebar_compact: null,
  hero_image_1: null,
  hero_image_2: null,
  hero_image_3: null
})

const heroTitles = reactive({
  hero_title_1: '',
  hero_subtitle_1: '',
  hero_title_2: '',
  hero_subtitle_2: '',
  hero_title_3: '',
  hero_subtitle_3: ''
})

const previews = reactive({
  logo: null,
  logo_login: null,
  logo_sidebar: null,
  logo_sidebar_compact: null,
  hero_image_1: null,
  hero_image_2: null,
  hero_image_3: null
})

const baseUrl = import.meta.env.VITE_API_URL

onMounted(async () => {
  await companyStore.fetchCompany()
  if (companyStore.company) {
    const c = companyStore.company
    // Cargar datos al form
    Object.keys(form).forEach(key => {
      if (c[key] !== undefined) form[key] = c[key] || ''
    })
    
    // Cargar hero titles
    for (let i = 1; i <= 3; i++) {
      heroTitles[`hero_title_${i}`] = c[`hero_title_${i}`] || ''
      heroTitles[`hero_subtitle_${i}`] = c[`hero_subtitle_${i}`] || ''
      if (c[`hero_image_${i}`]) {
        previews[`hero_image_${i}`] = baseUrl + c[`hero_image_${i}`]
      }
    }
    
    if (c.logo) previews.logo = baseUrl + c.logo
    if (c.logo_login) previews.logo_login = baseUrl + c.logo_login
    if (c.logo_sidebar) previews.logo_sidebar = baseUrl + c.logo_sidebar
    if (c.logo_sidebar_compact) previews.logo_sidebar_compact = baseUrl + c.logo_sidebar_compact
  }
})

const handleFileChange = (e, field) => {
  const file = e.target.files[0]
  if (!file) return
  
  files[field] = file
  previews[field] = URL.createObjectURL(file)
}

const saveChanges = async () => {
  const formData = new FormData()
  
  // Append general data
  Object.keys(form).forEach(key => {
    formData.append(key, form[key])
  })
  
  // Append hero titles
  Object.keys(heroTitles).forEach(key => {
    formData.append(key, heroTitles[key])
  })
  
  // Append files
  Object.keys(files).forEach(key => {
    if (files[key]) {
      formData.append(key, files[key])
    }
  })

  try {
    await companyStore.updateCompanyData(formData)
    Swal.fire({
      icon: 'success',
      title: 'Información actualizada',
      text: 'Los cambios se han guardado correctamente.',
      confirmButtonColor: form.color_primario
    })
  } catch (error) {
    Swal.fire('Error', 'No se pudo actualizar la información corporativa.', 'error')
  }
}
</script>

<template>
  <div class="empresa-container animate__animated animate__fadeIn">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h3 class="fw-bold mb-0">Configuración de Empresa</h3>
        <p class="text-muted small">Gestiona la identidad visual y contenido de tu Landing Page</p>
      </div>
      <button @click="saveChanges" class="btn btn-primary px-4 shadow-sm" :disabled="companyStore.loading">
        <span v-if="companyStore.loading" class="spinner-border spinner-border-sm me-2"></span>
        <i v-else class="bi bi-save me-2"></i>
        Guardar Cambios
      </button>
    </div>

    <div class="card border-0 shadow-sm overflow-hidden">
      <div class="card-header bg-white p-0">
        <ul class="nav nav-tabs border-0 px-3 pt-2">
          <li class="nav-item">
            <button class="nav-link border-0" :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">
              <i class="bi bi-info-circle me-2"></i> Información General
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link border-0" :class="{ active: activeTab === 'social' }" @click="activeTab = 'social'">
              <i class="bi bi-share me-2"></i> Redes Sociales
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link border-0" :class="{ active: activeTab === 'branding' }" @click="activeTab = 'branding'">
              <i class="bi bi-palette me-2"></i> Branding & Logo
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link border-0" :class="{ active: activeTab === 'slider' }" @click="activeTab = 'slider'">
              <i class="bi bi-images me-2"></i> Slider Hero
            </button>
          </li>
        </ul>
      </div>

      <div class="card-body p-4">
        <div v-if="activeTab === 'general'" class="row g-4">
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase">Nombre de la Empresa</label>
            <input v-model="form.nombre" type="text" class="form-control" placeholder="Ej: Multilider System">
          </div>
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase">Eslogan / Frase de Marca</label>
            <input v-model="form.eslogan" type="text" class="form-control" placeholder="Ej: Tu hogar, nuestra prioridad">
          </div>
          <div class="col-12">
            <label class="form-label fw-bold small text-uppercase">Descripción "Nosotros"</label>
            <textarea v-model="form.descripcion_nosotros" class="form-control" rows="3" placeholder="Descripción amplia para la landing page"></textarea>
          </div>
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase">Misión</label>
            <textarea v-model="form.mision" class="form-control" rows="3"></textarea>
          </div>
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase">Visión</label>
            <textarea v-model="form.vision" class="form-control" rows="3"></textarea>
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold small text-uppercase">Teléfono Oficina</label>
            <input v-model="form.telefono" type="text" class="form-control">
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold small text-uppercase">WhatsApp (Formato Int.)</label>
            <input v-model="form.whatsapp" type="text" class="form-control" placeholder="59170000000">
          </div>
          <div class="col-md-4">
            <label class="form-label fw-bold small text-uppercase">Email de Contacto</label>
            <input v-model="form.email" type="email" class="form-control">
          </div>
          <div class="col-md-8">
            <label class="form-label fw-bold small text-uppercase">Dirección Física</label>
            <input v-model="form.direccion" type="text" class="form-control">
          </div>
          <div class="col-12">
            <label class="form-label fw-bold small text-uppercase">Google Maps Iframe (Código de Inserción)</label>
            <textarea v-model="form.mapa_iframe" class="form-control" rows="3" placeholder="Pegue aquí el código <iframe>...</iframe>"></textarea>
          </div>
        </div>

        <div v-if="activeTab === 'social'" class="row g-4">
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase"><i class="bi bi-facebook me-2 text-primary"></i> Facebook URL</label>
            <input v-model="form.facebook" type="url" class="form-control" placeholder="https://facebook.com/tu_empresa">
          </div>
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase"><i class="bi bi-instagram me-2 text-danger"></i> Instagram URL</label>
            <input v-model="form.instagram" type="url" class="form-control" placeholder="https://instagram.com/tu_empresa">
          </div>
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase"><i class="bi bi-tiktok me-2 text-dark"></i> TikTok URL</label>
            <input v-model="form.tiktok" type="url" class="form-control" placeholder="https://tiktok.com/@tu_empresa">
          </div>
          <div class="col-md-6">
            <label class="form-label fw-bold small text-uppercase"><i class="bi bi-youtube me-2 text-danger"></i> YouTube URL</label>
            <input v-model="form.youtube" type="url" class="form-control" placeholder="https://youtube.com/c/tu_empresa">
          </div>
        </div>

        <div v-if="activeTab === 'branding'" class="row g-4">
          <div class="col-md-3">
            <label class="form-label fw-bold small text-uppercase">Logo Principal (Landing)</label>
            <div class="border rounded p-3 text-center mb-2 bg-light">
              <img v-if="previews.logo" :src="previews.logo" class="img-fluid mb-3" style="max-height: 100px;">
              <div v-else class="text-muted py-4"><i class="bi bi-image fs-1 d-block"></i> Sin logo</div>
              <input type="file" @change="e => handleFileChange(e, 'logo')" class="form-control form-control-sm" accept="image/*">
            </div>
            <p class="small text-muted">Uso en Landing Page.</p>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold small text-uppercase">Logo Login</label>
            <div class="border rounded p-3 text-center mb-2 bg-light">
              <img v-if="previews.logo_login" :src="previews.logo_login" class="img-fluid mb-3" style="max-height: 100px;">
              <div v-else class="text-muted py-4"><i class="bi bi-shield-lock fs-1 d-block"></i> Sin logo</div>
              <input type="file" @change="e => handleFileChange(e, 'logo_login')" class="form-control form-control-sm" accept="image/*">
            </div>
            <p class="small text-muted">Uso en pantalla de acceso.</p>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold small text-uppercase">Logo Sidebar</label>
            <div class="border rounded p-3 text-center mb-2 bg-light">
              <img v-if="previews.logo_sidebar" :src="previews.logo_sidebar" class="img-fluid mb-3" style="max-height: 80px; object-fit: contain;">
              <div v-else class="text-muted py-4"><i class="bi bi-layout-sidebar fs-1 d-block"></i> Sin logo</div>
              <input type="file" @change="e => handleFileChange(e, 'logo_sidebar')" class="form-control form-control-sm" accept="image/*">
            </div>
            <p class="small text-muted">Menú lateral expandido.</p>
          </div>

          <div class="col-md-3">
            <label class="form-label fw-bold small text-uppercase">Logo Sidebar (Compacto)</label>
            <div class="border rounded p-3 text-center mb-2 bg-light">
              <img v-if="previews.logo_sidebar_compact" :src="previews.logo_sidebar_compact" class="img-fluid mb-3" style="max-height: 80px; object-fit: contain;">
              <div v-else class="text-muted py-4"><i class="bi bi-layout-sidebar-inset fs-1 d-block"></i> Sin logo</div>
              <input type="file" @change="e => handleFileChange(e, 'logo_sidebar_compact')" class="form-control form-control-sm" accept="image/*">
            </div>
            <p class="small text-muted">Menú contraído.</p>
          </div>

          <div class="col-md-6 mt-4">
            <label class="form-label fw-bold small text-uppercase">Color Primario</label>
            <div class="d-flex gap-3 align-items-center">
              <input v-model="form.color_primario" type="color" class="form-control form-control-color" style="width: 100px; height: 100px;">
              <input v-model="form.color_primario" type="text" class="form-control" placeholder="#000000">
            </div>
          </div>
          <div class="col-md-6 mt-4">
            <label class="form-label fw-bold small text-uppercase">Color Secundario</label>
            <div class="d-flex gap-3 align-items-center">
              <input v-model="form.color_secundario" type="color" class="form-control form-control-color" style="width: 100px; height: 100px;">
              <input v-model="form.color_secundario" type="text" class="form-control" placeholder="#000000">
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'slider'" class="row g-4">
          <div v-for="i in 3" :key="i" class="col-12 border-bottom pb-4 mb-4">
            <h6 class="fw-bold mb-3">Imagen del Slider #{{ i }}</h6>
            <div class="row g-3">
              <div class="col-md-4">
                <div class="border rounded overflow-hidden bg-light mb-2">
                  <img v-if="previews['hero_image_' + i]" :src="previews['hero_image_' + i]" class="w-100 object-fit-cover" style="height: 150px;">
                  <div v-else class="text-center py-5 text-muted"><i class="bi bi-image fs-2"></i></div>
                </div>
                <input type="file" @change="e => handleFileChange(e, 'hero_image_' + i)" class="form-control form-control-sm" accept="image/*">
              </div>
              <div class="col-md-8">
                <div class="mb-3">
                  <label class="form-label small fw-bold">Título sobre la imagen</label>
                  <input v-model="heroTitles['hero_title_' + i]" type="text" class="form-control" placeholder="Ej: Encuentra el hogar de tus sueños">
                </div>
                <div>
                  <label class="form-label small fw-bold">Subtítulo</label>
                  <input v-model="heroTitles['hero_subtitle_' + i]" type="text" class="form-control" placeholder="Ej: Las mejores ubicaciones en Santa Cruz">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav-tabs .nav-link {
  color: var(--text-muted);
  font-weight: 500;
  padding: 1rem 1.5rem;
}
.nav-tabs .nav-link.active {
  color: var(--primary-color);
  border-bottom: 3px solid var(--primary-color) !important;
  background: transparent;
}
.form-control:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 0.25rem rgba(var(--primary-color-rgb), 0.1);
}
</style>
