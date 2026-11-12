import { HttpError } from '../tasks/validation.js'

const requestTimeoutMs = 20_000

export async function completeJson(messages, {
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) {
    throw new HttpError(503, 'AI features are not configured. Add GEMINI_API_KEY to backend/.env and restart the API.')
  }

  let response
  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: messages
              .filter((message) => message.role === 'system')
              .map((message) => ({ text: message.content })),
          },
          contents: messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(requestTimeoutMs),
      },
    )
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new HttpError(504, 'The AI request timed out. Please try again.')
    }
    throw new HttpError(502, 'The AI provider could not be reached. Please try again.')
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new HttpError(503, 'The AI provider rejected its credentials or model configuration. Check GEMINI_API_KEY and GEMINI_MODEL in backend/.env.')
    }
    if (response.status === 429) {
      throw new HttpError(503, 'The AI provider is busy or its quota is exhausted. Please try again later.')
    }
    throw new HttpError(502, 'The AI provider could not complete the request. Please try again.')
  }

  let result
  try {
    result = await response.json()
  } catch {
    throw new HttpError(502, 'The AI provider returned an invalid response. Please try again.')
  }

  const content = result.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter((text) => typeof text === 'string')
    .join('')
  if (!content) {
    throw new HttpError(502, 'The AI provider returned an empty response. Please try again.')
  }

  try {
    const parsed = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected an object.')
    }
    return parsed
  } catch {
    throw new HttpError(502, 'The AI provider returned an invalid response. Please try again.')
  }
}
