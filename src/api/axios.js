import { installBusinessInterceptors } from './operations'
import { apiOrigin } from '@/api/config'
import axios from 'axios'
import router from '@/router'
import { installSessionInterceptors } from '../auth/session'
const api = axios.create({ baseURL: `${apiOrigin}/api`, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } })
export default installSessionInterceptors(installBusinessInterceptors(api), router)
