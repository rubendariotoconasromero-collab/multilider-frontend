import axios from 'axios'
import router from '@/router'
import { installSessionInterceptors } from '../auth/session'
const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api`, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
export default installSessionInterceptors(api, router)
