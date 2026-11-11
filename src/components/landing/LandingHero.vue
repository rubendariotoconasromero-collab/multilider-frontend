<script setup>
import { apiOrigin } from '@/api/config'
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCompanyStore } from '@/stores/company'
import { Search, MapPin, Home, DollarSign, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const router = useRouter()
const companyStore = useCompanyStore()
const currentSlide = ref(0)
const baseUrl = apiOrigin

const filterType = ref('')
const filterCity = ref('')
const filterPrice = ref('')

// Construir el array de slides basado en los datos de la empresa
const slides = computed(() => {
  if (!companyStore.company) return []
  const c = companyStore.company
  const list = []
  
  for (let i = 1; i <= 3; i++) {
    if (c[`hero_image_${i}`]) {
      list.push({
        id: i,
        image: baseUrl + c[`hero_image_${i}`],
        title: c[`hero_title_${i}`] || c.nombre,
        subtitle: c[`hero_subtitle_${i}`] || c.eslogan
      })
    }
  }
  return list
})

const handleSearch = () => {
  const query = {}
  if (filterType.value) query.tipo = filterType.value
  if (filterCity.value) {
    const cityObj = companyStore.cities.find(c => c.nombre === filterCity.value)
    if (cityObj) query.ciudad_id = cityObj.id
  }
  
  if (filterPrice.value) {
    const [min, max] = filterPrice.value.split('-')
    if (min) query.precio_min = min
    if (max) query.precio_max = max.replace('+', '')
  }

  router.push({ name: 'PropiedadesLanding', query })
}

const nextSlide = () => {
  if (slides.value.length <= 1) return
  currentSlide.value = (currentSlide.value + 1) % slides.value.length
}

const prevSlide = () => {
  if (slides.value.length <= 1) return
  currentSlide.value = (currentSlide.value - 1 + slides.value.length) % slides.value.length
}

const formatTitle = (title) => {
  if (!title) return ''
  // Resalta palabras clave como 'Ideal', 'Hogar', 'Inversión' con el gradiente
  return title
    .replace('Ideal', '<span>Ideal</span>')
    .replace('Hogar', '<span>Hogar</span>')
    .replace('Inversión', '<span>Inversión</span>')
}

onMounted(() => {
  companyStore.fetchCities()
  setInterval(() => {
    if (slides.value.length > 1) nextSlide()
  }, 8000)
})
</script>

<template>
  <section id="inicio" class="hero-master overflow-hidden">
    <!-- Slider Background con Gradiente de Contraste Inteligente -->
    <div class="hero-bg-container">
      <div 
        v-for="(slide, index) in slides" 
        :key="slide.id"
        class="slide-img-wrap" 
        :class="{ 'active': currentSlide === index }"
      >
        <img :src="slide.image" class="ken-burns-img" alt="Luxury Real Estate">
        <div class="hero-overlay-intelligent"></div>
      </div>
      
      <!-- Fallback Gradient -->
      <div v-if="slides.length === 0" class="hero-fallback"></div>
    </div>

    <div class="container h-100 d-flex align-items-center justify-content-center">
      <div class="text-center z-3 w-100">
        
        <div class="badge-premium mb-4 mx-auto animate__animated animate__fadeInDown">
          <span class="badge-dot"></span>
          {{ companyStore.company?.nombre || 'Multilider System' }}
        </div>

        <div class="hero-content-slider" v-if="slides.length > 0">
          <div 
            v-for="(slide, index) in slides" 
            :key="'text-'+slide.id"
            v-show="currentSlide === index"
            class="animate__animated animate__fadeInUp"
          >
            <h1 class="hero-title fw-black mb-4">
              <span v-html="formatTitle(slide.title)"></span>
            </h1>
            <p class="hero-subtitle text-white-50 mb-5 mx-auto">{{ slide.subtitle }}</p>
          </div>
        </div>
        
        <div v-else class="animate__animated animate__fadeInUp">
          <h1 class="hero-title fw-black mb-4">Inversión Inmobiliaria <span class="text-gradient">Inteligente</span></h1>
          <p class="hero-subtitle text-white-50 mb-5 mx-auto">Contamos con los mejores lotes y casas para tu bienestar.</p>
        </div>

        <!-- BUSCADOR: White Gloss High Contrast -->
        <div class="search-anchor mx-auto animate__animated animate__zoomIn animate__delay-1s">
          <div class="search-card">
            <div class="row g-0 align-items-center p-2">
              
              <div class="col-lg-3 col-md-6 search-field px-4 py-3 text-start">
                <label class="search-label"><i class="bi bi-house me-2"></i>Propiedad</label>
                <select v-model="filterType" class="search-select">
                  <option value="">¿Qué buscas?</option>
                  <option value="Lote">Lotes de Terreno</option>
                  <option value="Casa">Casas Residenciales</option>
                </select>
              </div>

              <div class="col-lg-3 col-md-6 search-field px-4 py-3 text-start border-start-lg">
                <label class="search-label"><i class="bi bi-geo-alt me-2"></i>Ubicación</label>
                <select v-model="filterCity" class="search-select">
                  <option value="">Toda la ciudad</option>
                  <option v-for="ciudad in companyStore.cities" :key="ciudad.id" :value="ciudad.nombre">
                    {{ ciudad.nombre }}
                  </option>
                </select>
              </div>

              <div class="col-lg-3 col-md-6 search-field px-4 py-3 text-start border-start-lg">
                <label class="search-label"><i class="bi bi-currency-dollar me-2"></i>Presupuesto</label>
                <select v-model="filterPrice" class="search-select">
                  <option value="">Cualquier rango</option>
                  <option value="0-50000">Hasta $50,000</option>
                  <option value="50000-150000">$50k - $150k</option>
                  <option value="150000+">Más de $150k</option>
                </select>
              </div>

              <div class="col-lg-3 col-md-12 p-1">
                <button @click="handleSearch" class="btn-search-master">
                  <Search :size="20" class="me-2" />
                  <span>Buscar Ofertas</span>
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Controls Lateral Premium -->
    <div class="hero-controls-premium" v-if="slides.length > 1">
      <div class="control-numbers">
        <span class="current">{{ (currentSlide + 1).toString().padStart(2, '0') }}</span>
        <div class="progress-bar-vertical">
          <div class="progress-fill" :style="{ height: ((currentSlide + 1) / slides.length * 100) + '%' }"></div>
        </div>
        <span class="total">{{ slides.length.toString().padStart(2, '0') }}</span>
      </div>
      <div class="control-actions mt-4">
        <button @click="prevSlide" class="btn-ctrl"><ChevronLeft :size="20" /></button>
        <button @click="nextSlide" class="btn-ctrl"><ChevronRight :size="20" /></button>
      </div>
    </div>

    <!-- Scroll Down Icon -->
    <div class="scroll-indicator">
      <div class="mouse-icon">
        <div class="wheel-anim"></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero-master {
  position: relative;
  height: 100vh;
  background-color: #020617;
}

/* Background & Overlays */
.hero-bg-container {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.slide-img-wrap {
  position: absolute;
  inset: 0;
  opacity: 0;
  visibility: hidden;
  transition: opacity 1.5s ease-in-out, visibility 1.5s;
}
.slide-img-wrap.active { 
  opacity: 1; 
  visibility: visible;
}

.ken-burns-img {
  width: 100%; height: 100%;
  object-fit: cover;
  animation: zoomEffect 25s infinite alternate;
}

@keyframes zoomEffect {
  from { transform: scale(1); }
  to { transform: scale(1.2); }
}

/* Overlay Inteligente para Contraste */
.hero-overlay-intelligent {
  position: absolute;
  inset: 0;
  background: 
    linear-gradient(to top, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.4) 40%, rgba(2, 6, 23, 0.4) 70%, rgba(2, 6, 23, 0.8) 100%),
    radial-gradient(circle at center, transparent 0%, rgba(2, 6, 23, 0.5) 100%);
}

.hero-fallback {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #020617 0%, #1e40af 100%);
}

.z-3 { z-index: 3; }

/* Badge Premium */
.badge-premium {
  display: flex;
  align-items: center;
  gap: 12px;
  width: fit-content;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
  padding: 10px 24px;
  border-radius: 100px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.badge-dot {
  width: 8px; height: 8px;
  background-color: var(--landing-primary);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--landing-primary);
}

/* Tipografía */
.hero-title {
  color: white;
  font-size: clamp(2.5rem, 8vw, 4.5rem);
  line-height: 1.05;
  letter-spacing: -2px;
}

.hero-subtitle {
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  max-width: 700px;
  line-height: 1.6;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

/* Buscador de Alto Impacto */
.search-anchor {
  max-width: 1100px;
  width: 95%;
}

.search-card {
  background: #ffffff; /* Fondo blanco sólido para máxima claridad */
  border-radius: 35px;
  box-shadow: 0 40px 100px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,1);
}

.search-field { position: relative; }
.search-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--landing-primary); /* Color de marca para las etiquetas */
  text-transform: uppercase;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}

