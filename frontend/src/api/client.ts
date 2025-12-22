// Use empty string for relative URLs (uses Vite proxy in dev)
// In production, set VITE_API_BASE to the actual backend URL
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  console.log(`[API] ${init?.method ?? 'GET'} ${url}`, init?.body ? JSON.parse(init.body as string) : '')
  
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
      // ignore
    }
    console.error(`[API] Error: ${message}`)
    throw new Error(message)
  }

  const data = await res.json()
  console.log(`[API] Response:`, data)
  return data
}

export { API_BASE }


