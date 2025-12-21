const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000'

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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
    throw new Error(message)
  }

  return res.json()
}

export { API_BASE }


