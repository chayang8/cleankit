import { useEffect, useRef, useState } from 'react'

/**
 * Doughy — the CleanKit mascot.
 *
 * A soft dumpling with a red scarf that chases the pointer. Motion is driven by
 * a rAF easing loop; the pointer position lives in a ref (not state) so mouse
 * moves never trigger a React render — only the per-frame transform write
 * touches the DOM. Blinks and the scarf flap are the only stateful bits.
 */
export function Mascot() {
  const mascotRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: -200, y: -200 })
  const position = useRef({ x: -200, y: -200 })
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
    let bob = 0
    let wasMoving = false

    const tick = () => {
      const dx = target.current.x - position.current.x
      const dy = target.current.y - position.current.y

      // Trail behind the cursor so it reads as "following", not "attached".
      position.current.x += dx * 0.11
      position.current.y += dy * 0.11

      const distance = Math.hypot(dx, dy)
      const isMoving = distance > 6
      if (isMoving !== wasMoving) {
        wasMoving = isMoving
        setMoving(isMoving)
      }

      bob += isMoving ? 0.22 : 0.055
      const node = mascotRef.current
      if (node) {
        // Lean into the direction of travel and squish like soft dough; the
        // idle bob keeps it alive when the pointer stops.
        const tilt = Math.max(-14, Math.min(14, dx * 0.16))
        const squish = Math.min(0.14, distance / 1100)
        const float = Math.sin(bob) * (isMoving ? 3 : 1.6)
        node.style.transform =
          `translate3d(${position.current.x}px, ${position.current.y + float}px, 0) ` +
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
        window.setTimeout(() => setBlinking(false), 130)
        scheduleBlink()
      }, 2000 + Math.random() * 3400)
    }
    scheduleBlink()
    return () => window.clearTimeout(timeout)
  }, [])

  const eyeRadius = blinking ? 0.5 : 3.4

  return (
    <div
      ref={mascotRef}
      className={`mascot ${awake ? 'is-awake' : ''} ${moving ? 'is-moving' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="-6 0 92 90" width="78" height="76" role="presentation">
        <defs>
          <radialGradient id="dough" cx="36%" cy="26%" r="82%">
            <stop offset="0%" stopColor="var(--mascot-highlight)" />
            <stop offset="58%" stopColor="var(--mascot-body)" />
            <stop offset="100%" stopColor="var(--mascot-shade)" />
          </radialGradient>
          <linearGradient id="scarf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mascot-scarf-light)" />
            <stop offset="100%" stopColor="var(--mascot-scarf)" />
          </linearGradient>
          <radialGradient id="halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--mascot-halo)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--mascot-halo)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="40" cy="44" r="40" fill="url(#halo)" />
        <ellipse cx="40" cy="81" rx="18" ry="3.4" className="mascot-shadow" />

        {/* feet */}
        <ellipse cx="31" cy="74" rx="8.2" ry="5.8" fill="url(#dough)" />
        <ellipse cx="49" cy="74" rx="8.2" ry="5.8" fill="url(#dough)" />

        {/* arms */}
        <g className="mascot-arms">
          <ellipse cx="20.5" cy="63" rx="5" ry="7" fill="url(#dough)" transform="rotate(8 20.5 63)" />
          <ellipse cx="59.5" cy="63" rx="5" ry="7" fill="url(#dough)" transform="rotate(-8 59.5 63)" />
        </g>

        {/* pinched dough tip */}
        <path d="M36.4 27c-.2-6 .6-10.2 3.6-13.4 3 3.2 3.8 7.4 3.6 13.4Z" fill="url(#dough)" />

        {/* body */}
        <ellipse cx="40" cy="48" rx="23" ry="24" fill="url(#dough)" />
        <ellipse cx="40" cy="64" rx="17" ry="8" className="mascot-underlight" />
        <ellipse cx="28" cy="34" rx="8" ry="5" className="mascot-sheen" transform="rotate(-24 28 34)" />

        {/* bandana */}
        <g className="mascot-scarf">
          <path d="M31.5 57.5q8.5 4.6 17 0-2.4 7.6-8.5 11.6-6.1-4-8.5-11.6Z" fill="url(#scarf)" />
          <path d="M26 53.5q14 8 28 0-.9 3.6-2.6 5.4-11.4 5.4-22.8 0-1.7-1.8-2.6-5.4Z" fill="url(#scarf)" />
          <path d="M26 53.5q14 8 28 0-.5 1.8-1.2 3-12.6 6.2-25.6 0-.7-1.2-1.2-3Z" className="mascot-scarf-shade" />
          <circle cx="53.4" cy="55.4" r="4.3" fill="url(#scarf)" />
          <path d="M57 58c4 1.6 6.6 4.4 7.6 8-3.8.2-7.4-1.6-9.4-4.4Z" fill="url(#scarf)" className="mascot-tail-a" />
          <path d="M59 54c3.8-.4 7.4.6 9.6 3.2-3 2-6.6 2.2-10.2 1.2Z" fill="url(#scarf)" className="mascot-tail-b" />
        </g>

        {/* face */}
        <ellipse cx="32" cy="44" rx="3.1" ry={eyeRadius} className="mascot-eye" />
        <ellipse cx="48" cy="44" rx="3.1" ry={eyeRadius} className="mascot-eye" />
        <circle cx="33.1" cy="42.7" r="1.05" className="mascot-glint" opacity={blinking ? 0 : 1} />
        <circle cx="49.1" cy="42.7" r="1.05" className="mascot-glint" opacity={blinking ? 0 : 1} />
        <ellipse cx="23.5" cy="48" rx="4" ry="2.9" className="mascot-blush" />
        <ellipse cx="56.5" cy="48" rx="4" ry="2.9" className="mascot-blush" />
        <path
          d={moving ? "M35.5 48.6q4.5 5.4 9 0" : "M35.5 49.5q4.5 3.4 9 0"}
          className="mascot-mouth"
          fill="none"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
