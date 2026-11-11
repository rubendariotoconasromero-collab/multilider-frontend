<script setup>
import { apiOrigin } from '@/api/config'
import { useCompanyStore } from '@/stores/company'
import { Facebook, Instagram, Linkedin, Twitter, ArrowUp, Send } from 'lucide-vue-next'

const companyStore = useCompanyStore()
const baseUrl = apiOrigin

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <footer class="bg-dark text-white pt-5 pb-4">
    <div class="container">
      <div class="row g-5 mb-5 pt-4">
        
        <!-- Brand -->
        <div class="col-lg-4">
          <div class="d-flex align-items-center gap-2 mb-4">
            <img 
              v-if="companyStore.company?.logo" 
              :src="baseUrl + companyStore.company.logo" 
              style="max-height: 40px;"
              alt="Logo"
            >
            <span class="fw-bold h4 mb-0">{{ companyStore.company?.nombre || 'Multilider' }}</span>
          </div>
          <p class="text-secondary small lh-lg mb-4">
            Expertos en soluciones inmobiliarias de alto impacto. Tu confianza es nuestro mayor activo y nos esforzamos cada día por superar tus expectativas.
          </p>
          <div class="d-flex gap-3">
            <a v-if="companyStore.company?.facebook" :href="companyStore.company.facebook" target="_blank" class="social-btn"><Facebook :size="20" /></a>
            <a v-if="companyStore.company?.instagram" :href="companyStore.company.instagram" target="_blank" class="social-btn"><Instagram :size="20" /></a>
            <a v-if="companyStore.company?.linkedin" :href="companyStore.company.linkedin" target="_blank" class="social-btn"><Linkedin :size="20" /></a>
          </div>
        </div>

        <!-- Quick Links -->
        <div class="col-6 col-lg-2">
          <h5 class="fw-bold mb-4">Empresa</h5>
          <ul class="list-unstyled d-flex flex-column gap-3 small">
            <li><a href="#inicio" class="text-secondary text-decoration-none hover-primary">Inicio</a></li>
            <li><a href="#catalogo" class="text-secondary text-decoration-none hover-primary">Catálogo</a></li>
            <li><a href="#nosotros" class="text-secondary text-decoration-none hover-primary">Nosotros</a></li>
            <li><a href="#asesores" class="text-secondary text-decoration-none hover-primary">Nuestro Equipo</a></li>
          </ul>
        </div>

        <!-- Support -->
        <div class="col-6 col-lg-2">
          <h5 class="fw-bold mb-4">Soporte</h5>
          <ul class="list-unstyled d-flex flex-column gap-3 small">
            <li><a href="#" class="text-secondary text-decoration-none hover-primary">FAQ</a></li>
            <li><a href="#" class="text-secondary text-decoration-none hover-primary">Términos</a></li>
            <li><a href="#" class="text-secondary text-decoration-none hover-primary">Privacidad</a></li>
            <li><a href="#contacto" class="text-secondary text-decoration-none hover-primary">Contacto</a></li>
          </ul>
        </div>

        <!-- Newsletter -->
        <div class="col-lg-4">
          <h5 class="fw-bold mb-4">Boletín Informativo</h5>
          <p class="text-secondary small mb-4">Suscríbete para recibir las mejores ofertas inmobiliarias y noticias del sector.</p>
          <div class="input-group mb-3 bg-white bg-opacity-10 rounded-3 p-1 border border-white border-opacity-10">
            <input type="email" class="form-control bg-transparent border-0 text-white shadow-none placeholder-secondary" placeholder="Tu correo electrónico">
            <button class="btn btn-primary-landing rounded-3 px-3">
              <Send :size="18" />
            </button>
          </div>
        </div>

      </div>

      <!-- Bottom -->
      <div class="border-top border-white border-opacity-10 pt-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
        <p class="text-secondary small mb-0">
          © {{ new Date().getFullYear() }} {{ companyStore.company?.nombre || 'Multilider System' }}. Reservados todos los derechos.
        </p>
        
        <button 
          @click="scrollToTop"
          class="btn btn-outline-light btn-sm rounded-circle d-flex align-items-center justify-content-center p-2 border-opacity-25"
          style="width: 40px; height: 40px;"
        >
          <ArrowUp :size="20" />
        </button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.bg-dark { background-color: #020617 !important; }
.social-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: all 0.3s ease;
  text-decoration: none;
}
.social-btn:hover {
  background: var(--landing-primary);
  transform: translateY(-3px);
}
.hover-primary:hover { color: var(--landing-primary) !important; }
.placeholder-secondary::placeholder { color: rgba(255,255,255,0.3); font-size: 0.85rem; }
</style>
