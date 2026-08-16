import axios from 'axios'

// Base URL: uses the Vite proxy in dev, or the production backend URL.
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Attach the Clerk session token to every request.
const tokenProvider = () =>
  typeof window !== 'undefined' && window.Clerk?.session?.getToken
    ? window.Clerk.session.getToken()
    : Promise.resolve(null)

api.interceptors.request.use(async (config) => {
  try {
    const token = await tokenProvider()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (err) {
    // Ignore token errors; the request may still be permitted.
  }
  return config
})

export const getSessions = () => api.get('/sessions').then((r) => r.data)

export const getSession = (id) => api.get(`/sessions/${id}`).then((r) => r.data)

export const createSession = () => api.post('/sessions').then((r) => r.data)

export const renameSession = (id, title) =>
  api.put(`/sessions/${id}`, { title }).then((r) => r.data)

export const deleteSession = (id) => api.delete(`/sessions/${id}`).then((r) => r.data)

export const sendChat = ({ session_id, message, history }) =>
  api
    .post('/chat', { session_id, message, history })
    .then((r) => r.data)

export default api
