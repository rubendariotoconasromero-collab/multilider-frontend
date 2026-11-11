<script setup>
import { apiOrigin } from '@/api/config'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompanyStore } from '@/stores/company'
import {
  MapPin, Maximize, Bed, Bath, Building2,
  ChevronLeft, ChevronRight, ArrowLeft, Phone,
  MessageCircle, Tag, CheckCircle2, Share2
} from 'lucide-vue-next'
import LandingHeader from '@/components/landing/LandingHeader.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
import WhatsAppButton from '@/components/landing/WhatsAppButton.vue'
import PropiedadCard from '@/components/landing/PropiedadCard.vue'

const route  = useRoute()
const router = useRouter()
const store  = useCompanyStore()

const activeImg = ref(0)

const prop     = computed(() => store.currentProperty)
const similares = computed(() => store.similarProperties)

const images = computed(() => {
  if (!prop.value?.imagenes?.length) return []
  const sorted = [...prop.value.imagenes].sort((a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0))
  return sorted.map(i => apiOrigin + i.url)
})

const prevImg = () => { activeImg.value = activeImg.value === 0 ? images.value.length - 1 : activeImg.value - 1 }
const nextImg = () => { activeImg.value = activeImg.value === images.value.length - 1 ? 0 : activeImg.value + 1 }

const formatPrice = (price) => new Intl.NumberFormat('es-BO').format(price)

const estadoClass = (estado) => {
  if (estado === 'Disponible') return 'estado-disponible'
  if (estado === 'Vendido')    return 'estado-vendido'
  if (estado === 'Reservado')  return 'estado-reservado'
  return 'estado-disponible'
}

const whatsappUrl = computed(() => {
  if (!store.company?.whatsapp || !prop.value) return '#'
  const num  = store.company.whatsapp.replace(/\D/g, '')
  const msg  = encodeURIComponent(`Hola, me interesa la propiedad ${prop.value.codigo} — ${prop.value.tipo} en ${prop.value.sector_urbano?.nombre}. ¿Podría darme más información?`)
  return `https://wa.me/${num}?text=${msg}`
})

const colindancias = computed(() => {
  if (!prop.value) return []
  return [
    { label: 'Norte', value: prop.value.colinda_norte },
    { label: 'Sur',   value: prop.value.colinda_sur   },
    { label: 'Este',  value: prop.value.colinda_este  },
    { label: 'Oeste', value: prop.value.colinda_oeste },
  ].filter(c => c.value)
})

const hasColindancias = computed(() => colindancias.value.length > 0 || prop.value?.frente_mts || prop.value?.fondo_mts)

const loadData = async (id) => {
  activeImg.value = 0
  await Promise.all([
    store.fetchPropiedad(id),
    store.fetchSimilares(id),
    !store.company ? store.fetchCompany() : Promise.resolve()
  ])
}

onMounted(() => loadData(route.params.id))
watch(() => route.params.id, (id) => { if (id) loadData(id) })
</script>

