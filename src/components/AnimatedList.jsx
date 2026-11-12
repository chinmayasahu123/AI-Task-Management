import { useEffect, useRef } from 'react'
import './AnimatedList.css'

const hiddenPositions = {
  pop: {
    above: 'translate3d(0, -12px, 0) scale(0.8)',
    below: 'translate3d(0, 12px, 0) scale(0.8)',
    duration: 620,
  },
  slide: {
    above: 'translate3d(0, -28px, 0) scale(0.98)',
    below: 'translate3d(0, 28px, 0) scale(0.98)',
    duration: 620,
  },
  fade: {
    above: 'translate3d(0, -4px, 0)',
    below: 'translate3d(0, 4px, 0)',
    duration: 300,
  },
}

const springEase = 'linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)'

function getScrollRoot(element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = window.getComputedStyle(parent)
    if (['auto', 'scroll'].includes(overflowY) && parent.scrollHeight > parent.clientHeight) return parent
  }
  return null
}

export default function AnimatedList({
  as: Element = 'div',
  children,
  animation = 'pop',
  animateOnce = true,
  stagger = 0.05,
  className = '',
  ...props
}) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root || animation === 'none' || !hiddenPositions[animation] || !('IntersectionObserver' in window)) {
      return undefined
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return undefined

    const rootMargin = getScrollRoot(root)
    const observed = new WeakSet()
    const activeAnimations = new Map()
    const easing = window.CSS?.supports?.('transition-timing-function', springEase)
      ? springEase
      : 'cubic-bezier(0.34, 1.4, 0.64, 1)'

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const item = entry.target
        if (!entry.isIntersecting) continue

        const existingAnimation = activeAnimations.get(item)
        existingAnimation?.cancel()
        const bounds = entry.rootBounds ?? {
          top: 0,
          bottom: window.innerHeight,
        }
        const itemCenter = entry.boundingClientRect.top + entry.boundingClientRect.height / 2
        const viewportCenter = bounds.top + (bounds.bottom - bounds.top) / 2
        const direction = itemCenter < viewportCenter ? 'above' : 'below'
        const settings = hiddenPositions[animation]
        item.classList.add('animated-list-motion-active')
        const nextAnimation = item.animate(
          [
            { opacity: 0, transform: settings[direction] },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
          ],
          {
            duration: settings.duration,
            delay: Math.max(0, stagger) * 1000 * Array.prototype.indexOf.call(root.children, item),
            easing,
            fill: 'none',
          },
        )
        activeAnimations.set(item, nextAnimation)
        nextAnimation.onfinish = () => {
          if (activeAnimations.get(item) === nextAnimation) {
            item.classList.remove('animated-list-motion-active')
            activeAnimations.delete(item)
          }
        }
        if (animateOnce) observer.unobserve(item)
      }
    }, { root: rootMargin, threshold: 0.12 })

    const observeChildren = () => {
      Array.from(root.children).forEach((child) => {
        if (observed.has(child)) return
        observed.add(child)
        observer.observe(child)
      })
    }

    observeChildren()
    const mutations = new MutationObserver(observeChildren)
    mutations.observe(root, { childList: true })

    return () => {
      mutations.disconnect()
      observer.disconnect()
      activeAnimations.forEach((currentAnimation, item) => {
        currentAnimation.cancel()
        item.classList.remove('animated-list-motion-active')
      })
      activeAnimations.clear()
    }
  }, [animation, animateOnce, stagger])

  return (
    <Element ref={rootRef} className={`animated-list${className ? ` ${className}` : ''}`} {...props}>
      {children}
    </Element>
  )
}
