<script setup>
import { apiOrigin } from '@/api/config'
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCompanyStore } from '@/stores/company'
import { Menu, X, CreditCard } from 'lucide-vue-next'

const props = defineProps({
  transparentAtTop: {
    type: Boolean,
    default: true
  }
})

const companyStore = useCompanyStore()
const isScrolled = ref(false)
const isMobileMenuOpen = ref(false)
const isDark = ref(false)

const baseUrl = apiOrigin

const handleScroll = () => {
  isScrolled.value = window.scrollY > 50
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme-override', theme)
}

onMounted(() => {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

const navLinks = [
  { name: 'Inicio', href: '/' },
  { name: 'Propiedades', href: '/propiedades-venta' },
  { name: 'Nosotros', href: '/#nosotros' },
  { name: 'Asesores', href: '/#asesores' },
  { name: 'Contacto', href: '/#contacto' },
]
</script>

<template>
  <header 
    :class="[
      'fixed-top w-100 transition-all duration-500 header-main',
      isScrolled ? 'header-scrolled shadow-sm py-2' : (props.transparentAtTop ? 'bg-transparent py-4' : 'bg-hero-solid py-3 shadow-sm')
    ]"
    style="backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);"
  >
    <div class="container d-flex justify-content-between align-items-center">
      <!-- Logo con mejor espaciado -->
      <RouterLink to="/" class="d-flex align-items-center gap-2 text-decoration-none group">
        <div class="logo-box rounded-3 p-1 transition-all">
           <img v-if="companyStore.company?.logo" 
                :src="baseUrl + companyStore.company.logo" 
                :class="['transition-all duration-500', isScrolled ? 'logo-scrolled-filter' : '']"
                style="max-height: 35px; object-fit: contain;">
           <i v-else class="bi bi-hexagon-fill fs-3 text-primary"></i>
        </div>
        <span :class="['fw-black fs-4 tracking-tighter transition-colors', isScrolled ? 'text-theme' : 'text-white']">
          {{ companyStore.company?.nombre || 'Multilider' }}
        </span>
      </RouterLink>

      <!-- Desktop Nav -->
      <nav class="d-none d-lg-flex align-items-center gap-5">
        <template v-for="link in navLinks" :key="link.name">
          <!-- Usar RouterLink si es ruta interna, de lo contrario anchor -->
          <RouterLink 
            v-if="!link.href.startsWith('/#')" 
            :to="link.href"
            :class="['nav-link-premium', isScrolled ? 'text-theme' : 'text-white']"
          >
            {{ link.name }}
          </RouterLink>
          <a 
            v-else
            :href="link.href"
            :class="['nav-link-premium', isScrolled ? 'text-theme' : 'text-white']"
          >
            {{ link.name }}
          </a>
        </template>
        <RouterLink
          to="/pagar"
          :class="['btn-pagos-premium me-2', isScrolled ? 'btn-pagos-scrolled' : 'btn-pagos-top']"
        >
          <CreditCard :size="17" />
          <span>Pagos</span>
        </RouterLink>
        <button
          @click="toggleTheme"
          :class="['btn btn-link p-2 border-0 text-decoration-none', isScrolled ? 'text-theme' : 'text-white']"
          :title="isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        >
          <i class="fs-5" :class="isDark ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-stars-fill'"></i>
        </button>
        <a href="/login" :class="['btn rounded-pill px-4 py-2 fw-bold shadow-sm transition-all', isScrolled ? 'btn-login-scrolled' : 'btn-ghost-white']">
          Iniciar Sesión
        </a>
      </nav>

      <!-- Mobile Toggle -->
      <button 
        class="d-lg-none btn p-2 border-0" 
        @click="isMobileMenuOpen = !isMobileMenuOpen"
        :class="isScrolled ? 'text-theme' : 'text-white'"
      >
        <Menu v-if="!isMobileMenuOpen" />
        <X v-else />
      </button>
    </div>

    <!-- Mobile Menu -->
    <transition
      enter-active-class="animate__animated animate__slideInDown animate__faster"
      leave-active-class="animate__animated animate__slideOutUp animate__faster"
    >
      <div 
        v-if="isMobileMenuOpen" 
        class="mobile-overlay-premium d-lg-none position-fixed w-100 shadow-lg"
      >
        <div class="p-4 d-flex flex-column gap-3 pt-5">
          <template v-for="link in navLinks" :key="link.name">
            <RouterLink 
              v-if="!link.href.startsWith('/#')" 
              :to="link.href"
              class="text-theme fw-bold fs-5 text-decoration-none border-bottom pb-2"
              @click="isMobileMenuOpen = false"
            >
              {{ link.name }}
            </RouterLink>
            <a 
              v-else
              :href="link.href"
              class="text-theme fw-bold fs-5 text-decoration-none border-bottom pb-2"
              @click="isMobileMenuOpen = false"
            >
              {{ link.name }}
            </a>
          </template>
          <RouterLink
            to="/pagar"
            class="btn-pagos-premium btn-pagos-mobile w-100 justify-content-center py-3 mt-2"
            @click="isMobileMenuOpen = false"
          >
            <CreditCard :size="20" />
            <span>Pagos</span>
          </RouterLink>
          <button
            class="btn btn-link w-100 rounded-pill py-3 fw-bold mt-2 d-flex align-items-center justify-content-center gap-2 text-decoration-none"
            @click="toggleTheme"
          >
            <i :class="isDark ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-stars-fill text-secondary'"></i>
            <span class="text-theme">{{ isDark ? 'Modo Claro' : 'Modo Oscuro' }}</span>
          </button>
          <a href="/login" class="btn btn-primary w-100 rounded-pill py-3 fw-bold mt-2 shadow">
            Panel Administrativo
          </a>
        </div>
        <button class="btn-close-mobile" @click="isMobileMenuOpen = false"><X /></button>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.fw-black { font-weight: 900; }
.tracking-tighter { letter-spacing: -1.5px; }

.header-scrolled {
  background-color: var(--bg-card);
}

.text-theme {
  color: var(--text-main);
}

.nav-link-premium {
  text-decoration: none;
  font-weight: 700;
  font-size: 0.95rem;
  position: relative;
  opacity: 0.9;
  transition: all 0.3s;
}

.nav-link-premium::after {
  content: '';
  position: absolute;
  width: 0; height: 2px;
  bottom: -5px; left: 0;
  background-color: var(--landing-primary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-link-premium:hover::after { width: 100%; }
.nav-link-premium:hover { opacity: 1; transform: translateY(-1px); }

/* Estilos para el botón de login cuando hay scroll */
.btn-login-scrolled {
  background-color: var(--primary-color);
  color: white !important;
  border: none;
}

.btn-login-scrolled:hover {
  background-color: var(--primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(var(--landing-primary-rgb), 0.2);
}

[data-theme="dark"] .btn-login-scrolled {
  background-color: #ffffff; /* En dark mode resaltamos con blanco */
  color: #020617 !important;
}

[data-theme="dark"] .btn-login-scrolled:hover {
  background-color: #e2e8f0;
}

.mobile-overlay-premium {
  top: 0; left: 0; height: 100vh; z-index: 1000;
  background-color: var(--bg-card) !important;
  backdrop-filter: blur(15px);
}

.btn-close-mobile {
  position: absolute; top: 20px; right: 20px;
  background: none; border: none; color: var(--text-main);
}

.logo-box:hover { transform: rotate(5deg) scale(1.1); }

.bg-hero-solid {
  background: linear-gradient(135deg, #020617 0%, #1e40af 100%);
}

[data-theme="dark"] .bg-hero-solid {
  background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
  border-bottom: 1px solid var(--border-color);
}

.btn-ghost-white {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-ghost-white:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-color: white;
}

.logo-scrolled-filter {
  /* Transforma el blanco en Navy (#0B2545) */
  filter: brightness(0) saturate(100%) invert(9%) sepia(43%) saturate(1915%) hue-rotate(194deg) brightness(96%) contrast(98%);
}

[data-theme="dark"] .logo-scrolled-filter {
  /* En modo oscuro, si el logo es oscuro lo pasamos a blanco o lo dejamos normal si ya es visible */
  filter: brightness(0) invert(1);
}

.btn-pagos-premium {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0.55rem 1.4rem;
  font-weight: 600;
  font-size: 0.88rem;
  border-radius: 50px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  text-decoration: none;
  border: 1px solid transparent;
  letter-spacing: 0.01em;
}

/* Estado: Encabezado Transparente (Fondo Oscuro/Hero) */
.btn-pagos-top {
  background: rgba(255, 255, 255, 0.07);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
}

.btn-pagos-top:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
  color: #ffffff;
}

/* Estado: Encabezado con Scroll (Fondo Blanco) */
.btn-pagos-scrolled {
  background: #ecfdf5; /* Verde esmeralda ultra-ligero */
  color: #059669;      /* Verde esmeralda desaturado y elegante */
  border-color: #d1fae5;
}

[data-theme="dark"] .btn-pagos-scrolled {
  background: rgba(5, 150, 105, 0.1);
  color: #34d399;
  border-color: rgba(5, 150, 105, 0.2);
}

.btn-pagos-scrolled:hover {
  background: #d1fae5;
  color: #047857;
  border-color: #a7f3d0;
  transform: translateY(-1px);
}

[data-theme="dark"] .btn-pagos-scrolled:hover {
  background: rgba(5, 150, 105, 0.2);
  color: #34d399;
}

/* Versión Mobile: Siempre sobre fondo blanco en el overlay */
.btn-pagos-mobile {
  background: #059669;
  color: white !important;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15);
}
</style>
