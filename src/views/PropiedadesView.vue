<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import api from '../api/axios'
import Swal from 'sweetalert2'
import LiveSearchSelect from '../components/LiveSearchSelect.vue'
import LiveSearchMultiSelect from '../components/LiveSearchMultiSelect.vue'
import ImagenPropiedadManager from '../components/ImagenPropiedadManager.vue'
import { validarPropiedad, mensajeErrorPropiedad } from '../utils/propiedadValidation'

// --- ESTADO GENERAL Y DATOS ---
const propiedades = ref([])
const propietarios = ref([])
const distritos = ref([])
const sectoresUrbanos = ref([])
const allCaracteristicas = ref([])
const cargando = ref(true)
const guardando = ref(false)

// Paginación y Búsqueda
const searchQuery = ref('')
const currentPage = ref(1)
const totalPages = ref(1)

// --- VARIABLES DE VISTA ---
const viewMode = ref('list') // 'list', 'form', 'detail', 'characteristics', 'images'
const isEditing = ref(false)
const btnCerrarModal = ref(null) // Mantener referencia para compatibilidad o eliminar
const erroresValidacion = ref({})
const propiedadSeleccionada = ref(null)

const baseUrl = import.meta.env.VITE_API_URL

// Para gestión de características
const caracSearch = ref('')
const cargandoCarac = ref(false)
const caracAgrupadas = computed(() => {
  const query = caracSearch.value.toLowerCase()
  const filtered = allCaracteristicas.value.filter(c => c.nombre.toLowerCase().includes(query))
  
  return filtered.reduce((groups, item) => {
    const group = item.tipo || 'Otras'
    if (!groups[group]) groups[group] = []
    groups[group].push(item)
    return groups
  }, {})
})

const propietariosParaSelector = computed(() =>
  propietarios.value.map(p => ({
    ...p,
    display_label: p.tipo === 'empresa' ? (p.nombre_empresa || p.nombre_completo) : p.nombre_completo,
    display_sub:   p.tipo === 'empresa' ? `Empresa · ${p.nombre_completo}` : (p.ci ? `CI: ${p.ci}` : ''),
  }))
)

// --- FORMULARIOS ---
const propiedadForm = ref({
  id: null, propietario_ids: [], sector_urbano_id: '', ubicacion_id: null,
  tipo: 'Lote', codigo: '', precio_venta: '', moneda: 'BOB',
  superficie_m2: '', superficie_construida_m2: '',
  frente_mts: '', fondo_mts: '', habitaciones: 0, banos: 0,
  es_esquina: false, direccion: '', nro_lote: '',
  colinda_norte: '', colinda_sur: '', colinda_este: '', colinda_oeste: '',
  estado: 'Disponible', activo: true
})

// Para el selector en cascada en el formulario
const formDistritoId = ref('')
const targetSectorId = ref(null) // sector a restaurar tras cargar edición

const ubicacionForm = ref({
  id: null, referencia: '', url_maps: '', latitud: '', longitud: ''
})

// --- CONFIGURACIÓN DEL MAPA (Google Maps o Leaflet según .env) ---
const MAP_PROVIDER        = import.meta.env.VITE_MAP_PROVIDER || 'leaflet'
const GOOGLE_MAPS_API_KEY = 'AIzaSyCaAjmxE-Aub9ty9q_-jcN1RULUSDa9XXY'
const DEF_LAT = -17.3411
const DEF_LNG = -63.2514

const mapDiv = ref(null)
let map    = null
let marker = null
let googleMapsLoaded = false

