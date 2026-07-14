import { useEffect, useState } from 'react'

/**
 * Fixed-row windowing primitive for future high-volume module renderers.
 * Keep source data in the semantic index; only pass the resulting visible range to the UI.
 */
export function useVirtualWindow(total: number, rowHeight: number, overscan = 4) {
  const [viewport, setViewport] = useState({ top: 0, height: typeof window === 'undefined' ? 900 : window.innerHeight })
  useEffect(() => {
    const update = () => setViewport({ top: window.scrollY, height: window.innerHeight })
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  const start = Math.max(0, Math.floor(viewport.top / rowHeight) - overscan)
  const end = Math.min(total, Math.ceil((viewport.top + viewport.height) / rowHeight) + overscan)
  return { start, end, offsetTop: start * rowHeight, offsetBottom: Math.max(0, (total - end) * rowHeight) }
}
