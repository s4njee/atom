import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { isEditableTarget } from './atom/core'
import { AtomScene } from './atom/scene'

const VISUALIZATION_LABELS = {
  3: 'ethylene',
  4: 'caffeine',
  5: 'epinephrine',
  6: 'buckminsterfullerene',
  7: 'capsaicin',
  8: 'mirtazapine',
  9: 'quetiapine',
  10: 'lsd',
  11: 'atropine',
  12: 'empagliflozin',
}

const VISUALIZATION_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1)

export default function App() {
  const [visualization, setVisualization] = useState(1)
  const [chromaticAberrationEnabled, setChromaticAberrationEnabled] = useState(false)
  const [xrayMode, setXrayMode] = useState(false)
  const chromaticAberrationEnabledRef = useRef(false)
  const xrayModeRef = useRef(false)
  const restoreChromaticAfterXrayRef = useRef(false)

  useEffect(() => {
    chromaticAberrationEnabledRef.current = chromaticAberrationEnabled
  }, [chromaticAberrationEnabled])

  useEffect(() => {
    xrayModeRef.current = xrayMode
  }, [xrayMode])

  useEffect(() => {
    const toggleChromaticAberration = () => {
      setChromaticAberrationEnabled((enabled) => {
        const nextValue = !enabled
        chromaticAberrationEnabledRef.current = nextValue
        return nextValue
      })
    }

    const toggleXrayMode = () => {
      if (xrayModeRef.current) {
        xrayModeRef.current = false
        setXrayMode(false)

        if (restoreChromaticAfterXrayRef.current) {
          restoreChromaticAfterXrayRef.current = false
          chromaticAberrationEnabledRef.current = true
          setChromaticAberrationEnabled(true)
        }

        return
      }

      restoreChromaticAfterXrayRef.current = chromaticAberrationEnabledRef.current

      if (chromaticAberrationEnabledRef.current) {
        chromaticAberrationEnabledRef.current = false
        setChromaticAberrationEnabled(false)
      }

      xrayModeRef.current = true
      setXrayMode(true)
    }

    const onKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      if (event.key === 'c' || event.key === 'C') {
        toggleChromaticAberration()
        return
      }

      if (event.key === 'x' || event.key === 'X') {
        toggleXrayMode()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const label = VISUALIZATION_LABELS[visualization] ?? ''

  return (
    <main className="app-shell">
      <Canvas camera={{ position: [0, 0.2, 8.5], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={['#040913']} />
        <AtomScene
          chromaticAberrationEnabled={chromaticAberrationEnabled}
          visualization={visualization}
          xrayMode={xrayMode}
        />
      </Canvas>

      {label ? <div className="visualization-label">{label}</div> : null}

      <div className="visualization-nav">
        {VISUALIZATION_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            className={`visualization-button ${visualization === value ? 'is-active' : ''}`}
            onClick={() => setVisualization(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </main>
  )
}
