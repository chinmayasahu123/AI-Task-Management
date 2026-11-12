import { useEffect, useState } from 'react'
import Icon from './Icon'
import './TimeWeather.css'

const IST_TIME_FORMAT = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Kolkata',
})

const WEATHER_CODES = {
  0: { label: 'Clear', icon: 'sun' },
  1: { label: 'Mostly clear', icon: 'sun' },
  2: { label: 'Partly cloudy', icon: 'partlyCloudy' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Foggy', icon: 'cloud' },
  48: { label: 'Foggy', icon: 'cloud' },
  51: { label: 'Drizzle', icon: 'rain' },
  53: { label: 'Drizzle', icon: 'rain' },
  55: { label: 'Heavy drizzle', icon: 'rain' },
  56: { label: 'Freezing drizzle', icon: 'rain' },
  57: { label: 'Freezing drizzle', icon: 'rain' },
  61: { label: 'Light rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  65: { label: 'Heavy rain', icon: 'rain' },
  66: { label: 'Freezing rain', icon: 'rain' },
  67: { label: 'Freezing rain', icon: 'rain' },
  71: { label: 'Light snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  75: { label: 'Heavy snow', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  80: { label: 'Rain showers', icon: 'rain' },
  81: { label: 'Rain showers', icon: 'rain' },
  82: { label: 'Heavy showers', icon: 'rain' },
  85: { label: 'Snow showers', icon: 'snow' },
  86: { label: 'Heavy snow showers', icon: 'snow' },
  95: { label: 'Thunderstorm', icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Thunderstorm with hail', icon: 'storm' },
}

function getLocationError(error) {
  if (error.code === 1) return 'Allow location access to see local weather.'
  if (error.code === 2) return 'Your location is unavailable right now.'
  if (error.code === 3) return 'Location lookup timed out. Try again.'
  return 'Unable to get your location. Try again.'
}

async function getWeather(latitude, longitude, signal) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code',
    timezone: 'Asia/Kolkata',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!response.ok) throw new Error(`Weather request failed (${response.status}).`)
  const result = await response.json()
  const temperature = result.current?.temperature_2m
  const code = result.current?.weather_code
  if (!Number.isFinite(temperature) || !Number.isInteger(code)) {
    throw new Error('Weather data was incomplete.')
  }
  return { temperature: Math.round(temperature), ...WEATHER_CODES[code] ?? { label: 'Weather', icon: 'sun' } }
}

export default function TimeWeather() {
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const supportsLocation = typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    if (!supportsLocation) return undefined

    let active = true
    const controller = new AbortController()

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const nextWeather = await getWeather(coords.latitude, coords.longitude, controller.signal)
          if (active) setWeather(nextWeather)
        } catch (error) {
          if (active && error.name !== 'AbortError') setWeatherError(error.message)
        } finally {
          if (active) setIsLoading(false)
        }
      },
      (error) => {
        if (!active) return
        setWeatherError(getLocationError(error))
        setIsLoading(false)
      },
      { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 10_000 },
    )

    return () => {
      active = false
      controller.abort()
    }
  }, [attempt, supportsLocation])

  const unavailableMessage = supportsLocation
    ? weatherError
    : 'This browser does not support location access.'

  return (
    <button
      aria-label={unavailableMessage ? `${unavailableMessage} Retry weather lookup` : `Time in India: ${IST_TIME_FORMAT.format(now)}. ${weather ? `${weather.temperature} degrees, ${weather.label}` : 'Weather loading'}`}
      className={`time-weather${unavailableMessage ? ' time-weather-error' : ''}`}
      onClick={() => {
        if (supportsLocation && weatherError) {
          setWeatherError('')
          setIsLoading(true)
          setAttempt((value) => value + 1)
        }
      }}
      title={unavailableMessage || `India Standard Time${weather ? ` · ${weather.label}` : ''}`}
      type="button"
    >
      <span className="time-weather-clock"><Icon name="clock" size={16} /><time dateTime={now.toISOString()}>{IST_TIME_FORMAT.format(now)}</time></span>
      <span className="time-weather-divider" aria-hidden="true" />
      {weather ? (
        <span className="time-weather-conditions">
          <Icon name={weather.icon} size={19} />
          <span className="time-weather-copy"><strong>{weather.temperature}°</strong><span>{weather.label}</span></span>
        </span>
      ) : (
        <span className="time-weather-loading">
          <Icon name="sun" size={18} />
          <span>{unavailableMessage ? 'Retry' : isLoading ? 'Weather…' : 'Unavailable'}</span>
        </span>
      )}
    </button>
  )
}