// ── Leaflet (lazy import) ──────────────────────────────────────────────────────
let L = null
const loadLeaflet = async () => {
  if (L) return
  const mod = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  L = mod.default ?? mod
  // Corrige el problema de íconos de Leaflet en Vite
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// ── Inicializar mapa ─────────────────────────────────────────────────────────
const initMap = async (lat = DEF_LAT, lng = DEF_LNG) => {
  if (!mapDiv.value) return
  const lat_num = parseFloat(lat) || DEF_LAT
  const lng_num = parseFloat(lng) || DEF_LNG
  MAP_PROVIDER === 'google'
    ? await _initGoogle(lat_num, lng_num)
    : await _initLeaflet(lat_num, lng_num)
}

const _initGoogle = async (lat_num, lng_num) => {
  try {
    if (!googleMapsLoaded) {
      setOptions({ apiKey: GOOGLE_MAPS_API_KEY, version: 'weekly' })
      await importLibrary('maps')
      googleMapsLoaded = true
    }
    const center = { lat: lat_num, lng: lng_num }
    if (map && marker) {
      map.setCenter(center); marker.setPosition(center); return
    }
    map = new window.google.maps.Map(mapDiv.value, { center, zoom: 16, mapTypeControl: false })
    marker = new window.google.maps.Marker({ position: center, map, draggable: true, title: 'Ubicación' })
    marker.addListener('dragend', () => {
      const p = marker.getPosition(); updateCoordsInputs(p.lat(), p.lng())
    })
    map.addListener('click', (e) => {
      marker.setPosition(e.latLng); updateCoordsInputs(e.latLng.lat(), e.latLng.lng())
    })
  } catch (e) { console.error('Error Google Maps:', e) }
}

const _initLeaflet = async (lat_num, lng_num) => {
  try {
    await loadLeaflet()
    if (map && marker) {
      map.setView([lat_num, lng_num]); marker.setLatLng([lat_num, lng_num]); return
    }
    map = L.map(mapDiv.value).setView([lat_num, lng_num], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    marker = L.marker([lat_num, lng_num], { draggable: true }).addTo(map)
    marker.on('dragend', () => {
      const p = marker.getLatLng(); updateCoordsInputs(p.lat, p.lng)
    })
    map.on('click', (e) => {
      marker.setLatLng(e.latlng); updateCoordsInputs(e.latlng.lat, e.latlng.lng)
    })
  } catch (e) { console.error('Error Leaflet:', e) }
}

const updateCoordsInputs = (lat, lng) => {
  const latitude  = Number(lat).toFixed(7)
  const longitude = Number(lng).toFixed(7)
  ubicacionForm.value.latitud  = latitude
  ubicacionForm.value.longitud = longitude
  ubicacionForm.value.url_maps = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

// ── Modal: cargar desde URL de Google Maps ────────────────────────────────────
const modalUrlVisible = ref(false)
const urlMapsInput    = ref('')
const urlMapsError    = ref('')

const parsearUrlGoogleMaps = (url) => {
  const atMatch    = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (atMatch)    return { lat: parseFloat(atMatch[1]),    lng: parseFloat(atMatch[2]) }
  const qrMatch   = url.match(/[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (qrMatch)    return { lat: parseFloat(qrMatch[1]),    lng: parseFloat(qrMatch[2]) }
  const qMatch    = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (qMatch)     return { lat: parseFloat(qMatch[1]),     lng: parseFloat(qMatch[2]) }
  const llMatch   = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (llMatch)    return { lat: parseFloat(llMatch[1]),    lng: parseFloat(llMatch[2]) }
  return null
}

const resolviendoUrl = ref(false)

const abrirModalUrl = () => { urlMapsInput.value = ''; urlMapsError.value = ''; modalUrlVisible.value = true }

const _aplicarCoordenadas = (lat, lng) => {
  updateCoordsInputs(lat, lng)
  if (map && marker) {
    if (MAP_PROVIDER === 'leaflet') {
      map.setView([lat, lng], 17)
      marker.setLatLng([lat, lng])
    } else {
      const c = { lat, lng }
      map.setCenter(c); map.setZoom(17); marker.setPosition(c)
    }
  }
  modalUrlVisible.value = false
}

const procesarUrlMaps = async () => {
  urlMapsError.value = ''
  const url = urlMapsInput.value.trim()
  if (!url) return

  // Intentar parseo directo primero (URL completa del navegador)
  const coords = parsearUrlGoogleMaps(url)
  if (coords) { _aplicarCoordenadas(coords.lat, coords.lng); return }

  // URL acortada → resolver en el backend
  resolviendoUrl.value = true
  try {
    const res = await api.get('/resolver-url-mapa', { params: { url } })
    _aplicarCoordenadas(res.data.lat, res.data.lng)
  } catch (e) {
    urlMapsError.value = e.response?.data?.error
      || 'No se pudo resolver la URL. Intentá pegar la URL completa del navegador.'
  } finally {
    resolviendoUrl.value = false
  }
}

// ==========================================
// 1. CARGA BASE
// ==========================================
const cargarSectoresPorDistrito = async (distritoId) => {
  if (!distritoId) { sectoresUrbanos.value = []; return }
  try {
    const res = await api.get(`/sectores-urbanos/por-distrito/${distritoId}`)
    sectoresUrbanos.value = res.data
  } catch (error) {
    console.error('Error al cargar sectores:', error)
    sectoresUrbanos.value = []
  }
}

watch(formDistritoId, async (newVal) => {
  const savedId = targetSectorId.value
  targetSectorId.value = null
  if (!savedId) propiedadForm.value.sector_urbano_id = ''
  await cargarSectoresPorDistrito(newVal)
  if (savedId) propiedadForm.value.sector_urbano_id = savedId
})

const cargarDatosBase = async (page = 1) => {
  try {
    cargando.value = true;

    const [resProp, resOwn, resDist] = await Promise.all([
      api.get(`/propiedades?page=${page}&search=${searchQuery.value}`),
      api.get('/propietarios?per_page=1000'),
      api.get('/distritos?per_page=1000')
    ]);

    propiedades.value = resProp.data.data;
    currentPage.value = resProp.data.current_page;
    totalPages.value = resProp.data.last_page;

    propietarios.value = resOwn.data.data.filter(p => p.estado == 1 || p.estado === true);
    distritos.value = resDist.data.data.filter(d => d.estado == 1 || d.estado === true);

  } catch (error) {
    console.error("Detalle del error en JS:", error);
    Swal.fire('Error', 'No se pudieron procesar los datos', 'error');
  } finally {
    cargando.value = false;
  }
}

const buscar = () => cargarDatosBase(1)
const limpiarBusqueda = () => { searchQuery.value = ''; buscar() }

const paginasVisibles = computed(() => {
  let pages = []
  const maxVisible = 5 
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = start + maxVisible - 1

  if (end > totalPages.value) {
    end = totalPages.value
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// ==========================================
// 2. NAVEGACIÓN Y PREPARAR DATOS
// ==========================================
const irFormulario = (prop = null) => {
  erroresValidacion.value = {};
  if (prop) {
    isEditing.value = true;
    
    // Solo extraemos los campos necesarios para el formulario, 
    // evitando enviar objetos de relaciones (como caracteristicas o imagenes) que causan errores de validación.
    propiedadForm.value = {
      id: prop.id,
      propietario_ids: prop.propietarios?.map(p => p.id) ?? [],
      sector_urbano_id: prop.sector_urbano_id || '',
      ubicacion_id: prop.ubicacion_id,
      tipo: prop.tipo || 'Lote',
      codigo: prop.codigo || '',
      precio_venta: prop.precio_venta || '',
      moneda: prop.moneda || 'USD',
      superficie_m2: prop.superficie_m2 || '',
      superficie_construida_m2: prop.superficie_construida_m2 || '',
      frente_mts: prop.frente_mts || '',
      fondo_mts: prop.fondo_mts || '',
      habitaciones: prop.habitaciones || 0,
      banos: prop.banos || 0,
      es_esquina: prop.es_esquina == 1 || prop.es_esquina === true,
      direccion: prop.direccion || '',
      nro_lote: prop.nro_lote || '',
      colinda_norte: prop.colinda_norte || '',
      colinda_sur: prop.colinda_sur || '',
      colinda_este: prop.colinda_este || '',
      colinda_oeste: prop.colinda_oeste || '',
      estado: prop.estado || 'Disponible',
      activo: prop.activo == 1 || prop.activo === true
    };

    // Pre-cargar el distrito del sector para el selector en cascada
    const distritoId = prop.sector_urbano?.distrito_id || ''
    targetSectorId.value = prop.sector_urbano_id || null
    formDistritoId.value = distritoId // dispara el watcher, que restaura sector tras cargar
    if (prop.ubicacion) ubicacionForm.value = { ...prop.ubicacion };
    else resetUbicacionForm();
  } else {
    isEditing.value = false;
    formDistritoId.value = '';
    sectoresUrbanos.value = [];
    resetPropiedadForm();
    resetUbicacionForm();
  }

  viewMode.value = 'form';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  nextTick(() => {
    initMap(ubicacionForm.value.latitud, ubicacionForm.value.longitud);
  });
}

const irDetalle = (prop) => {
  propiedadSeleccionada.value = prop;
  viewMode.value = 'detail';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const irGestionCaracteristicas = async (prop) => {
  propiedadSeleccionada.value = prop;
  cargandoCarac.value = true;
  viewMode.value = 'characteristics';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    // 1. Cargar catálogo de características si no está cargado
    if (allCaracteristicas.value.length === 0) {
      const res = await api.get('/caracteristicas', { params: { per_page: 1000 } });
      allCaracteristicas.value = res.data.data;
    }

    // 2. Marcar las que ya tiene la propiedad
    const idsAsignados = prop.caracteristicas?.map(c => c.id) || [];
    allCaracteristicas.value.forEach(c => {
      c.asignado = idsAsignados.includes(c.id);
    });

  } catch (error) {
    console.error("Error al cargar gestión:", error);
  } finally {
    cargandoCarac.value = false;
  }
}

const irGestionImagenes = (prop) => {
  propiedadSeleccionada.value = prop;
  viewMode.value = 'images';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const recargarPropiedad = async () => {
  if (!propiedadSeleccionada.value) return
  try {
    const res = await api.get(`/propiedades/${propiedadSeleccionada.value.id}`)
    // El backend puede devolver el objeto directo o envuelto en 'data'
    const propActualizada = res.data.data || res.data
    
    if (!propActualizada || !propActualizada.id) {
      throw new Error("No se pudo obtener la información actualizada de la propiedad")
    }

    propiedadSeleccionada.value = propActualizada
    
    // También actualizar en la lista principal si existe
    const index = propiedades.value.findIndex(p => p.id === propActualizada.id)
    if (index !== -1) {
      propiedades.value[index] = propActualizada
    }
  } catch (error) {
    console.error("Error al recargar propiedad:", error)
  }
}

const toggleCaracteristica = (carac) => {
  carac.asignado = !carac.asignado;
}

const guardarCaracteristicas = async () => {
  guardando.value = true;
  try {
    const ids = allCaracteristicas.value.filter(c => c.asignado).map(c => c.id);
    
    // Según contexto_api_caracteristicas: Se deben enviar los IDs para sincronizarlos
    // Usamos el endpoint de actualización de propiedad enviando solo los carac_ids si el backend lo soporta, 
    // o el objeto completo. Basado en el estándar de otros módulos, enviaremos al sync.
    await api.post(`/propiedades/${propiedadSeleccionada.value.id}/caracteristicas/sync`, {
      caracteristica_ids: ids
    });

    await cargarDatosBase(currentPage.value);
    volverListado();
    Swal.fire({ icon: 'success', title: 'Características sincronizadas', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
  } catch (error) {
    Swal.fire('Error', 'No se pudieron guardar las características', 'error');
  } finally {
    guardando.value = false;
  }
}

const volverListado = () => {
  viewMode.value = 'list'
  propiedadSeleccionada.value = null
  resetPropiedadForm()
  if (map && MAP_PROVIDER === 'leaflet') map.remove()
  map = null
  marker = null
}

const resetPropiedadForm = () => {
  propiedadForm.value = {
    id: null, propietario_ids: [], sector_urbano_id: '', ubicacion_id: null, tipo: 'Lote', codigo: '',
    precio_venta: '', moneda: 'BOB', superficie_m2: '', superficie_construida_m2: '',
    frente_mts: '', fondo_mts: '', habitaciones: 0, banos: 0, es_esquina: false,
    direccion: '', colinda_norte: '', colinda_sur: '', colinda_este: '',
    colinda_oeste: '', nro_lote: '', estado: 'Disponible', activo: true
  };
}

// Watcher para limpiar campos específicos si cambia a Lote
watch(() => propiedadForm.value.tipo, (newTipo) => {
  if (newTipo === 'Lote') {
    propiedadForm.value.superficie_construida_m2 = '';
    propiedadForm.value.habitaciones = 0;
    propiedadForm.value.banos = 0;
  }
})

// Cálculo automático de superficie (Frente x Fondo)
watch([() => propiedadForm.value.frente_mts, () => propiedadForm.value.fondo_mts], ([frente, fondo]) => {
  if (frente && fondo && frente > 0 && fondo > 0) {
    const total = parseFloat(frente) * parseFloat(fondo);
    // Solo actualizamos si el resultado es un número válido
    if (!isNaN(total)) {
      propiedadForm.value.superficie_m2 = Number(total.toFixed(2));
    }
  }
})

const resetUbicacionForm = () => {
  const defLat = -17.3411;
  const defLong = -63.2514;
  const defUrl = `https://www.google.com/maps/search/?api=1&query=${defLat},${defLong}`;
  
  ubicacionForm.value = { 
    id: null, referencia: '', url_maps: defUrl, latitud: defLat, longitud: defLong 
  };
}

// ==========================================
// 3. GUARDAR PROPIEDAD
// ==========================================
const guardar = async () => {
  if (guardando.value) return;
  erroresValidacion.value = validarPropiedad(propiedadForm.value);
  if (Object.keys(erroresValidacion.value).length) {
    await Swal.fire('Revisa el formulario', Object.values(erroresValidacion.value).flat().join('\n'), 'warning');
    return;
  }
  guardando.value = true;
  erroresValidacion.value = {};
  try {
    let ubiId = propiedadForm.value.ubicacion_id;
    const resUbi = ubiId 
      ? await api.put(`/ubicaciones/${ubiId}`, ubicacionForm.value)
      : await api.post('/ubicaciones', ubicacionForm.value);
    
    if (!ubiId) propiedadForm.value.ubicacion_id = resUbi.data.data.id;

    if (isEditing.value) await api.put(`/propiedades/${propiedadForm.value.id}`, propiedadForm.value);
    else await api.post('/propiedades', propiedadForm.value);

    await cargarDatosBase(currentPage.value);
    volverListado();
    Swal.fire({ icon: 'success', title: 'Guardado', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
  } catch (error) {
    if (error.response?.status === 422) erroresValidacion.value = error.response.data.errors;
    Swal.fire('No se pudo guardar', mensajeErrorPropiedad(error), 'error');
  } finally {
    guardando.value = false;
  }
}

// ==========================================
// 4. ACTIVAR / DESACTIVAR
// ==========================================
const toggleActivo = async (prop) => {
  const isActivo = prop.activo == 1 || prop.activo === true;
  const accionTxt = isActivo ? 'Ocultar' : 'Publicar';
  
  Swal.fire({
    title: `¿${accionTxt} del Catálogo?`, text: "Cambiará la visibilidad de la propiedad.", icon: isActivo ? 'warning' : 'info',
    showCancelButton: true, confirmButtonColor: isActivo ? '#fb7185' : '#a28bfa', cancelButtonColor: '#9ca3af',
    confirmButtonText: `Sí, ${accionTxt.toLowerCase()}`, cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await api.delete(`/propiedades/${prop.id}`);
        await cargarDatosBase(currentPage.value);
        Swal.fire({ title: `¡Éxito!`, icon: 'success', showConfirmButton: false, timer: 1500 });
      } catch (error) {
        Swal.fire('Error', 'No se pudo cambiar el estado', 'error');
      }
    }
  })
}

onMounted(() => cargarDatosBase(1));
</script>

<template>
  <div class="container-fluid py-4 pb-5">
    
    <!-- SECCIÓN 1: LISTADO PRINCIPAL -->
    <div v-if="viewMode === 'list'">
      <div class="row align-items-center mb-4">
        <div class="col-md-5 mb-3 mb-md-0">
          <h2 class="h4 fw-bold mb-0" style="color: var(--text-main);">Catálogo de Propiedades</h2>
          <p class="text-muted small mb-0">Gestión de inventario y ubicación geográfica</p>
        </div>
        
        <div class="col-md-7 d-flex justify-content-md-end gap-2">
          <div class="input-group" style="max-width: 480px;">
            <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
            <input type="text" class="form-control border-start-0 border-end-0 ps-0 shadow-none" 
                   v-model="searchQuery" @keyup.enter="buscar" placeholder="Buscar por Código o Dueño...">
            <span class="input-group-text bg-white border-start-0 cursor-pointer" v-if="searchQuery" @click="limpiarBusqueda" title="Limpiar">
              <i class="bi bi-x-circle-fill text-muted hover-danger transition-all"></i>
            </span>
            <span class="input-group-text bg-white border-start-0" v-else></span>
            <button class="btn btn-secondary shadow-none px-3" @click="buscar" type="button">Buscar</button>
          </div>
          
          <button class="btn btn-primary d-flex align-items-center gap-2 shadow-sm border-0 px-3" 
                  style="background-color: var(--primary-color);" 
                  @click="irFormulario()">
            <i class="bi bi-plus-lg"></i> Nueva
          </button>
        </div>
      </div>

      <div class="card card-custom border-0 shadow-sm overflow-hidden mb-3">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="bg-light">
              <tr class="text-muted small text-uppercase">
                <th class="ps-4">Vista</th>
                <th>Código</th>
                <th>Propietario / Lote</th>
                <th>Precio / Sup.</th>
                <th class="text-center">Estado</th>
                <th class="text-end pe-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="cargando">
                <td colspan="6" class="text-center py-5">
                  <div class="spinner-border text-primary" role="status"></div>
                  <div class="mt-2 text-muted small">Cargando propiedades...</div>
                </td>
              </tr>
              <tr v-else-if="propiedades.length === 0">
                <td colspan="6" class="text-center py-5 text-muted">
                  <i class="bi bi-inbox fs-2 d-block mb-2"></i> No se encontraron propiedades.
                </td>
              </tr>
              <template v-else>
                <tr v-for="prop in propiedades" :key="prop.id">
                  <td class="ps-4">
                    <div class="rounded overflow-hidden bg-light d-flex align-items-center justify-content-center" style="width: 50px; height: 50px;">
                      <img v-if="prop.imagenes?.find(i => i.es_principal) || prop.imagenes?.[0]" 
                           :src="baseUrl + (prop.imagenes.find(i => i.es_principal)?.url || prop.imagenes[0].url)" 
                           class="w-100 h-100 object-fit-cover">
                      <svg v-else-if="prop.tipo === 'Casa'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-100 h-100 p-2" style="color: #55585d; background-color: #e9ecef;" title="Casa">
                        <path d="M3 10.182V19.8c0 .663.537 1.2 1.2 1.2h15.6c.663 0 1.2-.537 1.2-1.2V10.182c0-.332-.138-.65-.382-.88l-7.8-7.391a1.2 1.2 0 0 0-1.636 0l-7.8 7.39a1.2 1.2 0 0 0-.382.882z" />
                        <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="w-100 h-100 p-2" style="color: #6c757d; background-color: #f1f3f5;" title="Lote">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    </div>
                  </td>
                  <td>
                    <span class="fw-bold">{{ prop.codigo }}</span>
                    <div class="text-muted smaller">{{ prop.tipo }}</div>
                  </td>
                  <td>
                    <div class="d-flex align-items-center gap-1 flex-wrap">
                      <span class="fw-medium text-truncate" style="max-width: 160px;"
                            :title="prop.propietarios?.map(p => p.tipo === 'empresa' ? p.nombre_empresa : p.nombre_completo).join(', ')">
                        {{ prop.propietarios?.[0]
                            ? (prop.propietarios[0].tipo === 'empresa' ? prop.propietarios[0].nombre_empresa : prop.propietarios[0].nombre_completo)
                            : 'Sin Propietario' }}
                      </span>
                      <span v-if="prop.propietarios?.length > 1"
                            class="badge rounded-pill bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25"
                            style="font-size:.68rem;">
                        +{{ prop.propietarios.length - 1 }}
                      </span>
                    </div>
                    <div class="smaller text-muted">
                      <i class="bi bi-geo-alt text-primary"></i>
                      {{ prop.sector_urbano?.nombre }}, {{ prop.sector_urbano?.distrito?.ciudad?.nombre }}
                    </div>
                    <div class="smaller text-muted">Lote {{ prop.nro_lote || 'N/A' }}</div>
                  </td>
                  <td>
                    <div class="fw-bold text-success">{{ prop.moneda }} {{ prop.precio_venta }}</div>
                    <div class="smaller text-muted">{{ prop.superficie_m2 }} m²</div>
                  </td>
                  <td class="text-center">
                    <span class="badge rounded-pill px-3" :class="prop.estado === 'Disponible' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'">
                      {{ prop.estado }}
                    </span>
                  </td>
                  <td class="text-end pe-4">
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" @click="irDetalle(prop)" title="Ver Detalles"><i class="bi bi-eye text-primary"></i></button>
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" @click="irGestionImagenes(prop)" title="Imágenes"><i class="bi bi-images text-success"></i></button>
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" @click="irGestionCaracteristicas(prop)" title="Características"><i class="bi bi-tags text-warning"></i></button>
                    <button class="btn btn-sm btn-light me-2 custom-action-btn" @click="irFormulario(prop)" title="Editar"><i class="bi bi-pencil-square text-info"></i></button>
                    <button class="btn btn-sm btn-light custom-action-btn" @click="toggleActivo(prop)" :title="prop.activo ? 'Ocultar' : 'Publicar'">
                      <i class="bi" :class="prop.activo ? 'bi-trash text-danger' : 'bi-check-circle text-success'"></i>
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <nav v-if="totalPages > 1" class="d-flex justify-content-between align-items-center mt-3">
        <small class="text-muted">Mostrando página {{ currentPage }} de {{ totalPages }}</small>
        <ul class="pagination pagination-sm mb-0 shadow-sm">
          <li class="page-item" :class="{ disabled: currentPage === 1 }"><button class="page-link shadow-none text-secondary" @click="cargarDatosBase(currentPage - 1)"><i class="bi bi-chevron-left"></i></button></li>
          <li class="page-item" v-for="page in paginasVisibles" :key="page" :class="{ active: currentPage === page }"><button class="page-link shadow-none custom-page-btn" @click="cargarDatosBase(page)">{{ page }}</button></li>
          <li class="page-item" :class="{ disabled: currentPage === totalPages }"><button class="page-link shadow-none text-secondary" @click="cargarDatosBase(currentPage + 1)"><i class="bi bi-chevron-right"></i></button></li>
        </ul>
      </nav>
    </div>

    <!-- SECCIÓN 2: FORMULARIO DE REGISTRO / EDICIÓN -->
    <div v-else-if="viewMode === 'form'" class="card card-custom border-0 shadow-lg overflow-hidden animate__animated animate__fadeIn">
      <div class="card-header border-0 bg-light p-4 d-flex justify-content-between align-items-center">
        <div>
          <h5 class="modal-title fw-bold mb-0">
            <i class="bi bi-houses-fill me-2" style="color: var(--primary-color);"></i>
            {{ isEditing ? 'Actualizar Propiedad' : 'Registro de Propiedad' }}
          </h5>
          <small class="text-muted">Completa los datos técnicos y de ubicación.</small>
        </div>
        <button class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" @click="volverListado">
          <i class="bi bi-arrow-left"></i> Volver al Listado
        </button>
      </div>
      
      <div class="card-body p-0">
        <form @submit.prevent="guardar" novalidate>
          <div v-if="Object.keys(erroresValidacion).length" class="alert alert-danger m-4" role="alert">
            <strong>Revisa estos datos antes de guardar:</strong>
            <ul class="mb-0 mt-2">
              <li v-for="(mensaje, index) in Object.values(erroresValidacion).flat()" :key="index">{{ mensaje }}</li>
            </ul>
          </div>
          <div class="row g-0">
            <div class="col-lg-6 p-4 border-end">
              <h6 class="fw-bold mb-3" style="color: var(--text-main);">Información General</h6>
              <div class="row g-3">
                <div class="col-md-6" v-if="isEditing">
                  <label class="form-label small fw-bold">Código</label>
                  <input type="text" class="form-control bg-light border-0 text-uppercase" v-model="propiedadForm.codigo" :class="{'is-invalid': erroresValidacion.codigo}">
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-bold">Tipo *</label>
                  <select class="form-select" v-model="propiedadForm.tipo">
                    <option value="Lote">Lote</option>
                    <option value="Casa">Casa</option>
                  </select>
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold">Distrito *</label>
                  <LiveSearchSelect
                    v-model="formDistritoId"
                    :options="distritos"
                    displayKey="nombre"
                    subKey="ciudad.nombre"
                    valueKey="id"
                    placeholder="Buscar distrito..."
                  />
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold">Sector Urbano *</label>
                  <select class="form-select bg-light border-0 shadow-none"
                          v-model="propiedadForm.sector_urbano_id"
                          :class="{'is-invalid': erroresValidacion.sector_urbano_id}"
                          :disabled="!formDistritoId || !sectoresUrbanos.length">
                    <option value="">{{ formDistritoId ? 'Selecciona sector...' : 'Primero selecciona distrito' }}</option>
                    <option v-for="s in sectoresUrbanos" :key="s.id" :value="s.id">{{ s.nombre }} ({{ s.tipo }})</option>
                  </select>
                  <div v-if="erroresValidacion.sector_urbano_id" class="text-danger smaller mt-1 fw-medium">Debe seleccionar un sector.</div>
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold">Nro Lote</label>
                  <input type="text" class="form-control" v-model="propiedadForm.nro_lote">
                </div>

                <div class="col-12">
                  <label class="form-label small fw-bold">Propietario(s) *</label>
                  <LiveSearchMultiSelect
                    v-model="propiedadForm.propietario_ids"
                    :options="propietariosParaSelector"
                    displayKey="display_label"
                    subKey="display_sub"
                    valueKey="id"
                    placeholder="Buscar por Nombre, Empresa o CI..."
                    :hasError="!!erroresValidacion.propietario_ids"
                  />
                  <div v-if="erroresValidacion.propietario_ids" class="text-danger smaller mt-1 fw-medium">Debe seleccionar al menos un propietario.</div>
                </div>

                <!-- 
                <div class="col-md-3">
                  <label class="form-label small fw-bold">Moneda</label>
                  <select class="form-select" v-model="propiedadForm.moneda">
                    <option value="USD">USD</option>
                    <option value="BOB">BOB</option>
                  </select>
                </div>
                -->

                <div class="col-md-8">
                  <label class="form-label small fw-bold">Precio de Venta ({{ propiedadForm.moneda }}) *</label>
                  <input type="number" step="0.01" min="0" class="form-control bg-light border-0 text-success fw-bold" v-model="propiedadForm.precio_venta" :class="{'is-invalid': erroresValidacion.precio_venta}" required>
                </div>

                <!-- 
                <div class="col-md-4">
                  <label class="form-label small fw-bold">Estado</label>
                  <select class="form-select" v-model="propiedadForm.estado">
                    <option value="Disponible">Disponible</option>
                    <option value="Reservado">Reservado</option>
                    <option value="Vendido">Vendido</option>
                  </select>
                </div>
                -->

                <div class="col-md-6">
                  <label class="form-label small fw-bold">Frente (mts, opcional)</label>
                  <input type="number" step="0.01" min="0" class="form-control" v-model="propiedadForm.frente_mts" :class="{'is-invalid': erroresValidacion.frente_mts}">
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold">Fondo (mts, opcional)</label>
                  <input type="number" step="0.01" min="0" class="form-control" v-model="propiedadForm.fondo_mts" :class="{'is-invalid': erroresValidacion.fondo_mts}">
                </div>

                <div class="col-md-6">
                  <label class="form-label small fw-bold text-primary">Sup. Terreno (m²) *</label>
                  <input type="number" step="0.01" min="0" class="form-control bg-primary bg-opacity-10 border-0 fw-bold" v-model="propiedadForm.superficie_m2" :class="{'is-invalid': erroresValidacion.superficie_m2}" required>
                  <div class="extra-small text-muted mt-1"><i class="bi bi-info-circle me-1"></i>Ingresa la superficie o calcula con Frente × Fondo. Puedes ajustar el resultado.</div>
                </div>

                <div class="col-md-6" v-if="propiedadForm.tipo === 'Casa'">
                  <label class="form-label small fw-bold">Sup. Construida (m²)</label>
                  <input type="number" step="0.01" class="form-control" v-model="propiedadForm.superficie_construida_m2">
                </div>

                <template v-if="propiedadForm.tipo === 'Casa'">
                  <div class="col-md-4">
                    <label class="form-label small fw-bold">Habitaciones</label>
                    <input type="number" class="form-control" v-model="propiedadForm.habitaciones">
                  </div>

                  <div class="col-md-4">
                    <label class="form-label small fw-bold">Baños</label>
                    <input type="number" class="form-control" v-model="propiedadForm.banos">
                  </div>
                </template>

                <div class="col-md-4 d-flex align-items-center pt-3">
                  <div class="form-check form-switch">
                    <input class="form-check-input custom-switch shadow-none" type="checkbox" role="switch" v-model="propiedadForm.es_esquina">
                    <label class="form-check-label small fw-bold ms-2">Es Esquina</label>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-lg-6 p-4 bg-light bg-opacity-25">
              <h6 class="fw-bold mb-3" style="color: var(--text-main);">Ubicación y Geolocalización</h6>
              <div class="mb-3">
                <label class="form-label small fw-bold">Dirección de la Propiedad</label>
                <input type="text" class="form-control bg-white border" v-model="propiedadForm.direccion" placeholder="Ej: Av. Principal, Zona Norte">
              </div>

              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small text-muted">Haz clic en el mapa o arrastra el marcador para fijar la ubicación.</span>
                <button type="button" class="btn btn-sm btn-outline-primary" @click="abrirModalUrl">
                  <i class="bi bi-link-45deg me-1"></i>Cargar desde URL
                </button>
              </div>

              <div class="map-container shadow-sm rounded overflow-hidden mb-3 border">
                <div ref="mapDiv" style="width: 100%; height: 350px;"></div>
              </div>
              
              <div class="row g-2 mb-4">
                <div class="col-md-6">
                  <label class="smaller" style="color: var(--text-main);">Latitud</label>
                  <input type="text" class="form-control form-control-sm bg-transparent" v-model="ubicacionForm.latitud" readonly>
                </div>
                <div class="col-md-6">
                  <label class="smaller" style="color: var(--text-main);">Longitud</label>
                  <input type="text" class="form-control form-control-sm bg-transparent" v-model="ubicacionForm.longitud" readonly>
                </div>
              </div>

              <h6 class="fw-bold mb-3 smaller text-uppercase" style="color: var(--text-main);">Colindancias</h6>
              <div class="row g-2">
                <div class="col-md-6">
                  <label class="smaller fw-bold" style="color: var(--text-main);">Norte</label>
                  <input type="text" class="form-control form-control-sm bg-transparent" v-model="propiedadForm.colinda_norte">
                </div>
                <div class="col-md-6">
                  <label class="smaller fw-bold" style="color: var(--text-main);">Sur</label>
                  <input type="text" class="form-control form-control-sm bg-transparent" v-model="propiedadForm.colinda_sur">
                </div>
                <div class="col-md-6">
                  <label class="smaller fw-bold" style="color: var(--text-main);">Este</label>
                  <input type="text" class="form-control form-control-sm bg-transparent" v-model="propiedadForm.colinda_este">
                </div>
                <div class="col-md-6">
                  <label class="smaller fw-bold" style="color: var(--text-main);">Oeste</label>
                  <input type="text" class="form-control form-control-sm bg-transparent" v-model="propiedadForm.colinda_oeste">
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 bg-light d-flex justify-content-end gap-2 border-top">
            <button type="button" class="btn btn-white border px-4" @click="volverListado" :disabled="guardando">Cancelar</button>
            <button type="submit" class="btn btn-primary px-5 shadow-sm border-0" style="background-color: var(--primary-color);" :disabled="guardando">
              <span v-if="guardando" class="spinner-border spinner-border-sm me-2"></span>
              {{ guardando ? 'Guardando...' : (isEditing ? 'Actualizar Propiedad' : 'Guardar Propiedad') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- SECCIÓN 3: DETALLE DE PROPIEDAD -->
    <div v-else-if="viewMode === 'detail' && propiedadSeleccionada" class="card card-custom border-0 shadow-lg animate__animated animate__fadeIn">
      <div class="card-header bg-light border-bottom-0 p-4 d-flex justify-content-between align-items-center">
        <div>
          <h5 class="card-title fw-bold mb-0">
            <i class="bi bi-info-circle text-primary me-2"></i> Detalle de Propiedad: {{ propiedadSeleccionada.codigo }}
          </h5>
        </div>
        <button class="btn btn-outline-secondary btn-sm" @click="volverListado">
          <i class="bi bi-arrow-left"></i> Volver al Listado
        </button>
      </div>

      <div class="card-body p-4">
        <div class="row">
          <div class="col-md-7 mb-4">
             <!-- Galería en Detalle -->
             <div v-if="propiedadSeleccionada.imagenes?.length" class="mb-4">
                <div class="main-image-container rounded overflow-hidden shadow-sm mb-2 border" style="height: 300px;">
                  <img :src="baseUrl + (propiedadSeleccionada.imagenes.find(i => i.es_principal)?.url || propiedadSeleccionada.imagenes[0].url)" 
                       class="w-100 h-100 object-fit-cover">
                </div>
                <div class="d-flex gap-2 overflow-x-auto pb-2">
                  <div v-for="img in propiedadSeleccionada.imagenes" :key="img.id" 
                       class="rounded overflow-hidden border cursor-pointer flex-shrink-0" 
                       style="width: 80px; height: 60px;">
                    <img :src="baseUrl + img.url" class="w-100 h-100 object-fit-cover">
                  </div>
                </div>
             </div>
             <div v-else class="mb-4 p-5 bg-light rounded text-center border">
                <i class="bi bi-image text-muted fs-1 d-block"></i>
                <span class="text-muted smaller">Sin imágenes registradas</span>
             </div>

            <h6 class="fw-bold border-bottom pb-2 text-muted">Datos Técnicos</h6>
            <ul class="list-group list-group-flush small">
              <li class="list-group-item px-0 bg-transparent"><strong>Código:</strong> {{ propiedadSeleccionada.codigo }} ({{ propiedadSeleccionada.tipo }})</li>
              <li class="list-group-item px-0 bg-transparent"><strong>Lote Nro:</strong> {{ propiedadSeleccionada.nro_lote || '-' }}</li>
              <li class="list-group-item px-0 bg-transparent"><strong>Sup. Terreno:</strong> {{ propiedadSeleccionada.superficie_m2 }} m²</li>
              <li class="list-group-item px-0 bg-transparent" v-if="propiedadSeleccionada.tipo === 'Casa' && propiedadSeleccionada.superficie_construida_m2"><strong>Sup. Construida:</strong> {{ propiedadSeleccionada.superficie_construida_m2 }} m²</li>
              <li class="list-group-item px-0 bg-transparent"><strong>Precio:</strong> <span class="text-success fw-bold">{{ propiedadSeleccionada.moneda }} {{ propiedadSeleccionada.precio_venta }}</span></li>
            </ul>
          </div>
          <div class="col-md-5 mb-4">
            <h6 class="fw-bold border-bottom pb-2 text-muted">Propietario(s) y Estado</h6>
            <div class="mb-3">
              <div v-if="propiedadSeleccionada.propietarios?.length" class="d-flex flex-column gap-2">
                <div v-for="p in propiedadSeleccionada.propietarios" :key="p.id"
                     class="p-2 bg-light rounded border d-flex align-items-start gap-2 small">
                  <i class="bi mt-1 flex-shrink-0"
                     :class="p.tipo === 'empresa' ? 'bi-building text-info' : 'bi-person-fill text-primary'"></i>
                  <div>
                    <div class="fw-bold">
                      {{ p.tipo === 'empresa' ? p.nombre_empresa : p.nombre_completo }}
                    </div>
                    <div class="text-muted" style="font-size:.72rem;">
                      <span v-if="p.tipo === 'empresa'">Rep: {{ p.nombre_completo }}</span>
                      <span v-else-if="p.ci">CI: {{ p.ci }}{{ p.lugar_expedicion ? ' ' + p.lugar_expedicion : '' }}</span>
                    </div>
                    <div class="text-muted" style="font-size:.72rem;" v-if="p.telefono">
                      <i class="bi bi-telephone me-1"></i>{{ p.telefono }}
                    </div>
                  </div>
                </div>
              </div>
              <span v-else class="text-muted small">Sin propietario registrado</span>
            </div>
            <ul class="list-group list-group-flush small mb-4">
              <li class="list-group-item px-0 bg-transparent"><strong>Estado Comercial:</strong>
                <span class="ms-2 badge" :class="propiedadSeleccionada.estado === 'Disponible' ? 'bg-success' : 'bg-warning text-dark'">
                  {{ propiedadSeleccionada.estado }}
                </span>
              </li>
            </ul>

            <h6 class="fw-bold border-bottom pb-2 text-muted">Ubicación</h6>
            <div class="p-3 bg-light rounded border-start border-4 border-primary mb-3">
              <div class="fw-bold"><i class="bi bi-geo-alt-fill text-primary"></i> {{ propiedadSeleccionada.sector_urbano?.nombre }}</div>
              <div class="small text-muted">{{ propiedadSeleccionada.sector_urbano?.distrito?.nombre }} — {{ propiedadSeleccionada.sector_urbano?.distrito?.ciudad?.nombre }}</div>
            </div>
            <p class="small"><strong>Dirección Exacta:</strong><br>{{ propiedadSeleccionada.direccion || 'No especificada' }}</p>

            <h6 class="fw-bold border-bottom pb-2 text-muted">Características y Amenidades</h6>
            <div class="row g-2 text-center mb-3">
              <div class="col-4" v-if="propiedadSeleccionada.habitaciones > 0">
                <div class="p-2 bg-light rounded border smaller">
                  <i class="bi bi-door-open d-block"></i> <strong>{{ propiedadSeleccionada.habitaciones }}</strong> Dorm.
                </div>
              </div>
              <div class="col-4" v-if="propiedadSeleccionada.banos > 0">
                <div class="p-2 bg-light rounded border smaller">
                  <i class="bi bi-droplet d-block"></i> <strong>{{ propiedadSeleccionada.banos }}</strong> Baños
                </div>
              </div>
              <div class="col-4" v-if="propiedadSeleccionada.es_esquina">
                <div class="p-2 bg-primary bg-opacity-10 text-primary rounded border border-primary border-opacity-25 smaller">
                  <i class="bi bi-bounding-box d-block"></i> <strong>Esquina</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-md-6 mb-3">
            <h6 class="fw-bold border-bottom pb-2 text-muted">Colindancias</h6>
            <div class="d-flex flex-wrap gap-2 small">
              <div class="bg-light p-2 rounded border flex-fill text-center"><strong>N:</strong> {{ propiedadSeleccionada.colinda_norte || '-' }}</div>
              <div class="bg-light p-2 rounded border flex-fill text-center"><strong>S:</strong> {{ propiedadSeleccionada.colinda_sur || '-' }}</div>
              <div class="bg-light p-2 rounded border flex-fill text-center"><strong>E:</strong> {{ propiedadSeleccionada.colinda_este || '-' }}</div>
              <div class="bg-light p-2 rounded border flex-fill text-center"><strong>O:</strong> {{ propiedadSeleccionada.colinda_oeste || '-' }}</div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
             <!-- CARACTERISTICAS EN DETALLE -->
            <div v-if="propiedadSeleccionada.caracteristicas?.length">
              <h6 class="fw-bold border-bottom pb-2 text-muted">Amenidades Extras</h6>
              <div class="d-flex flex-wrap gap-1">
                <span v-for="c in propiedadSeleccionada.caracteristicas" :key="c.id" class="badge bg-light text-dark border fw-normal">
                  <i class="bi bi-check2 text-success me-1"></i> {{ c.nombre }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card-footer bg-light p-4 text-end border-0">
        <button class="btn btn-info text-white px-4 me-2" @click="irFormulario(propiedadSeleccionada)">
          <i class="bi bi-pencil-square me-1"></i> Editar esta Propiedad
        </button>
        <button class="btn btn-secondary px-4" @click="volverListado">Cerrar Detalle</button>
      </div>
    </div>

    <!-- SECCIÓN 4: GESTIÓN DE CARACTERÍSTICAS (ASIGNACIÓN) -->
    <div v-else-if="viewMode === 'characteristics' && propiedadSeleccionada" class="card card-custom border-0 shadow-lg animate__animated animate__fadeIn">
      <div class="card-header bg-light border-0 p-4 d-flex justify-content-between align-items-center">
        <div>
          <h5 class="fw-bold mb-0">Asignar Características</h5>
          <p class="text-muted small mb-0">Selecciona los servicios y amenidades para: <span class="text-primary fw-bold">{{ propiedadSeleccionada.codigo }}</span></p>
        </div>
        <button class="btn btn-outline-secondary btn-sm" @click="volverListado">
          <i class="bi bi-arrow-left"></i> Volver
        </button>
      </div>

      <div class="card-body p-4">
        <div class="row mb-4">
          <div class="col-md-6 mx-auto">
            <div class="input-group">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search"></i></span>
              <input type="text" class="form-control border-start-0 shadow-none" v-model="caracSearch" placeholder="Filtrar por nombre...">
            </div>
          </div>
        </div>

        <div v-if="cargandoCarac" class="text-center py-5">
          <div class="spinner-border text-primary" role="status"></div>
        </div>

        <div v-else class="row g-4">
          <div v-for="(items, tipo) in caracAgrupadas" :key="tipo" class="col-md-4">
            <div class="p-3 rounded bg-light border-top border-4" 
                 :class="tipo === 'Servicios' ? 'border-warning' : (tipo === 'Interna' ? 'border-primary' : 'border-success')">
              <h6 class="fw-bold text-uppercase mb-3 d-flex align-items-center">
                <i class="bi me-2" :class="tipo === 'Servicios' ? 'bi-lightning-charge-fill' : (tipo === 'Interna' ? 'bi-house-heart-fill' : 'bi-tree-fill')"></i>
                {{ tipo }}
              </h6>
              
              <div class="list-group list-group-flush bg-transparent">
                <button v-for="c in items" :key="c.id" 
                        type="button" 
                        class="list-group-item list-group-item-action border-0 px-0 d-flex align-items-center bg-transparent"
                        @click="toggleCaracteristica(c)">
                  <div class="form-check mb-0">
                    <input class="form-check-input custom-switch shadow-none pointer-events-none" type="checkbox" :checked="c.asignado">
                    <label class="form-check-label ms-2 cursor-pointer" :class="{'fw-bold text-primary': c.asignado}">
                      {{ c.nombre }}
                    </label>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div v-if="Object.keys(caracAgrupadas).length === 0" class="col-12 text-center text-muted py-4">
            No se encontraron características con ese nombre.
          </div>
        </div>
      </div>

      <div class="card-footer bg-light p-4 text-end border-0">
        <button class="btn btn-white border px-4 me-2" @click="volverListado" :disabled="guardando">Cancelar</button>
        <button class="btn btn-primary px-5 shadow-sm border-0" 
                style="background-color: var(--primary-color);" 
                @click="guardarCaracteristicas" :disabled="guardando">
          <span v-if="guardando" class="spinner-border spinner-border-sm me-2"></span>
          Guardar Cambios
        </button>
      </div>
    </div>

    <!-- SECCIÓN 5: GESTIÓN DE IMÁGENES -->
    <div v-else-if="viewMode === 'images' && propiedadSeleccionada" class="card card-custom border-0 shadow-lg animate__animated animate__fadeIn">
      <div class="card-header bg-light border-0 p-4 d-flex justify-content-between align-items-center">
        <div>
          <h5 class="fw-bold mb-0">Gestión de Galería</h5>
          <p class="text-muted small mb-0">Administra las fotos para la propiedad: <span class="text-primary fw-bold">{{ propiedadSeleccionada.codigo }}</span></p>
        </div>
        <button class="btn btn-outline-secondary btn-sm" @click="volverListado">
          <i class="bi bi-arrow-left"></i> Volver
        </button>
      </div>

      <div class="card-body p-4">
        <ImagenPropiedadManager 
          :propiedadId="propiedadSeleccionada.id" 
          :imagenes="propiedadSeleccionada.imagenes || []"
          @updated="recargarPropiedad"
        />
      </div>

      <div class="card-footer bg-light p-4 text-end border-0">
        <button class="btn btn-secondary px-5 shadow-sm" @click="volverListado">
          Finalizar Gestión
        </button>
      </div>
    </div>

  </div>

  <!-- ═══ Modal: Cargar ubicación desde URL de Google Maps ═══ -->
  <div v-if="modalUrlVisible" class="modal d-block" style="background:rgba(0,0,0,0.5); z-index:1060;">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content border-0 shadow-lg">
        <div class="modal-header" style="background-color:var(--primary-color)">
          <h5 class="modal-title text-white fw-bold">
            <i class="bi bi-geo-alt-fill me-2"></i>Cargar ubicación desde Google Maps
          </h5>
          <button type="button" class="btn-close btn-close-white" @click="modalUrlVisible = false"></button>
        </div>
        <div class="modal-body p-4">
          <p class="text-muted small mb-3">
            Abre Google Maps, busca la ubicación, copia la URL y pégala aquí.
            Funciona tanto con URLs completas del navegador como con enlaces acortados
            (<code>maps.app.goo.gl</code>).
          </p>
          <label class="form-label fw-semibold">URL de Google Maps</label>
          <textarea
            class="form-control"
            :class="{ 'is-invalid': urlMapsError }"
            v-model="urlMapsInput"
            rows="3"
            placeholder="https://www.google.com/maps/@-17.3411,-63.2514,17z"
            @keydown.enter.prevent="procesarUrlMaps"
          ></textarea>
          <div v-if="urlMapsError" class="invalid-feedback d-block mt-1">
            <i class="bi bi-exclamation-triangle me-1"></i>{{ urlMapsError }}
          </div>
          <div class="alert alert-info py-2 mt-3 mb-0 small">
            <i class="bi bi-info-circle me-1"></i>
            Los enlaces acortados se resuelven automáticamente a través del servidor.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" :disabled="resolviendoUrl" @click="modalUrlVisible = false">Cancelar</button>
          <button type="button" class="btn btn-primary border-0" style="background-color:var(--primary-color)"
                  :disabled="resolviendoUrl" @click="procesarUrlMaps">
            <span v-if="resolviendoUrl" class="spinner-border spinner-border-sm me-1"></span>
            <i v-else class="bi bi-map me-1"></i>
            {{ resolviendoUrl ? 'Resolviendo...' : 'Procesar' }}
          </button>
        </div>
      </div>
    </div>
  </div>

</template>

<style scoped>
.card-custom { background-color: var(--bg-card); border-radius: 12px; }
.smaller { font-size: 0.75rem; }
.cursor-pointer { cursor: pointer; }
.hover-danger:hover { color: #dc3545 !important; }
.transition-all { transition: all 0.2s ease-in-out; }

.page-item.active .custom-page-btn {
  background-color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
  color: white !important;
}
.custom-page-btn { color: var(--text-main); font-weight: 500; }

.custom-action-btn { background-color: transparent; border: 1px solid transparent; transition: all 0.2s; }
.custom-action-btn:hover { background-color: var(--border-color); }

.form-control:focus, .form-select:focus {
  background-color: var(--bg-card) !important;
  border: 1px solid var(--primary-color) !important;
  box-shadow: 0 0 0 0.25rem rgba(162, 139, 250, 0.25) !important;
}
</style>
