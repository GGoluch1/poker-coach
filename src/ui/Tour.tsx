import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TourStep } from './tourSteps'
import { markTourSeen } from './tourSteps'

/** Steps through `steps`, dimming the page and placing a card next to each step's target. */
export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  const finish = () => {
    markTourSeen()
    onClose()
  }

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(step.target)
    if (!el || !cardRef.current) return
    el.classList.add('tour-target')
    el.scrollIntoView({ block: 'center' })
    // Below the target, above it, then beside it; if nothing fits, overlap its top-left corner.
    const place = () => {
      const r = el.getBoundingClientRect()
      const card = cardRef.current!.getBoundingClientRect()
      const gap = 16
      const clampX = (x: number) => Math.min(Math.max(gap, x), innerWidth - card.width - gap)
      const clampY = (y: number) => Math.min(Math.max(gap, y), innerHeight - card.height - gap)
      if (r.bottom + gap + card.height <= innerHeight) {
        setPos({ top: r.bottom + gap, left: clampX(r.left) })
      } else if (r.top - gap - card.height >= gap) {
        setPos({ top: r.top - gap - card.height, left: clampX(r.left) })
      } else if (r.right + gap + card.width <= innerWidth - gap) {
        setPos({ top: clampY(r.top), left: r.right + gap })
      } else if (r.left - gap - card.width >= gap) {
        setPos({ top: clampY(r.top), left: r.left - gap - card.width })
      } else {
        setPos({ top: clampY(r.top + gap), left: clampX(r.left + gap) })
      }
    }
    place()
    nextRef.current?.focus({ preventScroll: true })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      el.classList.remove('tour-target')
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [step.target, index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        markTourSeen()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="tour-backdrop" onClick={finish} />
      <div
        ref={cardRef}
        className="tour-card"
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
      >
        <p className="tour-count">
          {index + 1} of {steps.length}
        </p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button className="btn btn-quiet btn-small" onClick={finish}>
            Skip
          </button>
          {index > 0 && (
            <button className="btn btn-small" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            ref={nextRef}
            className="btn btn-primary btn-small"
            onClick={() => (last ? finish() : setIndex(index + 1))}
          >
            {last ? 'Start playing' : 'Next'}
          </button>
        </div>
      </div>
    </>
  )
}
