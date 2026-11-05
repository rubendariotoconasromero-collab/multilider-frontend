import { defineStore } from 'pinia'
import api from '@/api/axios'

export const useCompanyStore = defineStore('company', {
  state: () => ({
    company: null,
    libelulaEnabled: 1,
    testPaymentsAvailable: true,
    featuredProperties: [],
    latestProperties: [],
    allProperties: [],
    currentProperty: null,
    similarProperties: [],
    cities: [],
    distritos: [],
    sectoresUrbanos: [],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0
    },
    advisors: [],
    loading: false,
    loadingProperty: false,
    error: null
  }),
  
  getters: {
    primaryColor: (state) => state.company?.color_primario || '#1e40af',
    secondaryColor: (state) => state.company?.color_secundario || '#1e293b',
  },

  actions: {
    async fetchCompany() {
      try {
        const { data } = await api.get('/empresa/datos')
        this.company = data.empresa
        this.libelulaEnabled = data.libelula_enabled ?? 1
        this.testPaymentsAvailable = data.pagos_prueba_disponibles ?? true
        this.applyBranding()
      } catch {
        this.error = 'No se pudo cargar la configuración de empresa.'
      }
    },
    async fetchLandingData() {
      this.loading = true
      try {
        const response = await api.get('/landing')
        const data = response.data
        
        this.company = data.empresa
        this.libelulaEnabled = data.libelula_enabled ?? 1
        this.featuredProperties = data.propiedades_destacadas
        this.latestProperties = data.ultimas_propiedades
        this.advisors = data.asesores
        
        this.applyBranding()
      } catch (err) {
        this.error = 'No se pudo cargar la información de la landing.'
        console.error(err)
      } finally {
        this.loading = false
      }
    },

    async fetchProperties(params = {}) {
      this.loading = true
      this.allProperties = [] // Limpiar para evitar parpadeos de estados previos
      try {
        const response = await api.get('/landing/propiedades', { params })
        this.allProperties = response.data.data
        this.pagination = {
          currentPage: response.data.current_page,
          totalPages: response.data.last_page,
          totalItems: response.data.total
        }
      } catch (err) {
        console.error('Error fetching properties:', err)
      } finally {
        this.loading = false
      }
    },

    async fetchPropiedad(id) {
      this.loadingProperty = true
      this.currentProperty = null
      try {
        const response = await api.get(`/landing/propiedades/${id}`)
        this.currentProperty = response.data
      } catch (err) {
        console.error('Error fetching propiedad:', err)
      } finally {
        this.loadingProperty = false
      }
    },

    async fetchSimilares(id) {
      try {
        const response = await api.get(`/landing/propiedades/${id}/similares`)
        this.similarProperties = response.data
      } catch (err) {
        console.error('Error fetching similares:', err)
        this.similarProperties = []
      }
    },

    async fetchCities() {
      try {
        const response = await api.get('/landing/ciudades')
        this.cities = response.data
      } catch (err) {
        console.error('Error fetching cities:', err)
      }
    },

    async fetchDistritos(ciudadId = null) {
      try {
        const params = ciudadId ? { ciudad_id: ciudadId } : {}
        const response = await api.get('/landing/distritos', { params })
        this.distritos = response.data
      } catch (err) {
        console.error('Error fetching distritos:', err)
      }
    },

    async fetchSectoresUrbanos(distritoId) {
      try {
        const response = await api.get(`/landing/sectores-urbanos/${distritoId}`)
        this.sectoresUrbanos = response.data
      } catch (err) {
        console.error('Error fetching sectores urbanos:', err)
        this.sectoresUrbanos = []
      }
    },

    async updateCompanyData(formData) {
      this.loading = true
      try {
        const response = await api.post('/empresa', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        this.company = response.data.data
        this.applyBranding()
        return response.data
      } catch (err) {
        console.error(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    applyBranding() {
      if (this.company) {
        document.documentElement.style.setProperty('--landing-primary', this.company.color_primario)
        document.documentElement.style.setProperty('--landing-secondary', this.company.color_secundario || '#1e293b')
      }
    }
  }
})
