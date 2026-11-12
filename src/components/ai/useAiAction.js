import { useState } from 'react'
import { requestJson } from '../../api/client'

export default function useAiAction() {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  async function run(path, body) {
    setIsRunning(true)
    setError('')
    try {
      const response = await requestJson(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setResult(response)
      return response
    } catch (requestError) {
      setError(requestError.message)
      setResult(null)
      return null
    } finally {
      setIsRunning(false)
    }
  }

  return { result, error, isRunning, run }
}
