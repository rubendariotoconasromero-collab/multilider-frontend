<script setup>
import { apiOrigin } from '@/api/config'
import { useCompanyStore } from '@/stores/company'
import { MessageCircle } from 'lucide-vue-next'

const companyStore = useCompanyStore()
const baseUrl = apiOrigin

const getWhatsAppLink = (phone) => {
  const cleanPhone = phone.replace(/\D/g, '')
  return `https://wa.me/${cleanPhone}?text=Hola, me gustaría recibir asesoramiento inmobiliario.`
}
</script>

<template>
  <section id="asesores" class="section-padding bg-white">
    <div class="container">
      <div class="row justify-content-center mb-5 text-center">
        <div class="col-lg-8">
          <h2 class="section-title">Nuestros Asesores Expertos</h2>
          <p class="section-subtitle">
            Contamos con un equipo altamente capacitado para guiarte en cada paso de tu inversión inmobiliaria.
          </p>
        </div>
      </div>

      <div class="row g-4">
        <div 
          v-for="advisor in companyStore.advisors" 
          :key="advisor.id"
          class="col-md-6 col-lg-3"
        >
          <div class="landing-card h-100 shadow-sm transition-all border-0 bg-white">
            <div class="position-relative overflow-hidden group" style="height: 350px;">
              <img v-if="advisor.foto"
                :src="baseUrl + advisor.foto"
                class="w-100 h-100 object-fit-cover" 
                style="transition: transform 0.5s ease;"
                alt="Foto asesor"
              >
              <div v-else class="d-flex h-100 align-items-center justify-content-center bg-light text-secondary" aria-hidden="true">
                <i class="bi bi-person-circle display-1"></i>
              </div>
              <div class="advisor-overlay position-absolute w-100 h-100 top-0 start-0 d-flex align-items-end p-4 opacity-0 transition-all" style="background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%);">
                 <a v-if="advisor.telefono"
                  :href="getWhatsAppLink(advisor.telefono || '')" 
                  target="_blank"
                  class="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2 py-2 rounded-3 border-0"
                  style="background-color: #25d366;"
                >
                  <MessageCircle :size="20" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
            <div class="p-4 text-center">
              <h5 class="fw-bold mb-1">{{ advisor.nombre ?? advisor.nombre_completo }}</h5>
              <p class="text-primary-landing small fw-bold text-uppercase mb-2">{{ advisor.cargo || 'Asesor Inmobiliario' }}</p>
              <div class="border-top pt-3 mt-2">
                <span class="text-muted small fst-italic">Especialista en {{ advisor.especialidad || 'Ventas' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="!companyStore.advisors.length" class="text-center py-5">
        <p class="text-muted fst-italic">Nuestro equipo de asesores pronto estará disponible.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.group:hover .advisor-overlay {
  opacity: 1 !important;
}
.group:hover img {
  transform: scale(1.05);
}
.object-fit-cover { object-fit: cover; }
</style>
