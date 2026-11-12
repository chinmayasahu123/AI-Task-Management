/* global __ENV */
import http from 'k6/http'
import { check, sleep } from 'k6'

const baseUrl = __ENV.BASE_URL || 'http://localhost:8080'
const email = __ENV.TEST_EMAIL
const password = __ENV.TEST_PASSWORD
const vus = Number(__ENV.VUS || 10)
let sessionReady = false

if (!email || !password) throw new Error('Set TEST_EMAIL and TEST_PASSWORD for a dedicated load-test account.')

export const options = {
  scenarios: {
    login_and_workspace_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: vus },
        { duration: '2m', target: vus },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1000'],
  },
}

export default function () {
  if (!sessionReady) {
    const login = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({ email, password }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { operation: 'login' },
    })
    sessionReady = check(login, { 'login succeeded': (response) => response.status === 200 })
    if (!sessionReady) return
  }

  const session = http.get(`${baseUrl}/api/auth/me`, { tags: { operation: 'session_check' } })
  check(session, { 'session check succeeded': (response) => response.status === 200 })
  sessionReady = session.status === 200
  const tasks = http.get(`${baseUrl}/api/tasks`, { tags: { operation: 'task_list' } })
  check(tasks, { 'task list succeeded': (response) => response.status === 200 })
  sleep(1)
}