<template>
  <div class="landing-page bg-light-landing min-vh-100 d-flex flex-column">
    <LandingHeader :transparentAtTop="false" />

    <!-- Loading -->
    <main v-if="store.loadingProperty" class="flex-grow-1 d-flex align-items-center justify-content-center" style="padding-top:90px">
      <div class="text-center py-5">
        <div class="spinner-border text-primary mb-3" role="status"></div>
        <p class="text-muted">Cargando propiedad...</p>
      </div>
    </main>

    <!-- Error / no encontrada -->
    <main v-else-if="!prop" class="flex-grow-1 d-flex align-items-center justify-content-center" style="padding-top:90px">
      <div class="text-center py-5">
        <i class="bi bi-house-x display-1 text-muted opacity-25 d-block mb-4"></i>
        <h3 class="fw-bold">Propiedad no encontrada</h3>
        <p class="text-muted">Es posible que ya no esté disponible.</p>
        <button @click="router.push('/propiedades-venta')" class="btn-landing btn-landing-primary px-4 mt-2">
          Ver catálogo
        </button>
      </div>
    </main>

    <!-- Detalle -->
    <main v-else class="flex-grow-1" style="padding-top:80px">

      <!-- Breadcrumb -->
      <div class="bg-white border-bottom py-3">
        <div class="container">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <button @click="router.push('/')" class="breadcrumb-btn">Inicio</button>
            <i class="bi bi-chevron-right text-muted" style="font-size:.7rem"></i>
            <button @click="router.push('/propiedades-venta')" class="breadcrumb-btn">Propiedades</button>
            <i class="bi bi-chevron-right text-muted" style="font-size:.7rem"></i>
            <span class="text-dark fw-semibold" style="font-size:.85rem">{{ prop.tipo }} en {{ prop.sector_urbano?.nombre }}</span>
          </div>
        </div>
      </div>

      <div class="container py-5">
        <div class="row g-5">

          <!-- ══════════════ COLUMNA IZQUIERDA ══════════════ -->
          <div class="col-lg-8">

            <!-- Galería de imágenes -->
            <div class="gallery-wrap mb-4">
              <!-- Sin imágenes -->
              <div v-if="!images.length" class="gallery-main d-flex align-items-center justify-content-center bg-light text-muted rounded-4">
                <div class="text-center">
                  <i class="bi bi-house display-1 opacity-25 d-block mb-2"></i>
                  <span class="small">Sin imágenes disponibles</span>
                </div>
              </div>

              <!-- Imagen principal -->
              <div v-else class="gallery-main rounded-4 overflow-hidden position-relative">
                <img :src="images[activeImg]" :alt="`Imagen ${activeImg + 1}`" class="gallery-main-img">

                <!-- Flechas si hay más de 1 -->
                <template v-if="images.length > 1">
                  <button @click="prevImg" class="gallery-arrow gallery-arrow-left">
                    <ChevronLeft :size="22" />
                  </button>
                  <button @click="nextImg" class="gallery-arrow gallery-arrow-right">
                    <ChevronRight :size="22" />
                  </button>
                  <span class="gallery-counter">{{ activeImg + 1 }} / {{ images.length }}</span>
                </template>
              </div>

              <!-- Thumbnails -->
              <div v-if="images.length > 1" class="gallery-thumbs mt-3">
                <div
                  v-for="(img, idx) in images"
                  :key="idx"
                  @click="activeImg = idx"
                  :class="['gallery-thumb', { 'gallery-thumb-active': activeImg === idx }]"
                >
                  <img :src="img" :alt="`Thumb ${idx + 1}`">
                </div>
              </div>
            </div>

            <!-- Título y badges de estado -->
            <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
              <span class="detail-badge-tipo">{{ prop.tipo }}</span>
              <span :class="['detail-estado', estadoClass(prop.estado)]">{{ prop.estado }}</span>
              <span v-if="prop.es_destacado" class="detail-badge-featured">
                <i class="bi bi-star-fill me-1"></i>Destacado
              </span>
            </div>

            <h1 class="detail-title mb-2">{{ prop.tipo }} en {{ prop.sector_urbano?.nombre }}</h1>

            <div class="d-flex align-items-center gap-2 mb-4 detail-location">
              <MapPin :size="16" />
              <span>{{ prop.sector_urbano?.nombre }}{{ prop.sector_urbano?.distrito?.ciudad?.nombre ? ', ' + prop.sector_urbano.distrito.ciudad.nombre : '' }}</span>
            </div>

            <!-- Precio mobile (visible solo en móvil) -->
            <div class="d-lg-none bg-white rounded-4 p-4 shadow-sm mb-4">
              <p class="text-muted small mb-1">Precio de venta</p>
              <div class="d-flex align-items-baseline gap-2">
                <span class="text-muted">{{ prop.moneda }}</span>
                <span class="detail-price-big">{{ formatPrice(prop.precio_venta) }}</span>
              </div>
            </div>

            <!-- Características principales -->
            <div class="detail-stats-grid mb-5">
              <div class="detail-stat">
                <Maximize :size="22" class="detail-stat-icon" />
                <span class="detail-stat-val">{{ prop.superficie_m2 }}<small>m²</small></span>
                <span class="detail-stat-lbl">Superficie terreno</span>
              </div>
              <template v-if="prop.tipo === 'Casa'">
                <div class="detail-stat" v-if="prop.superficie_construida_m2">
                  <Building2 :size="22" class="detail-stat-icon" />
                  <span class="detail-stat-val">{{ prop.superficie_construida_m2 }}<small>m²</small></span>
                  <span class="detail-stat-lbl">Área construida</span>
                </div>
                <div class="detail-stat" v-if="prop.habitaciones">
                  <Bed :size="22" class="detail-stat-icon" />
                  <span class="detail-stat-val">{{ prop.habitaciones }}</span>
                  <span class="detail-stat-lbl">Dormitorios</span>
                </div>
                <div class="detail-stat" v-if="prop.banos">
                  <Bath :size="22" class="detail-stat-icon" />
                  <span class="detail-stat-val">{{ prop.banos }}</span>
                  <span class="detail-stat-lbl">Baños</span>
                </div>
              </template>
              <div class="detail-stat" v-if="prop.tipo === 'Lote' && prop.frente_mts">
                <span class="detail-stat-icon fw-bold" style="font-size:1.1rem">↔</span>
                <span class="detail-stat-val">{{ prop.frente_mts }}<small>m</small></span>
                <span class="detail-stat-lbl">Frente</span>
              </div>
              <div class="detail-stat" v-if="prop.tipo === 'Lote' && prop.fondo_mts">
                <span class="detail-stat-icon fw-bold" style="font-size:1.1rem">↕</span>
                <span class="detail-stat-val">{{ prop.fondo_mts }}<small>m</small></span>
                <span class="detail-stat-lbl">Fondo</span>
              </div>
            </div>

            <!-- Colindancias (Lote) -->
            <div v-if="hasColindancias" class="detail-section mb-5">
              <h2 class="detail-section-title">Colindancias</h2>
              <div class="colindancias-grid">
                <div v-for="col in colindancias" :key="col.label" class="colindancia-item">
                  <span class="colindancia-dir">{{ col.label }}</span>
                  <span class="colindancia-val">{{ col.value }}</span>
                </div>
              </div>
              <div v-if="prop.nro_lote || prop.direccion" class="mt-3 d-flex flex-wrap gap-3">
                <div v-if="prop.nro_lote" class="colindancia-extra">
                  <span class="text-muted small">Nro. Lote</span>
                  <span class="fw-semibold">{{ prop.nro_lote }}</span>
                </div>
                <div v-if="prop.es_esquina" class="colindancia-extra">
                  <i class="bi bi-signpost-2-fill text-indigo me-1"></i>
                  <span class="fw-semibold text-indigo">Lote en Esquina</span>
                </div>
              </div>
            </div>

            <!-- Características / amenities -->
            <div v-if="prop.caracteristicas?.length" class="detail-section mb-5">
              <h2 class="detail-section-title">Características</h2>
              <div class="caracteristicas-grid">
                <div v-for="car in prop.caracteristicas" :key="car.id" class="caracteristica-item">
                  <CheckCircle2 :size="16" class="car-icon" />
                  <span>{{ car.nombre }}</span>
                </div>
              </div>
            </div>

            <!-- Dirección -->
            <div v-if="prop.direccion" class="detail-section mb-5">
              <h2 class="detail-section-title">Dirección referencial</h2>
              <div class="d-flex align-items-start gap-2 text-muted">
                <MapPin :size="18" class="mt-1 flex-shrink-0" style="color: var(--landing-primary, #1e40af)" />
                <span>{{ prop.direccion }}</span>
              </div>
            </div>

            <!-- Mapa (si hay ubicación GPS) -->
            <div v-if="prop.ubicacion?.latitud && prop.ubicacion?.longitud" class="detail-section mb-5">
              <h2 class="detail-section-title">Ubicación en mapa</h2>
              <div class="map-wrap rounded-4 overflow-hidden">
                <iframe
                  :src="`https://maps.google.com/maps?q=${prop.ubicacion.latitud},${prop.ubicacion.longitud}&z=16&output=embed`"
                  width="100%" height="320" style="border:0" allowfullscreen loading="lazy"
                ></iframe>
              </div>
            </div>
          </div>

          <!-- ══════════════ SIDEBAR DERECHA ══════════════ -->
          <div class="col-lg-4">
            <div class="sticky-top" style="top:100px">

              <!-- Card precio + CTA -->
              <div class="sidebar-card mb-4">
                <p class="text-muted small mb-1">Precio de venta</p>
                <div class="d-flex align-items-baseline gap-2 mb-4">
                  <span class="text-muted">{{ prop.moneda }}</span>
                  <span class="detail-price-big">{{ formatPrice(prop.precio_venta) }}</span>
                </div>

                <!-- WhatsApp -->
                <a :href="whatsappUrl" target="_blank" rel="noopener" class="sidebar-btn sidebar-btn-wa mb-3 d-flex">
                  <i class="bi bi-whatsapp me-2" style="font-size:1.1rem"></i>
                  Consultar por WhatsApp
                </a>

                <!-- Teléfono -->
                <a v-if="store.company?.telefono" :href="`tel:${store.company.telefono}`" class="sidebar-btn sidebar-btn-outline d-flex">
                  <Phone :size="17" class="me-2" />
                  {{ store.company.telefono }}
                </a>

                <hr class="my-4">

                <!-- Ficha rápida -->
                <ul class="ficha-list">
                  <li><span>Código</span><strong>{{ prop.codigo }}</strong></li>
                  <li><span>Tipo</span><strong>{{ prop.tipo }}</strong></li>
                  <li><span>Estado</span>
                    <strong :class="['ficha-estado', estadoClass(prop.estado)]">{{ prop.estado }}</strong>
                  </li>
                  <li><span>Ciudad</span><strong>{{ prop.sector_urbano?.distrito?.ciudad?.nombre || '—' }}</strong></li>
                  <li><span>Distrito</span><strong>{{ prop.sector_urbano?.distrito?.nombre || '—' }}</strong></li>
                  <li><span>Sector</span><strong>{{ prop.sector_urbano?.nombre || '—' }}</strong></li>
                  <li v-if="prop.superficie_m2"><span>Terreno</span><strong>{{ prop.superficie_m2 }} m²</strong></li>
                  <li v-if="prop.superficie_construida_m2"><span>Construido</span><strong>{{ prop.superficie_construida_m2 }} m²</strong></li>
                  <li v-if="prop.habitaciones"><span>Dormitorios</span><strong>{{ prop.habitaciones }}</strong></li>
                  <li v-if="prop.banos"><span>Baños</span><strong>{{ prop.banos }}</strong></li>
                  <li v-if="prop.frente_mts"><span>Frente</span><strong>{{ prop.frente_mts }} m</strong></li>
                  <li v-if="prop.fondo_mts"><span>Fondo</span><strong>{{ prop.fondo_mts }} m</strong></li>
                </ul>
              </div>

              <!-- Volver -->
              <button @click="router.push('/propiedades-venta')" class="w-100 d-flex align-items-center justify-content-center gap-2 sidebar-btn sidebar-btn-outline">
                <ArrowLeft :size="16" /> Ver más propiedades
              </button>
            </div>
          </div>
        </div>

        <!-- ══════════════ PROPIEDADES SIMILARES ══════════════ -->
        <section v-if="similares.length" class="mt-5 pt-4">
          <div class="d-flex align-items-center justify-content-between mb-4">
            <div>
              <h2 class="fw-bold mb-1" style="font-size:1.4rem">Propiedades similares</h2>
              <p class="text-muted small mb-0">Otros {{ prop.tipo === 'Casa' ? 'casas' : 'lotes' }} disponibles</p>
            </div>
            <button @click="router.push({ path: '/propiedades-venta', query: { tipo: prop.tipo } })" class="btn-landing btn-landing-outline text-decoration-none d-inline-flex align-items-center gap-1" style="font-size:.82rem">
              Ver todos
            </button>
          </div>
          <div class="row g-4">
            <div v-for="s in similares" :key="s.id" class="col-sm-6 col-lg-3">
              <PropiedadCard :prop="s" />
            </div>
          </div>
        </section>
      </div>
    </main>

    <LandingFooter />
    <WhatsAppButton />
  </div>
