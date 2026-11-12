import assert from 'node:assert/strict'
import test from 'node:test'
import { completeJson } from '../src/ai/gemini.js'
import { HttpError } from '../src/tasks/validation.js'

function geminiResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload
    },
  }
}

test('requires a server-side Gemini key before making provider requests', async () => {
  let fetchCalled = false
  await assert.rejects(
    completeJson([], { apiKey: '', fetchImpl: async () => { fetchCalled = true } }),
    (error) => error instanceof HttpError && error.status === 503,
  )
  assert.equal(fetchCalled, false)
})

test('sends a Gemini JSON request and parses its response', async () => {
  let capturedRequest
  const result = await completeJson([
    { role: 'system', content: 'Return JSON.' },
    { role: 'user', content: 'hello' },
  ], {
    apiKey: 'server-side-test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options }
      return geminiResponse(200, {
        candidates: [{ content: { parts: [{ text: '{"subtasks":["First","Second"]}' }] } }],
      })
    },
  })

  assert.equal(capturedRequest.url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent')
  assert.equal(capturedRequest.options.headers['x-goog-api-key'], 'server-side-test-key')
  const requestBody = JSON.parse(capturedRequest.options.body)
  assert.deepEqual(requestBody.systemInstruction.parts, [{ text: 'Return JSON.' }])
  assert.deepEqual(requestBody.contents, [{ role: 'user', parts: [{ text: 'hello' }] }])
  assert.equal(requestBody.generationConfig.responseMimeType, 'application/json')
  assert.deepEqual(result, { subtasks: ['First', 'Second'] })
})

test('does not expose provider credential errors to clients', async () => {
  await assert.rejects(
    completeJson([], {
      apiKey: 'invalid-test-key',
      fetchImpl: async () => geminiResponse(403, { error: { message: 'secret provider details' } }),
    }),
    (error) => error instanceof HttpError
      && error.status === 503
      && !error.message.includes('secret provider details'),
  )
})

test('rejects invalid provider JSON and translates network errors', async () => {
  await assert.rejects(
    completeJson([], {
      apiKey: 'test-key',
      fetchImpl: async () => geminiResponse(200, { candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
    }),
    (error) => error instanceof HttpError && error.status === 502,
  )
  await assert.rejects(
    completeJson([], {
      apiKey: 'test-key',
      fetchImpl: async () => { throw new Error('network internals') },
    }),
    (error) => error instanceof HttpError && error.status === 502 && !error.message.includes('network internals'),
  )
})
