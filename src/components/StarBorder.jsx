import { useEffect, useRef } from 'react'
import './StarBorder.css'

const THEMES = {
  dark: {
    surface: '#0c0c0f',
    text: '#fafafa',
    track: 'rgba(255, 255, 255, 0.1)',
    light: '#ffffff',
  },
  light: {
    surface: '#ffffff',
    text: '#18181b',
    track: 'rgba(24, 24, 27, 0.12)',
    light: '#18181b',
  },
}

const HOVERS = new Set(['lap', 'brighten', 'reveal', 'none'])
const BLEED = 28
const TAU = Math.PI * 2
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const wrap = (value, total) => ((value % total) + total) % total

function colorToRgb(color, context) {
  context.fillStyle = '#ffffff'
  context.fillStyle = color
  const value = String(context.fillStyle)
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const normalized = hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex
    const number = Number.parseInt(normalized.slice(0, 6), 16)
    if (Number.isFinite(number)) return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
  }
  const channels = value.match(/[\d.]+/g)?.map(Number)
  return channels?.length >= 3 ? channels.slice(0, 3) : [255, 255, 255]
}

function rgba([red, green, blue], alpha) {
  return `rgba(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)}, ${clamp(alpha, 0, 1)})`
}

function getOutline(width, height, radius) {
  const r = clamp(radius, 0, Math.min(width / 2, height / 2))
  const arc = Math.PI * r / 2
  const across = Math.max(0, width - 2 * r)
  const down = Math.max(0, height - 2 * r)
  const segments = [
    { length: across, x: r, y: 0, dx: 1, dy: 0 },
    { length: arc, x: width - r, y: r, angle: -Math.PI / 2 },
    { length: down, x: width, y: r, dx: 0, dy: 1 },
    { length: arc, x: width - r, y: height - r, angle: 0 },
    { length: across, x: width - r, y: height, dx: -1, dy: 0 },
    { length: arc, x: r, y: height - r, angle: Math.PI / 2 },
    { length: down, x: 0, y: height - r, dx: 0, dy: -1 },
    { length: arc, x: r, y: r, angle: Math.PI },
  ]
  return {
    radius: r,
    segments,
    total: Math.max(1, segments.reduce((sum, segment) => sum + segment.length, 0)),
  }
}

function pointAt(shape, distance) {
  let remaining = wrap(distance, shape.total)
  for (const segment of shape.segments) {
    if (segment.length > 0 && remaining <= segment.length) {
      if (segment.angle === undefined) {
        return {
          x: segment.x + segment.dx * remaining,
          y: segment.y + segment.dy * remaining,
        }
      }
      const angle = segment.angle + remaining / shape.radius
      return {
        x: segment.x + Math.cos(angle) * shape.radius,
        y: segment.y + Math.sin(angle) * shape.radius,
      }
    }
    remaining -= segment.length
  }
  return { x: 0, y: 0 }
}

