import { useEffect, useRef } from 'react'
import './CursorGrid.css'

function colorWithAlpha(color, alpha) {
  if (/^#[\da-f]{3,8}$/i.test(color)) {
    let hex = color.slice(1)
    if (hex.length === 3) hex = [...hex].map((character) => character + character).join('')
    return `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${alpha})`
  }
  return color
}

export default function CursorGrid({
  cellSize = 60,
  color = '#6366f1',
  radius = 140,
  holdTime = 400,
  fadeDuration = 800,
  fillOpacity = 0.06,
  gridOpacity = 0.08,
  gridStyle = 'lines',
  highlight = 'area',
  clickPulse = true,
  className = '',
  style,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!container || !canvas || !context) return undefined

    const state = {
      width: 0,
      height: 0,
      ratio: 1,
      pointer: null,
      cells: new Map(),
      pulses: [],
      startedAt: performance.now(),
    }
    let frameId = 0

    const resize = () => {
      const bounds = container.getBoundingClientRect()
      state.width = Math.max(1, bounds.width)
      state.height = Math.max(1, bounds.height)
      state.ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(state.width * state.ratio)
      canvas.height = Math.round(state.height * state.ratio)
      context.setTransform(state.ratio, 0, 0, state.ratio, 0, 0)
      requestDraw()
    }

    const draw = (now) => {
      frameId = 0
      context.clearRect(0, 0, state.width, state.height)
      const size = Math.max(8, cellSize)
      const intro = Math.min(1, (now - state.startedAt) / 1400)
      const introAlpha = intro * gridOpacity
      context.lineWidth = 1
      context.strokeStyle = colorWithAlpha(color, introAlpha)

      if (gridStyle === 'dots') {
        context.fillStyle = colorWithAlpha(color, introAlpha * 1.8)
        for (let x = 0; x <= state.width; x += size) {
          for (let y = 0; y <= state.height; y += size) {
            context.beginPath()
            context.arc(x, y, 1.25, 0, Math.PI * 2)
            context.fill()
          }
        }
      } else {
        for (let x = 0; x <= state.width; x += size) {
          for (let y = 0; y <= state.height; y += size) {
            context.beginPath()
            if (gridStyle === 'crosses') {
              context.moveTo(x - 4, y)
              context.lineTo(x + 4, y)
              context.moveTo(x, y - 4)
              context.lineTo(x, y + 4)
            } else {
              if (gridStyle === 'dashed') context.setLineDash([4, 5])
              context.moveTo(x, y)
              context.lineTo(x + size, y)
              context.moveTo(x, y)
              context.lineTo(x, y + size)
              context.setLineDash([])
            }
            context.stroke()
          }
        }
      }

      let active = intro < 1
      const expiration = Math.max(16, fadeDuration)
      for (const [key, cell] of state.cells) {
        const age = now - cell.touchedAt
        if (age > holdTime + expiration) {
          state.cells.delete(key)
          continue
        }
        active = true
        const strength = age <= holdTime ? cell.strength : cell.strength * (1 - (age - holdTime) / expiration)
        const [column, row] = key.split(':').map(Number)
        const x = column * size
        const y = row * size
        context.fillStyle = colorWithAlpha(color, Math.max(0, strength * fillOpacity))
        context.fillRect(x + 1, y + 1, size - 2, size - 2)
        context.strokeStyle = colorWithAlpha(color, Math.max(0, strength * Math.min(0.7, gridOpacity * 7)))
        context.strokeRect(x + 0.5, y + 0.5, size, size)
      }

      if (state.pointer && gridStyle !== 'dots' && gridStyle !== 'crosses') {
        const gradient = context.createRadialGradient(
          state.pointer.x, state.pointer.y, 0,
          state.pointer.x, state.pointer.y, radius,
        )
        gradient.addColorStop(0, colorWithAlpha(color, 0.09))
        gradient.addColorStop(1, colorWithAlpha(color, 0))
        context.fillStyle = gradient
        context.fillRect(
          Math.max(0, state.pointer.x - radius),
          Math.max(0, state.pointer.y - radius),
          Math.min(state.width, radius * 2),
          Math.min(state.height, radius * 2),
        )
      }

      for (let index = state.pulses.length - 1; index >= 0; index--) {
        const pulse = state.pulses[index]
        const progress = Math.max(0, now - pulse.startedAt) / 900
        if (progress >= 1) {
          state.pulses.splice(index, 1)
          continue
        }
        active = true
        context.beginPath()
        context.arc(pulse.x, pulse.y, progress * Math.hypot(state.width, state.height) * 0.45, 0, Math.PI * 2)
        context.strokeStyle = colorWithAlpha(color, (1 - progress) * 0.38)
        context.lineWidth = 1.5
        context.stroke()
      }

      if (active) frameId = requestAnimationFrame(draw)
    }

    function requestDraw() {
      if (!frameId) frameId = requestAnimationFrame(draw)
    }

    const locate = (event) => {
      const bounds = container.getBoundingClientRect()
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return null
      return { x, y }
    }

    const onPointerMove = (event) => {
      const position = locate(event)
      state.pointer = position
      if (!position) return

      const columns = Math.ceil(state.width / Math.max(8, cellSize))
      const rows = Math.ceil(state.height / Math.max(8, cellSize))
      const centerColumn = Math.floor(position.x / Math.max(8, cellSize))
      const centerRow = Math.floor(position.y / Math.max(8, cellSize))
      const range = highlight === 'cell' ? 0 : Math.ceil(radius / Math.max(8, cellSize))
      const now = performance.now()
      for (let row = centerRow - range; row <= centerRow + range; row++) {
        for (let column = centerColumn - range; column <= centerColumn + range; column++) {
          if (column < 0 || row < 0 || column >= columns || row >= rows) continue
          const distance = Math.hypot(
            (column + 0.5) * cellSize - position.x,
            (row + 0.5) * cellSize - position.y,
          )
          if (highlight !== 'cell' && distance > radius) continue
          const strength = highlight === 'cell' ? 1 : Math.max(0, 1 - distance / radius)
          state.cells.set(`${column}:${row}`, { strength, touchedAt: now })
        }
      }
      requestDraw()
    }

    const onPointerDown = (event) => {
      if (!clickPulse || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const position = locate(event)
      if (!position) return
      state.pulses.push({ ...position, startedAt: performance.now() })
      requestDraw()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    resize()

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [cellSize, color, fillOpacity, fadeDuration, gridOpacity, gridStyle, highlight, holdTime, radius, clickPulse])

  return (
    <div
      ref={containerRef}
      className={`cursor-grid${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="cursor-grid__canvas" />
    </div>
  )
}
