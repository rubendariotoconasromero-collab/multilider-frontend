<script setup>
import { apiOrigin } from '@/api/config'
import { useRouter } from 'vue-router'
import { MapPin, Maximize, Bed, Bath, Building2, Tag, Home, ArrowRight } from 'lucide-vue-next'

const props = defineProps({
  prop: { type: Object, required: true }
})

const router = useRouter()

const formatPrice = (price) => new Intl.NumberFormat('es-BO').format(price)

const estadoBadgeClass = (estado) => {
  if (estado === 'Disponible') return 'pc-badge-disponible'
  if (estado === 'Vendido')    return 'pc-badge-vendido'
  if (estado === 'Reservado')  return 'pc-badge-reservado'
  return 'pc-badge-disponible'
}

const mainImage = (prop) => {
  if (!prop.imagenes?.length) return null
  const principal = prop.imagenes.find(i => i.es_principal)
  return apiOrigin + (principal?.url || prop.imagenes[0]?.url)
}

const goToDetail = () => {
  router.push({ name: 'PropiedadDetalle', params: { id: props.prop.id } })
}
</script>

<template>
  <div class="pc-card h-100" @click="goToDetail" role="button">
    <!-- Imagen -->
    <div class="pc-img-wrap">
      <div v-if="!mainImage(prop)" class="pc-no-img d-flex flex-column align-items-center justify-content-center text-muted">
        <Home :size="44" class="opacity-25 mb-1" />
        <span class="small opacity-50">Sin imagen</span>
      </div>
      <img v-else :src="mainImage(prop)" class="pc-img" loading="lazy" :alt="`${prop.tipo} en ${prop.sector_urbano?.nombre}`">
      <div class="pc-img-overlay"></div>

      <!-- Badges top izquierda -->
      <div class="position-absolute top-0 start-0 p-3 d-flex flex-wrap gap-2">
        <span class="pc-badge pc-badge-tipo">{{ prop.tipo }}</span>
        <span v-if="prop.es_destacado" class="pc-badge pc-badge-featured">
          <i class="bi bi-star-fill me-1" style="font-size:10px"></i>Destacado
        </span>
      </div>

      <!-- Badge estado top derecha -->
      <div class="position-absolute top-0 end-0 p-3">
        <span :class="['pc-badge', estadoBadgeClass(prop.estado)]">{{ prop.estado }}</span>
      </div>

      <!-- Precio bottom -->
      <div class="position-absolute bottom-0 start-0 end-0 p-3">
        <div class="d-flex align-items-baseline gap-1">
          <span class="text-white-50" style="font-size:.85rem">{{ prop.moneda }}</span>
          <span class="pc-price">{{ formatPrice(prop.precio_venta) }}</span>
        </div>
      </div>
    </div>

    <!-- Contenido -->
    <div class="pc-body">
      <!-- Código + esquina -->
      <div class="d-flex align-items-center justify-content-between mb-1">
        <span class="pc-code"># {{ prop.codigo }}</span>
        <span v-if="prop.es_esquina && prop.tipo === 'Lote'" class="pc-esquina-tag">
          <i class="bi bi-signpost-2-fill me-1"></i>En esquina
        </span>
      </div>

      <!-- Título -->
      <h5 class="pc-title mb-2">{{ prop.tipo }} en {{ prop.sector_urbano?.nombre }}</h5>

      <!-- Ubicación -->
      <div class="d-flex align-items-center gap-1 pc-location mb-4">
        <MapPin :size="13" />
        <span>{{ prop.sector_urbano?.nombre }}{{ prop.sector_urbano?.distrito?.ciudad?.nombre ? ', ' + prop.sector_urbano.distrito.ciudad.nombre : '' }}</span>
      </div>

      <!-- Stats -->
      <div class="pc-stats mb-4">
        <div class="pc-stat">
          <Maximize :size="17" class="pc-stat-icon" />
          <span class="pc-stat-val">{{ prop.superficie_m2 }}<small>m²</small></span>
          <span class="pc-stat-lbl">Terreno</span>
        </div>

        <template v-if="prop.tipo === 'Casa'">
          <div class="pc-stat-div"></div>
          <div class="pc-stat" v-if="prop.superficie_construida_m2">
            <Building2 :size="17" class="pc-stat-icon" />
            <span class="pc-stat-val">{{ prop.superficie_construida_m2 }}<small>m²</small></span>
            <span class="pc-stat-lbl">Construido</span>
          </div>
          <div class="pc-stat-div"></div>
          <div class="pc-stat" v-if="prop.habitaciones">
            <Bed :size="17" class="pc-stat-icon" />
            <span class="pc-stat-val">{{ prop.habitaciones }}</span>
            <span class="pc-stat-lbl">Dorm.</span>
          </div>
          <div class="pc-stat-div"></div>
          <div class="pc-stat" v-if="prop.banos">
            <Bath :size="17" class="pc-stat-icon" />
            <span class="pc-stat-val">{{ prop.banos }}</span>
            <span class="pc-stat-lbl">Baños</span>
          </div>
        </template>
      </div>

      <!-- Características -->
      <div v-if="prop.caracteristicas?.length" class="d-flex flex-wrap gap-1 mb-4">
        <span v-for="car in prop.caracteristicas.slice(0, 3)" :key="car.id" class="pc-tag">
          <Tag :size="10" class="me-1" />{{ car.nombre }}
        </span>
        <span v-if="prop.caracteristicas.length > 3" class="pc-tag pc-tag-more">
          +{{ prop.caracteristicas.length - 3 }}
        </span>
      </div>

      <!-- Footer -->
      <div class="d-flex align-items-center justify-content-between pt-3 border-top">
        <span class="text-muted" style="font-size:.75rem">
          <i class="bi bi-clock me-1"></i>Disponible para visita
        </span>
        <button class="pc-cta" @click.stop="goToDetail">
          Ver propiedad <ArrowRight :size="14" class="ms-1" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Card */