</template>

<style scoped>
/* Breadcrumb */
.breadcrumb-btn {
  background: none; border: none; padding: 0;
  font-size: .85rem; color: #64748b; cursor: pointer;
}
.breadcrumb-btn:hover { color: var(--landing-primary, #1e40af); text-decoration: underline; }

/* Galería */
.gallery-main {
  height: 420px;
  background: #f1f5f9;
}
.gallery-main-img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.gallery-arrow {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,.9); border: none;
  width: 42px; height: 42px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.15);
  transition: background .2s;
  z-index: 2;
}
.gallery-arrow:hover { background: #fff; }
.gallery-arrow-left  { left: 12px; }
.gallery-arrow-right { right: 12px; }
.gallery-counter {
  position: absolute; bottom: 12px; right: 14px;
  background: rgba(0,0,0,.45); color: #fff;
  font-size: .75rem; padding: 3px 10px; border-radius: 20px;
}
.gallery-thumbs {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;
}
.gallery-thumb {
  width: 72px; height: 56px; flex-shrink: 0;
  border-radius: 8px; overflow: hidden; cursor: pointer;
  border: 2px solid transparent; transition: border-color .2s;
}
.gallery-thumb img { width:100%; height:100%; object-fit:cover; }
.gallery-thumb-active { border-color: var(--landing-primary, #1e40af); }

/* Badges */
.detail-badge-tipo {
  font-size: .72rem; font-weight: 700; text-transform: uppercase;
  background: var(--landing-primary, #1e40af); color: #fff;
  padding: 4px 12px; border-radius: 20px;
}
.detail-badge-featured {
  font-size: .72rem; font-weight: 700; text-transform: uppercase;
  background: #fbbf24; color: #1a1a1a;
  padding: 4px 12px; border-radius: 20px;
}
.detail-estado {
  font-size: .72rem; font-weight: 700; text-transform: uppercase;
  padding: 4px 12px; border-radius: 20px;
}
.estado-disponible { background: #dcfce7; color: #166534; }
.estado-vendido    { background: #fee2e2; color: #991b1b; }
.estado-reservado  { background: #fef3c7; color: #92400e; }

/* Títulos */
.detail-title    { font-size: 1.8rem; font-weight: 800; color: #1e293b; line-height: 1.2; }
.detail-location { font-size: .9rem; color: #64748b; }
.detail-location svg { color: var(--landing-primary, #1e40af); }

/* Price big */
.detail-price-big { font-size: 2rem; font-weight: 800; color: #1e293b; line-height: 1; }

/* Stats grid */
.detail-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}
.detail-stat {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px 12px;
  display: flex; flex-direction: column;
  align-items: center; gap: 4px;
}
.detail-stat-icon { color: var(--landing-primary, #1e40af); opacity: .8; }
.detail-stat-val  { font-size: 1.25rem; font-weight: 800; color: #1e293b; line-height: 1; }
.detail-stat-val small { font-size: .65rem; font-weight: 500; margin-left: 1px; }
.detail-stat-lbl  { font-size: .65rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; text-align: center; }

/* Secciones */
.detail-section {}
.detail-section-title { font-size: 1.05rem; font-weight: 700; color: #1e293b; margin-bottom: 1rem; padding-bottom: .5rem; border-bottom: 2px solid #e2e8f0; }

/* Colindancias */
.colindancias-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
}
.colindancia-item {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 2px;
}
.colindancia-dir { font-size: .68rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
.colindancia-val { font-size: .88rem; font-weight: 600; color: #1e293b; }
.colindancia-extra { display: flex; align-items: center; gap: 4px; }
.text-indigo { color: #6366f1; }

/* Características */
.caracteristicas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.caracteristica-item {
  display: flex; align-items: center; gap: 8px;
  background: #f8fafc; border: 1px solid #e2e8f0;
  border-radius: 10px; padding: 10px 14px;
  font-size: .86rem; color: #374151;
}
.car-icon { color: var(--landing-primary, #1e40af); flex-shrink: 0; }

/* Mapa */
.map-wrap { border: 1px solid #e2e8f0; }

/* Sidebar */
.sidebar-card {
  background: #fff;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 2px 20px rgba(0,0,0,.08);
  border: 1px solid #e2e8f0;
}
.sidebar-btn {
  width: 100%;
  padding: 12px 18px;
  border-radius: 10px;
  font-weight: 600;
  font-size: .88rem;
  text-decoration: none;
  cursor: pointer;
  text-align: center;
  justify-content: center;
  align-items: center;
  border: none;
  transition: all .2s;
  display: flex;
}
.sidebar-btn-wa {
  background: #22c55e; color: #fff;
}
.sidebar-btn-wa:hover { background: #16a34a; color: #fff; }
.sidebar-btn-outline {
  background: #fff;
  color: #374151;
  border: 1.5px solid #d1d5db !important;
}
.sidebar-btn-outline:hover { border-color: var(--landing-primary, #1e40af) !important; color: var(--landing-primary, #1e40af); }

/* Ficha rápida */
.ficha-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.ficha-list li {
  display: flex; justify-content: space-between; align-items: center;
  font-size: .84rem;
  border-bottom: 1px dashed #e2e8f0;
  padding-bottom: 8px;
}
.ficha-list li:last-child { border-bottom: none; padding-bottom: 0; }
.ficha-list li span { color: #64748b; }
.ficha-estado { font-size: .75rem; padding: 2px 10px; border-radius: 20px; }

@media (max-width: 991px) {
  .gallery-main { height: 280px; }
  .detail-title { font-size: 1.4rem; }
  .detail-price-big { font-size: 1.6rem; }
}
</style>
