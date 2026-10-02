import { useEffect, useMemo, useState } from 'react'
import Scene from './Scene.jsx'
import { profile, projects } from './content.js'
import { startScroll } from './scroll.js'

export default function App() {
  const [activeId, setActiveId] = useState(null)

  useEffect(() => startScroll(), [])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setActiveId(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // One entry per 3D stop. The scene and the text sections both read this
  // list, so object i always lines up with section i.
  const stops = useMemo(
    () => [
      { id: 'hero', shape: 'icosa' },
      ...projects.map((p) => ({ id: p.id, shape: p.shape, selectable: true })),
      { id: 'about', shape: 'blob' },
      { id: 'contact', shape: 'ring', center: true },
    ],
    [],
  )
  const active = projects.find((p) => p.id === activeId)

  return (
    <>
      <div className="canvas">
        <Scene items={stops} activeId={activeId} onSelect={setActiveId} />
      </div>

      <header className="nav">
        <span className="nav-name">{profile.name}</span>
        <a className="pill" href={`mailto:${profile.email}`}>
          Get in touch
        </a>
      </header>

      <main className="sections">
        <section className="section left">
          <div className="copy">
            <p className="label">{profile.role}</p>
            <h1>{profile.tagline}</h1>
            <p className="hint">Scroll to explore · move your mouse · click the objects</p>
          </div>
        </section>

        {projects.map((p, i) => (
          <section key={p.id} className={`section ${i % 2 === 0 ? 'right' : 'left'}`}>
            <div className="copy">
              <p className="label">
                {String(i + 1).padStart(2, '0')} / Project
              </p>
              <h2>{p.title}</h2>
              <p className="body">{p.blurb}</p>
              <ul className="tags">
                {p.stack.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <button className="pill" onClick={() => setActiveId(p.id)}>
                View project
              </button>
            </div>
          </section>
        ))}

        <section className="section left">
          <div className="copy">
            <p className="label">About</p>
            <h2>{profile.name}</h2>
            <p className="body">{profile.about}</p>
          </div>
        </section>

        <section className="section bottom">
          <div className="copy center">
            <p className="label">Contact</p>
            <h2>Let&rsquo;s build something.</h2>
            <a className="pill solid" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
            <div className="links">
              {profile.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      {active && (
        <div className="overlay" onClick={() => setActiveId(null)}>
          <div className="card" role="dialog" aria-label={active.title} onClick={(e) => e.stopPropagation()}>
            <p className="label">Project</p>
            <h3>{active.title}</h3>
            <p className="body">{active.blurb}</p>
            <ul className="tags">
              {active.stack.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div className="row">
              <a className="pill solid" href={active.href} target="_blank" rel="noreferrer">
                Open
              </a>
              <button className="pill" onClick={() => setActiveId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