.pc-card {
  background: var(--bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
  transition: transform .3s ease, box-shadow .3s ease;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border: 1px solid var(--border-color);
}
.pc-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0,0,0,.13);
}

[data-theme="dark"] .pc-card {
  box-shadow: 0 4px 20px rgba(0,0,0,.4);
}

/* Imagen */
.pc-img-wrap {
  position: relative;
  height: 230px;
  background: var(--bg-body);
  flex-shrink: 0;
  overflow: hidden;
}
.pc-img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform .6s ease;
}
.pc-card:hover .pc-img { transform: scale(1.07); }
.pc-no-img { width:100%; height:100%; background: var(--bg-body); }
.pc-img-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,.28) 0%, transparent 45%, rgba(0,0,0,.62) 100%);
  pointer-events: none;
}

/* Badges */
.pc-badge {
  display: inline-flex; align-items: center;
  font-size: .68rem; font-weight: 700;
  letter-spacing: .04em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 20px;
  backdrop-filter: blur(6px);
  white-space: nowrap;
}
.pc-badge-tipo       { background: var(--primary-color, #1e40af); color: #fff; }
.pc-badge-featured   { background: rgba(251,191,36,.9); color: #1a1a1a; }
.pc-badge-disponible { background: rgba(34,197,94,.9);  color: #fff; }
.pc-badge-vendido    { background: rgba(239,68,68,.9);  color: #fff; }
.pc-badge-reservado  { background: rgba(245,158,11,.9); color: #fff; }

/* Precio */
.pc-price { font-size: 1.4rem; font-weight: 800; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.4); }

/* Body */
.pc-body { padding: 1.1rem 1.25rem 1.25rem; display: flex; flex-direction: column; flex: 1; }

.pc-code { font-size: .7rem; font-weight: 700; color: var(--primary-color, #1e40af); letter-spacing: .06em; text-transform: uppercase; }
.pc-esquina-tag { font-size: .67rem; font-weight: 600; color: #6366f1; background: rgba(99, 102, 241, 0.1); padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(99, 102, 241, 0.3); }
.pc-title    { font-size: 1rem; font-weight: 700; color: var(--text-main); line-height: 1.3; }
.pc-location { font-size: .76rem; color: var(--text-muted); }
.pc-location svg { color: var(--primary-color, #1e40af); flex-shrink: 0; }

/* Stats */
.pc-stats { display: flex; align-items: stretch; background: var(--bg-body); border-radius: 10px; overflow: hidden; border: 1px solid var(--border-color); }
.pc-stat   { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 9px 5px; gap: 2px; }
.pc-stat-div { width: 1px; background: var(--border-color); flex-shrink: 0; }
.pc-stat-icon { color: var(--primary-color, #1e40af); opacity: .75; }
.pc-stat-val  { font-size: .9rem; font-weight: 700; color: var(--text-main); line-height: 1; }
.pc-stat-val small { font-size: .6rem; margin-left: 1px; }
.pc-stat-lbl  { font-size: .6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

/* Tags */
.pc-tag { display: inline-flex; align-items: center; font-size: .67rem; color: var(--text-main); background: var(--bg-body); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 20px; }
.pc-tag-more { color: var(--text-muted); }

/* CTA */
.pc-cta {
  display: inline-flex; align-items: center;
  font-size: .78rem; font-weight: 600;
  color: var(--primary-color, #1e40af);
  background: transparent;
  border: 1.5px solid var(--primary-color, #1e40af);
  border-radius: 8px; padding: 5px 12px;
  cursor: pointer; transition: all .2s;
  white-space: nowrap;
}
.pc-cta:hover { background: var(--primary-color, #1e40af); color: #fff; }

.border-top { border-top: 1px solid var(--border-color) !important; }
</style>
