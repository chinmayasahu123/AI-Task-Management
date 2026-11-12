export async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = new Error(body.error || `Request failed with status ${response.status}`)
    error.status = response.status
    throw error
  }
  const body = await response.text()
  return body ? JSON.parse(body) : undefined
}