/* Forzar color de etiquetas en modo oscuro para que no se pierdan sobre el card blanco */
[data-theme="dark"] .search-label {
  color: #0B2545 !important; /* Navy fijo */
}

.search-select {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a; /* Texto oscuro para que se vea sobre blanco */
  outline: none;
  cursor: pointer;
  appearance: none;
}

/* Forzar color de texto del select en modo oscuro para que se vea sobre el fondo blanco del card */
[data-theme="dark"] .search-select {
  color: #0f172a !important;
}

/* Estilo para las opciones del select */
.search-select option {
  color: #0f172a;
  background-color: white;
}

.btn-search-master {
  width: 100%;
  background: linear-gradient(135deg, var(--landing-primary) 0%, #2563eb 100%);
  color: white !important; /* Texto blanco sobre botón azul */
  border: none;
  padding: 20px;
  border-radius: 28px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 25px rgba(var(--landing-primary-rgb), 0.4);
}

.btn-search-master:hover {
  background: var(--landing-primary);
  transform: scale(1.03) translateY(-2px);
  box-shadow: 0 15px 30px rgba(var(--landing-primary-rgb), 0.4);
}

/* Controles Laterales */
.hero-controls-premium {
  position: absolute;
  right: 40px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.control-numbers {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  color: white;
}

.control-numbers .current {
  font-size: 2.2rem;
  font-weight: 900;
  color: var(--landing-primary);
}

.progress-bar-vertical {
  width: 2px; height: 100px;
  background: rgba(255,255,255,0.1);
  position: relative;
  border-radius: 2px;
}

.progress-fill {
  position: absolute;
  top: 0; left: 0; width: 100%;
  background: var(--landing-primary);
  transition: height 0.8s ease;
  box-shadow: 0 0 10px var(--landing-primary);
}

.btn-ctrl {
  width: 45px; height: 45px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05);
  color: white;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 10px;
  transition: all 0.3s;
}

.btn-ctrl:hover {
  background: var(--landing-primary);
  border-color: var(--landing-primary);
  transform: translateX(-5px);
}

/* Scroll Indicator */
.scroll-indicator {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
}

.mouse-icon {
  width: 24px; height: 40px;
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 20px;
  position: relative;
}

.wheel-anim {
  width: 3px; height: 6px;
  background-color: white;
  border-radius: 2px;
  position: absolute;
  top: 8px; left: 50%;
  transform: translateX(-50%);
  animation: scrollMouse 2s infinite;
}

@keyframes scrollMouse {
  0% { opacity: 0; transform: translate(-50%, 0); }
  50% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, 15px); }
}

@media (min-width: 992px) {
  .border-start-lg { border-left: 1px solid #e2e8f0 !important; }
}

@media (max-width: 991px) {
  .hero-controls-premium {
    right: auto; left: 20px;
    top: auto; bottom: 40px;
    transform: none;
    flex-direction: row;
  }
  .control-numbers { flex-direction: row; }
  .progress-bar-vertical { width: 50px; height: 2px; }
  .control-actions { margin-top: 0 !important; margin-left: 20px; display: flex; gap: 10px; }
  .search-card { border-radius: 25px; }
}
</style>
