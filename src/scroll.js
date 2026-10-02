import Lenis from 'lenis'

// Shared scroll state read by the 3D scene every frame (no React re-renders).
export const scroll = { progress: 0 }

export function startScroll() {
  const lenis = new Lenis({ lerp: 0.085 })
  lenis.on('scroll', (l) => {
    scroll.progress = l.limit > 0 ? l.scroll / l.limit : 0
  })
  let raf
  const loop = (t) => {
    lenis.raf(t)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    lenis.destroy()
  }
}