export default function StarBorder({
  as: Component = 'button',
  children,
  className = '',
  style,
  color,
  trailColor,
  duration = 4,
  thickness = 1,
  radius = 12,
  trailLength = 0.3,
  stars = 1,
  glow = 0.6,
  sparkle = false,
  direction = 'clockwise',
  hover = 'lap',
  clickPulse = true,
  theme = 'dark',
  backgroundColor,
  textColor,
  borderColor,
  ...rest
}) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const wakeRef = useRef(null)
  const palette = THEMES[theme] ?? THEMES.dark
  const settings = {
    color: color ?? palette.light,
    trailColor: trailColor ?? color ?? palette.light,
    duration: Math.max(0.3, duration),
    thickness: Math.max(0.5, thickness),
    radius: Math.max(0, radius),
    trailLength: clamp(trailLength, 0, 1),
    stars: clamp(Math.round(stars), 1, 6),
    glow: clamp(glow, 0, 1),
    sparkle,
    direction: direction === 'counterclockwise' ? -1 : 1,
    hover: HOVERS.has(hover) ? hover : 'lap',
    clickPulse,
  }
  const settingsRef = useRef(settings)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!root || !canvas || !context) return undefined

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const state = {
      width: 0,
      height: 0,
      ratio: 1,
      phase: 0,
      lastTime: performance.now(),
      hovered: false,
      focused: false,
      visible: true,
      lapTime: 0,
      boost: 0,
      reveal: 1,
    }
    const pulses = []
    let headColor = [255, 255, 255]
    let tailColor = [255, 255, 255]
    let colorKey = ''
    let frameId = 0
    let alive = true

    function resize() {
      state.width = root.offsetWidth
      state.height = root.offsetHeight
      state.ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round((state.width + BLEED * 2) * state.ratio))
      canvas.height = Math.max(1, Math.round((state.height + BLEED * 2) * state.ratio))
      wake()
    }

    function drawTrail(shape, head, length, sign, strength, s) {
      if (length < 0.5 || strength <= 0) return
      const steps = clamp(Math.ceil(length / 3), 2, 80)
      let previous = pointAt(shape, head)
      for (let index = 1; index <= steps; index++) {
        const progress = index / steps
        const current = pointAt(shape, head - sign * length * progress)
        const fade = (1 - (index - 0.5) / steps) ** 2 * strength
        context.beginPath()
        context.moveTo(previous.x, previous.y)
        context.lineTo(current.x, current.y)
        context.lineCap = 'round'
        context.lineWidth = s.thickness + 2 + s.glow * 5
        context.strokeStyle = rgba(headColor, fade * s.glow * 0.3)
        context.stroke()
        context.lineWidth = s.thickness
        context.strokeStyle = rgba(tailColor, fade)
        context.stroke()
        previous = current
      }
    }

    function drawHead(point, strength, time, s) {
      if (strength <= 0) return
      const reach = 9 + s.glow * 25
      const bloom = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, reach)
      bloom.addColorStop(0, rgba(headColor, strength * s.glow * 0.52))
      bloom.addColorStop(0.32, rgba(headColor, strength * s.glow * 0.2))
      bloom.addColorStop(1, rgba(headColor, 0))
      context.fillStyle = bloom
      context.fillRect(point.x - reach, point.y - reach, reach * 2, reach * 2)
      context.beginPath()
      const size = s.thickness + 1.2
      context.arc(point.x, point.y, size, 0, TAU)
      context.fillStyle = rgba(headColor, strength * 0.9)
      context.fill()

      if (s.sparkle) {
        const twinkle = 0.65 + 0.35 * Math.sin(time * 8)
        context.beginPath()
        context.moveTo(point.x - size * 3 * twinkle, point.y)
        context.lineTo(point.x + size * 3 * twinkle, point.y)
        context.moveTo(point.x, point.y - size * 3 * twinkle)
        context.lineTo(point.x, point.y + size * 3 * twinkle)
        context.strokeStyle = rgba(headColor, strength * 0.8)
        context.lineWidth = 0.8
        context.stroke()
      }
    }

    function frame(now) {
      frameId = 0
      if (!alive || !state.visible) return
      const s = settingsRef.current
      const dt = clamp((now - state.lastTime) / 1000, 0.001, 0.05)
      state.lastTime = now
      const nextKey = `${s.color}|${s.trailColor}`
      if (nextKey !== colorKey) {
        colorKey = nextKey
        headColor = colorToRgb(s.color, context)
        tailColor = colorToRgb(s.trailColor, context)
      }

      const inset = s.thickness / 2
      const shape = getOutline(
        Math.max(1, state.width - s.thickness),
        Math.max(1, state.height - s.thickness),
        Math.max(0, s.radius - inset),
      )
      const engaged = state.hovered || state.focused
      const revealTarget = s.hover === 'reveal' && !engaged ? 0 : 1
      state.reveal += (revealTarget - state.reveal) * (1 - Math.exp(-dt / 0.16))
      const boostTarget = s.hover === 'brighten' && engaged ? 1 : 0
      state.boost += (boostTarget - state.boost) * (1 - Math.exp(-dt / 0.18))
      state.lapTime = Math.max(0, state.lapTime - dt)
      const speed = reduceMotion ? 0 : shape.total / s.duration * s.direction
      state.phase = wrap(state.phase + speed * dt, shape.total)

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(state.ratio, 0, 0, state.ratio, BLEED * state.ratio, BLEED * state.ratio)
      const visible = state.reveal * (1 + state.boost * 0.35)
      const spacing = shape.total / s.stars
      const trail = Math.min(shape.total * s.trailLength, spacing * 0.9)

      for (let index = 0; index < s.stars; index++) {
        const head = state.phase + spacing * index
        drawTrail(shape, head, trail, s.direction, visible, s)
        drawHead(pointAt(shape, head), visible, now / 1000 + index, s)
      }

      const extras = state.lapTime > 0 ? 1 - state.lapTime / 0.9 : 0
      if (extras > 0) {
        const lapPoint = pointAt(shape, state.phase + shape.total * extras)
        drawTrail(shape, state.phase + shape.total * extras, trail * 0.75, s.direction, 1 - extras * 0.4, s)
        drawHead(lapPoint, 1 - extras * 0.4, now / 1000, s)
      }

      for (let index = pulses.length - 1; index >= 0; index--) {
        const pulse = pulses[index]
        pulse.age += dt
        if (pulse.age >= 0.65) {
          pulses.splice(index, 1)
          continue
        }
        const progress = pulse.age / 0.65
        const travel = shape.total * 0.5 * (1 - (1 - progress) ** 2)
        for (const sign of [-1, 1]) {
          const head = pulse.origin + sign * travel
          drawTrail(shape, head, Math.min(travel, shape.total * 0.14), sign, (1 - progress) ** 2, s)
          drawHead(pointAt(shape, head), (1 - progress) ** 2, now / 1000, s)
        }
      }

      if (state.width > 0 && state.height > 0) {
        context.beginPath()
        context.roundRect(inset, inset, Math.max(1, state.width - s.thickness), Math.max(1, state.height - s.thickness), shape.radius)
        context.strokeStyle = rgba(headColor, (state.boost * 0.16 + pulses.length * 0.04) * s.glow)
        context.lineWidth = s.thickness + s.glow * 2
        context.stroke()
      }

      const moving = !reduceMotion && state.reveal > 0.01
      const settling = Math.abs(revealTarget - state.reveal) > 0.002
        || Math.abs(boostTarget - state.boost) > 0.002
        || state.lapTime > 0
        || pulses.length > 0
      if (moving || settling || state.hovered) frameId = requestAnimationFrame(frame)
    }

    function wake() {
      if (!alive || !state.visible || frameId) return
      state.lastTime = performance.now()
      frameId = requestAnimationFrame(frame)
    }

    function onEnter() {
      state.hovered = true
      if (settingsRef.current.hover === 'lap' && !reduceMotion) state.lapTime = 0.9
      wake()
    }
    function onLeave() {
      state.hovered = false
      wake()
    }
    function onFocus() {
      state.focused = root.matches(':focus-visible')
      if (state.focused) state.hovered = true
      if (state.focused && settingsRef.current.hover === 'lap' && !reduceMotion) state.lapTime = 0.9
      wake()
    }
    function onBlur() {
      state.focused = false
      state.hovered = false
      wake()
    }
    function onPointerDown(event) {
      if (!settingsRef.current.clickPulse || (event.pointerType === 'mouse' && event.button !== 0)) return
      const bounds = root.getBoundingClientRect()
      const scaleX = bounds.width ? state.width / bounds.width : 1
      const scaleY = bounds.height ? state.height / bounds.height : 1
      const currentSettings = settingsRef.current
      const x = (event.clientX - bounds.left) * scaleX - currentSettings.thickness / 2
      const y = (event.clientY - bounds.top) * scaleY - currentSettings.thickness / 2
      const currentShape = shapeForCurrent()
      const projected = findNearestDistance(currentShape, x, y)
      pulses.push({ origin: projected, age: 0 })
      if (pulses.length > 4) pulses.shift()
      wake()
    }

    function shapeForCurrent() {
      const s = settingsRef.current
      return getOutline(
        Math.max(1, state.width - s.thickness),
        Math.max(1, state.height - s.thickness),
        Math.max(0, s.radius - s.thickness / 2),
      )
    }

    function findNearestDistance(shape, x, y) {
      let bestDistance = Infinity
      let bestOffset = 0
      let offset = 0
      for (const segment of shape.segments) {
        if (segment.length > 0) {
          let along
          let px
          let py
          if (segment.angle === undefined) {
            along = clamp((x - segment.x) * segment.dx + (y - segment.y) * segment.dy, 0, segment.length)
            px = segment.x + segment.dx * along
            py = segment.y + segment.dy * along
          } else {
            const angle = wrap(Math.atan2(y - segment.y, x - segment.x) - segment.angle, TAU)
            const boundedAngle = angle > Math.PI / 2 ? Math.PI / 2 : angle
            along = boundedAngle * shape.radius
            px = segment.x + Math.cos(segment.angle + boundedAngle) * shape.radius
            py = segment.y + Math.sin(segment.angle + boundedAngle) * shape.radius
          }
          const distance = (x - px) ** 2 + (y - py) ** 2
          if (distance < bestDistance) {
            bestDistance = distance
            bestOffset = offset + along
          }
        }
        offset += segment.length
      }
      return bestOffset
    }

    const resizeObserver = new ResizeObserver(resize)
    const intersectionObserver = new IntersectionObserver((entries) => {
      state.visible = entries.some((entry) => entry.isIntersecting)
      if (state.visible) wake()
      else if (frameId) {
        cancelAnimationFrame(frameId)
        frameId = 0
      }
    })
    resizeObserver.observe(root)
    intersectionObserver.observe(root)
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('focus', onFocus)
    root.addEventListener('blur', onBlur)
    resize()
    wake()

    return () => {
      alive = false
      if (frameId) cancelAnimationFrame(frameId)
      wakeRef.current = null
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('focus', onFocus)
      root.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    settingsRef.current = settings
    wakeRef.current?.()
  })

  const componentProps = Component === 'button' && rest.type === undefined
    ? { type: 'button', ...rest }
    : rest

  return (
    <Component
      ref={rootRef}
      className={`star-border${className ? ` ${className}` : ''}`}
      style={{
        '--star-border-radius': `${settings.radius}px`,
        '--star-border-thickness': `${settings.thickness}px`,
        '--star-border-surface': backgroundColor ?? palette.surface,
        '--star-border-text': textColor ?? palette.text,
        '--star-border-track': borderColor ?? palette.track,
        ...style,
      }}
      {...componentProps}
    >
      <canvas ref={canvasRef} className="star-border__light" aria-hidden="true" />
      <span className="star-border__content">{children}</span>
    </Component>
  )
}
