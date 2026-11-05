<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompanyStore } from '@/stores/company'
import { Search, Filter, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import LandingHeader from '@/components/landing/LandingHeader.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
import WhatsAppButton from '@/components/landing/WhatsAppButton.vue'
import PropiedadCard from '@/components/landing/PropiedadCard.vue'

const route = useRoute()
const router = useRouter()
const companyStore = useCompanyStore()

const filters = ref({
  tipo: route.query.tipo || 'Todos',
  ciudad_id: route.query.ciudad_id || '',
  precio_min: route.query.precio_min || '',
  precio_max: route.query.precio_max || '',
  habitaciones: route.query.habitaciones || '',
  search: route.query.search || '',
  page: route.query.page || 1
})

const showFilters = ref(false)

const loadProperties = async () => {
  await companyStore.fetchProperties({
    tipo: filters.value.tipo,
    ciudad_id: filters.value.ciudad_id,
    precio_min: filters.value.precio_min,
    precio_max: filters.value.precio_max,
    habitaciones: filters.value.habitaciones,
    search: filters.value.search,
    page: filters.value.page,
    per_page: 12
  })
}

const applyFilters = () => {
  filters.value.page = 1
  updateQuery()
}

const updateQuery = () => {
  const query = { ...filters.value }
  // Limpiar vacíos
  Object.keys(query).forEach(key => {
    if (query[key] === '' || query[key] === 'Todos') delete query[key]
  })
  router.push({ name: 'PropiedadesLanding', query })
}

const changePage = (page) => {
  filters.value.page = page
  updateQuery()
}

const resetFilters = () => {
  filters.value = {
    tipo: 'Todos',
    ciudad_id: '',
    precio_min: '',
    precio_max: '',
    habitaciones: '',
    search: '',
    page: 1
  }
  updateQuery()
}

onMounted(async () => {
  companyStore.loading = true // Forzar carga desde el inicio para evitar "No hay resultados"
  if (!companyStore.company) await companyStore.fetchCompany()
  await companyStore.fetchCities()
})

// Centralizar la carga en el watcher para evitar doble petición (onMounted + watch)
watch(() => route.query, () => {
  filters.value = {
    tipo: route.query.tipo || 'Todos',
    ciudad_id: route.query.ciudad_id || '',
    precio_min: route.query.precio_min || '',
    precio_max: route.query.precio_max || '',
    habitaciones: route.query.habitaciones || '',
    search: route.query.search || '',
    page: route.query.page || 1
  }
  loadProperties()
}, { immediate: true })

</script>

<template>
  <div class="landing-page min-vh-100 d-flex flex-column">
    <LandingHeader :transparentAtTop="false" />

    <!-- Hero Section para la vista de listado -->
    <section class="propiedades-hero pb-5" style="padding-top: 100px;">
      <div class="container mt-4">
        <div class="row align-items-center">
          <div class="col-lg-8">
            <h1 class="display-5 fw-bold text-white mb-2">Encuentra tu próximo <span>Hogar</span></h1>
            <p class="lead text-white-50 mb-3">Explora nuestro catálogo completo de lotes y casas disponibles.</p>
            <div class="d-flex flex-wrap gap-3 mt-2">
              <div class="hero-stat">
                <span class="hero-stat-number">{{ companyStore.pagination?.totalItems || 0 }}</span>
                <span class="hero-stat-label">Propiedades</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-number">{{ companyStore.cities.length }}</span>
                <span class="hero-stat-label">Ciudades</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <main class="flex-grow-1 py-5">
      <div class="container">
        <div class="row g-4">
          
          <!-- Filtros Desktop -->
          <div class="col-lg-3 d-none d-lg-block">
            <div class="card border-0 shadow-sm rounded-4 p-4 sticky-top filter-card" style="top: 100px;">
              <div class="d-flex align-items-center justify-content-between mb-4">
                <h5 class="fw-bold mb-0">Filtros</h5>
                <button @click="resetFilters" class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1">
                  <i class="bi bi-trash3 me-1"></i> Limpiar
                </button>
              </div>

              <div class="mb-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Búsqueda</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text border-0"><Search :size="14" /></span>
                  <input type="text" v-model="filters.search" @keyup.enter="applyFilters" class="form-control border-0" placeholder="Código o sector...">
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Tipo de Inmueble</label>
                <select v-model="filters.tipo" @change="applyFilters" class="form-select form-select-sm border-0 shadow-none">
                  <option value="Todos">Todos los tipos</option>
                  <option value="Lote">Lotes de Terreno</option>
                  <option value="Casa">Casas Residenciales</option>
                </select>
              </div>

              <div class="mb-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Ciudad</label>
                <select v-model="filters.ciudad_id" @change="applyFilters" class="form-select form-select-sm border-0 shadow-none">
                  <option value="">Todas las ciudades</option>
                  <option v-for="ciudad in companyStore.cities" :key="ciudad.id" :value="ciudad.id">
                    {{ ciudad.nombre }}
                  </option>
                </select>
              </div>

              <div class="mb-4">
                <label class="form-label small fw-bold text-muted text-uppercase">Rango de Precio ($)</label>
                <div class="row g-2">
                  <div class="col-6">
                    <input type="number" v-model="filters.precio_min" @keyup.enter="applyFilters" class="form-control form-control-sm border-0" placeholder="Min">
                  </div>
                  <div class="col-6">
                    <input type="number" v-model="filters.precio_max" @keyup.enter="applyFilters" class="form-control form-control-sm border-0" placeholder="Max">
                  </div>
                </div>
              </div>

              <div class="mb-4" v-if="filters.tipo === 'Casa'">
                <label class="form-label small fw-bold text-muted text-uppercase">Habitaciones (+)</label>
                <div class="d-flex gap-2">
                  <button 
                    v-for="n in [1, 2, 3, 4]" 
                    :key="n"
                    @click="filters.habitaciones = n; applyFilters()"
                    :class="['btn btn-sm flex-grow-1 border-0 transition-all', filters.habitaciones == n ? 'btn-landing btn-landing-primary shadow-sm' : 'bg-light-soft text-muted']"
                  >
                    {{ n }}+
                  </button>
                </div>
              </div>

              <button @click="applyFilters" class="btn-landing btn-landing-primary w-100 py-2 rounded-3 mt-2 fw-bold btn d-flex align-items-center justify-content-center gap-2">
                Aplicar Filtros
              </button>
            </div>
          </div>

          <!-- Botón Filtros Mobile -->
          <div class="col-12 d-lg-none mb-3">
            <button @click="showFilters = true" class="btn btn-filter-mobile w-100 shadow-sm border-0 py-3 rounded-4 d-flex align-items-center justify-content-center gap-2">
              <Filter :size="18" /> Filtrar y Buscar
            </button>
          </div>

          <!-- Listado de Propiedades -->
          <div class="col-lg-9">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <p class="text-theme-muted mb-0">
                Se encontraron <span class="fw-bold text-main-landing">{{ companyStore.pagination?.totalItems || 0 }}</span> propiedades
              </p>
            </div>

            <!-- Loading State -->
            <div v-if="companyStore.loading" class="row g-4">
              <div v-for="i in 6" :key="i" class="col-md-6">
                <div class="card-loading rounded-4 overflow-hidden shadow-sm">
                  <div class="skeleton-box w-100" style="height:230px"></div>
                  <div class="p-4">
                    <div class="skeleton-box w-25 mb-2" style="height:12px"></div>
                    <div class="skeleton-box w-75 mb-3" style="height:20px"></div>
                    <div class="skeleton-box w-60 mb-4" style="height:14px"></div>
                    <div class="d-flex gap-2 mb-3">
                      <div class="skeleton-box flex-grow-1" style="height:54px"></div>
                      <div class="skeleton-box flex-grow-1" style="height:54px"></div>
                      <div class="skeleton-box flex-grow-1" style="height:54px"></div>
                    </div>
                    <div class="skeleton-box w-50" style="height:12px"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="companyStore.allProperties.length === 0" class="text-center py-5">
              <div class="empty-state-card rounded-5 p-5 shadow-sm">
                <i class="bi bi-search display-1 text-muted opacity-25 d-block mb-4"></i>
                <h3 class="fw-bold">No hay resultados</h3>
                <p class="text-muted">Intenta ajustando tus filtros de búsqueda.</p>
                <button @click="resetFilters" class="btn-landing btn-landing-primary px-4 mt-2">Ver todo el catálogo</button>
              </div>
            </div>

            <!-- Grid de propiedades -->
            <div v-else class="row g-4">
              <div v-for="prop in companyStore.allProperties" :key="prop.id" class="col-md-6">
                <PropiedadCard :prop="prop" />
              </div>
            </div>

            <!-- Paginación -->
            <div v-if="companyStore.pagination?.totalPages > 1" class="d-flex justify-content-center mt-5">
              <nav>
                <ul class="pagination gap-2 border-0">
                  <li class="page-item" :class="{ disabled: companyStore.pagination.currentPage === 1 }">
                    <button @click="changePage(companyStore.pagination.currentPage - 1)" class="page-link rounded-circle border-0 shadow-sm d-flex align-items-center justify-content-center pagination-btn" style="width: 45px; height: 45px;">
                      <ChevronLeft :size="20" />
                    </button>
                  </li>
                  <li v-for="p in companyStore.pagination.totalPages" :key="p" class="page-item">
                    <button 
                      @click="changePage(p)" 
                      :class="['page-link rounded-circle border-0 shadow-sm d-flex align-items-center justify-content-center pagination-btn', companyStore.pagination.currentPage === p ? 'active' : '']"
                      style="width: 45px; height: 45px;"
                    >
                      {{ p }}
                    </button>
                  </li>
                  <li class="page-item" :class="{ disabled: companyStore.pagination.currentPage === companyStore.pagination.totalPages }">
                    <button @click="changePage(companyStore.pagination.currentPage + 1)" class="page-link rounded-circle border-0 shadow-sm d-flex align-items-center justify-content-center pagination-btn" style="width: 45px; height: 45px;">
                      <ChevronRight :size="20" />
                    </button>
                  </li>
                </ul>
              </nav>
            </div>

          </div>
        </div>
      </div>
    </main>


    <!-- Modal Filtros Mobile -->
    <div v-if="showFilters" class="mobile-filters-overlay animate__animated animate__fadeIn">
      <div class="mobile-filters-content p-4 animate__animated animate__slideInUp">
        <div class="d-flex align-items-center justify-content-between mb-4">
          <h5 class="fw-bold mb-0 title-mobile">Filtros de Búsqueda</h5>
          <button @click="showFilters = false" class="btn btn-close-mobile rounded-circle p-2"><X :size="20" /></button>
        </div>

        <div class="mb-4">
          <label class="form-label small fw-bold text-muted text-uppercase">Búsqueda</label>
          <input type="text" v-model="filters.search" class="form-control bg-light-soft border-0 py-3 rounded-3" placeholder="Código o sector...">
        </div>

        <div class="mb-4">
          <label class="form-label small fw-bold text-muted text-uppercase">Tipo de Inmueble</label>
          <div class="d-flex gap-2">
            <button 
              v-for="t in ['Todos', 'Lote', 'Casa']" 
              :key="t"
              @click="filters.tipo = t"
              :class="['btn flex-grow-1 border-0 py-3 rounded-3 transition-all', filters.tipo === t ? 'btn-landing btn-landing-primary shadow' : 'bg-light-soft text-muted']"
            >
              {{ t === 'Todos' ? 'Todos' : t }}
            </button>
          </div>
        </div>

        <div class="mb-4" v-if="filters.tipo === 'Casa'">
          <label class="form-label small fw-bold text-muted text-uppercase">Habitaciones (+)</label>
          <div class="d-flex gap-2">
            <button 
              v-for="n in [1, 2, 3, 4]" 
              :key="n"
              @click="filters.habitaciones = n"
              :class="['btn flex-grow-1 border-0 py-3 rounded-3 transition-all', filters.habitaciones == n ? 'btn-landing btn-landing-primary shadow' : 'bg-light-soft text-muted']"
            >
              {{ n }}+
            </button>
          </div>
        </div>

        <div class="mb-4">
          <label class="form-label small fw-bold text-muted text-uppercase">Ciudad</label>
          <select v-model="filters.ciudad_id" class="form-select bg-light-soft border-0 py-3 rounded-3 shadow-none">
            <option value="">Todas las ciudades</option>
            <option v-for="ciudad in companyStore.cities" :key="ciudad.id" :value="ciudad.id">
              {{ ciudad.nombre }}
            </option>
          </select>
        </div>

        <div class="mb-4">
          <label class="form-label small fw-bold text-muted text-uppercase">Rango de Precio ($)</label>
          <div class="row g-2">
            <div class="col-6">
              <input type="number" v-model="filters.precio_min" class="form-control bg-light-soft border-0 py-3 rounded-3" placeholder="Mínimo">
            </div>
            <div class="col-6">
              <input type="number" v-model="filters.precio_max" class="form-control bg-light-soft border-0 py-3 rounded-3" placeholder="Máximo">
            </div>
          </div>
        </div>

        <div class="d-grid gap-2 mt-5 pt-4">
          <button @click="applyFilters(); showFilters = false" class="btn-landing btn-landing-primary py-3 rounded-3 shadow fw-bold">
            <i class="bi bi-check2-circle me-1"></i> Mostrar Resultados
          </button>
          <button @click="resetFilters(); showFilters = false" class="btn btn-link text-danger py-2 text-decoration-none fw-medium">
            <i class="bi bi-trash3 me-1"></i> Limpiar todos los filtros
          </button>
        </div>
      </div>
    </div>

    <LandingFooter />
    <WhatsAppButton />
  </div>
</template>

<style scoped>
/* ── Hero ───────────────────────────────────── */
.propiedades-hero {
  background: linear-gradient(135deg, #020617 0%, #1e40af 100%);
  position: relative;
  overflow: hidden;
}

[data-theme="dark"] .propiedades-hero {
  background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
  border-bottom: 1px solid var(--border-color);
}
.propiedades-hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 70% 50%, rgba(37, 99, 235, 0.2) 0%, transparent 70%);
  pointer-events: none;
}
.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px;
  padding: 10px 20px;
  min-width: 90px;
}
.hero-stat-number { font-size: 1.5rem; font-weight: 700; color: #fff; line-height: 1; }
.hero-stat-label  { font-size: 0.72rem; color: rgba(255,255,255,0.6); margin-top: 2px; text-transform: uppercase; letter-spacing: .05em; }

/* ── Dark Mode & Theme Colors ───────────────── */
.landing-page {
  background-color: var(--bg-body);
}

.filter-card {
  background-color: var(--bg-card);
}

.filter-card h5 {
  color: var(--text-main);
}

.input-group-text, 
.form-control, 
.form-select {
  background-color: #f8fafc;
  color: #1e293b;
}

[data-theme="dark"] .input-group-text, 
[data-theme="dark"] .form-control, 
[data-theme="dark"] .form-select {
  background-color: #1e293b;
  color: #f1f5f9;
}

[data-theme="dark"] .bg-light-soft {
  background-color: #1e293b !important;
}

.bg-light-soft {
  background-color: #f1f5f9;
}

.text-theme-muted {
  color: #64748b;
}

[data-theme="dark"] .text-theme-muted {
  color: #94a3b8;
}

.text-main-landing {
  color: var(--text-main);
}

.card-loading, .empty-state-card {
  background-color: var(--bg-card);
}

.btn-filter-mobile {
  background-color: var(--bg-card);
  color: var(--text-main);
}

/* ── Mobile filters ─────────────────────────── */
.mobile-filters-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
}
.mobile-filters-content {
  width: 100%;
  background: var(--bg-card);
  border-radius: 30px 30px 0 0;
  max-height: 90vh;
  overflow-y: auto;
}

.title-mobile {
  color: var(--text-main);
}

.btn-close-mobile {
  background-color: var(--bg-body);
  color: var(--text-main);
}

/* ── Pagination ─────────────────────────────── */
.pagination-btn {
  background-color: var(--bg-card) !important;
  color: var(--text-muted) !important;
  transition: all 0.3s;
}

.pagination-btn:hover {
  background-color: var(--bg-body) !important;
  color: var(--primary-color) !important;
}

.pagination-btn.active {
  background-color: var(--primary-color) !important;
  color: white !important;
}

[data-theme="dark"] .skeleton-box {
  background: #1e293b;
  background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
  background-size: 200% 100%;
}
</style>

