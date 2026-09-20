import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8500'
export const api = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 10000 })

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('syncora_access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(undefined, async (error) => {
  const request = error.config
  if (error.response?.status === 401 && !request._retried && !request.url?.includes('/auth/')) {
    request._retried = true
    const refreshToken = localStorage.getItem('syncora_refresh_token')
    if (refreshToken) {
      try {
        const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refresh_token: refreshToken })
        sessionStorage.setItem('syncora_access_token', data.access_token)
        localStorage.setItem('syncora_refresh_token', data.refresh_token)
        request.headers.Authorization = `Bearer ${data.access_token}`
        return api(request)
      } catch { /* handled below */ }
    }
    sessionStorage.removeItem('syncora_access_token')
    localStorage.removeItem('syncora_refresh_token')
    window.dispatchEvent(new Event('syncora:unauthorized'))
  }
  return Promise.reject(error)
})

