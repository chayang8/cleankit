import { useEffect, useRef, useState } from 'react'

/**
 * Broomy — the CleanKit mascot.
 *
 * It chases the pointer with a spring-ish easing loop driven by rAF, blinks on a
 * random timer, and squishes while it is actively catching up. Pointer position
 * lives in a ref (not state) so mouse moves never trigger a React render; only
 * the ~60fps transform write touches the DOM.
 */
export function Mascot() {
  const mascotRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: -100, y: -100 })
  const position = useRef({ x: -100, y: -100 })
  const [awake, setAwake] = useState(false)
  const [blinking, setBlinking] = useState(false)
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    const onPointerMove = (event: PointerEvent) => {
      target.current = { x: event.clientX, y: event.clientY }
      setAwake(true)
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    let frame = 0
    const tick = () => {
      const dx = target.current.x - position.current.x
      const dy = target.current.y - position.current.y

      // Trail a little behind the cursor so it reads as "following", not "attached".
      position.current.x += dx * 0.12
      position.current.y += dy * 0.12

      const distance = Math.hypot(dx, dy)
      setMoving(distance > 6)

      const node = mascotRef.current
      if (node) {
        // Lean into the direction of travel; clamp so it never looks broken.
        const tilt = Math.max(-18, Math.min(18, dx * 0.25))
        const squish = Math.min(0.18, distance / 900)
        node.style.transform =
          `translate3d(${position.current.x}px, ${position.current.y}px, 0) ` +
          `rotate(${tilt}deg) scale(${1 + squish}, ${1 - squish})`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    let timeout: number
    const scheduleBlink = () => {
      timeout = window.setTimeout(() => {
        setBlinking(true)
        window.setTimeout(() => setBlinking(false), 140)
        scheduleBlink()
      }, 1800 + Math.random() * 3200)
    }
    scheduleBlink()
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <div
      ref={mascotRef}
      className={`mascot ${awake ? 'is-awake' : ''} ${moving ? 'is-moving' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" width="56" height="56" role="presentation">
        <defs>
          <radialGradient id="mascot-body" cx="35%" cy="30%">
            <stop offset="0%" stopColor="var(--mascot-highlight)" />
            <stop offset="100%" stopColor="var(--mascot-body)" />
          </radialGradient>
        </defs>
        <ellipse cx="32" cy="55" rx="15" ry="4" className="mascot-shadow" />
        <path
          d="M32 8c11 0 19 8.5 19 20 0 9-3 14-3 20 0 3-2 5-5 4l-4-1.5-4 2c-2 1-4 1-6 0l-4-2-4 1.5c-3 1-5-1-5-4 0-6-3-11-3-20C13 16.5 21 8 32 8Z"
          fill="url(#mascot-body)"
        />
        <ellipse cx="25" cy="28" rx="4.2" ry={blinking ? 0.6 : 4.6} className="mascot-eye" />
        <ellipse cx="39" cy="28" rx="4.2" ry={blinking ? 0.6 : 4.6} className="mascot-eye" />
        <circle cx="26.4" cy="26.6" r="1.5" className="mascot-glint" opacity={blinking ? 0 : 1} />
        <circle cx="40.4" cy="26.6" r="1.5" className="mascot-glint" opacity={blinking ? 0 : 1} />
        <path
          d={moving ? 'M27 38q5 6 10 0' : 'M27 39q5 3 10 0'}
          className="mascot-mouth"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="18" cy="34" r="2.6" className="mascot-blush" />
        <circle cx="46" cy="34" r="2.6" className="mascot-blush" />
      </svg>
    </div>
  )
}
