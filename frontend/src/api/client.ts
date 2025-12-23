// API base URL - must be set via VITE_API_BASE env var for production
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

if (!API_BASE) {
  console.warn('[API] VITE_API_BASE not set - using relative URLs (requires proxy)')
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  console.log(`[API] ${init?.method ?? 'GET'} ${url}`)
  
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

    if (!res.ok) {
      let message = res.statusText
      try {
        const body = await res.json()
        message = body.error ?? message
      } catch {
        // ignore JSON parse errors
      }
      console.error(`[API] Error ${res.status}: ${message}`)
      throw new Error(message)
    }

    const data = await res.json()
    console.log(`[API] Response OK`)
    return data
  } catch (err) {
    // Handle network errors (CORS, connection refused, etc.)
    if (err instanceof TypeError && err.message.includes('fetch')) {
      console.error(`[API] Network error - check CORS or backend availability`)
      throw new Error('Cannot connect to backend. Check if the server is running and CORS is enabled.')
    }
    throw err
  }
}

export { API_BASE }


