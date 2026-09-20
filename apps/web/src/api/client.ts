import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const api = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 10000, withCredentials: true })

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('syncora_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(undefined, async (error) => {
  const request = error.config
  const refreshable = !/\/auth\/(login|refresh|logout)$/.test(request.url ?? '')
  if (error.response?.status === 401 && !request._retried && refreshable) {
    request._retried = true
    {
      try {
        const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
        sessionStorage.setItem('syncora_access_token', data.access_token)
        request.headers.Authorization = `Bearer ${data.access_token}`
        return api(request)
      } catch { /* handled below */ }
    }
    sessionStorage.removeItem('syncora_access_token')
    window.dispatchEvent(new Event('syncora:unauthorized'))
  }
  if (error.response?.status === 403) window.dispatchEvent(new Event('syncora:permissions-changed'))
  return Promise.reject(error)
})
