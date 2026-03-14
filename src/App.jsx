import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  APP_HOTKEYS,
  CAMERA_DEFAULTS,
  EFFECT_DEFAULTS,
  SCENE_DEFAULTS,
  XRAY_DEFAULTS,
} from './atom/config'
import { isEditableTarget } from './atom/core'
import { AtomGuiControls } from './atom/gui'
import { AtomScene } from './atom/scene'
import {
  DEFAULT_VISUALIZATION,
  VISUALIZATION_LABELS,
  VISUALIZATION_OPTIONS,
} from './atom/visualizations'

export default function App() {
  const [visualization, setVisualization] = useState(DEFAULT_VISUALIZATION)
  const [chromaticAberrationEnabled, setChromaticAberrationEnabled] = useState(false)
  const [xrayMode, setXrayMode] = useState(false)
  const [sceneSettings, setSceneSettings] = useState(SCENE_DEFAULTS)
  const [effectSettings, setEffectSettings] = useState(EFFECT_DEFAULTS)
  const [xraySettings, setXraySettings] = useState(XRAY_DEFAULTS)
  const chromaticAberrationEnabledRef = useRef(false)
  const xrayModeRef = useRef(false)
  const restoreChromaticAfterXrayRef = useRef(false)

  useEffect(() => {
    chromaticAberrationEnabledRef.current = chromaticAberrationEnabled
  }, [chromaticAberrationEnabled])

  useEffect(() => {
    xrayModeRef.current = xrayMode
  }, [xrayMode])

  const setChromaticAberrationValue = useCallback((enabled) => {
    chromaticAberrationEnabledRef.current = enabled
    setChromaticAberrationEnabled(enabled)
  }, [])

  const setXrayModeValue = useCallback((enabled) => {
    xrayModeRef.current = enabled
    setXrayMode(enabled)
  }, [])

  const updateChromaticAberration = useCallback((enabled) => {
    if (enabled && xrayModeRef.current) {
      restoreChromaticAfterXrayRef.current = false
      setXrayModeValue(false)
    }

    setChromaticAberrationValue(enabled)
  }, [setChromaticAberrationValue, setXrayModeValue])

  const updateXrayMode = useCallback((enabled) => {
    if (!enabled) {
      if (!xrayModeRef.current) return

      setXrayModeValue(false)

      if (restoreChromaticAfterXrayRef.current) {
        restoreChromaticAfterXrayRef.current = false
        setChromaticAberrationValue(true)
      }

      return
    }

    if (xrayModeRef.current) return

    restoreChromaticAfterXrayRef.current = chromaticAberrationEnabledRef.current

    if (chromaticAberrationEnabledRef.current) {
      setChromaticAberrationValue(false)
    }

    setXrayModeValue(true)
  }, [setChromaticAberrationValue, setXrayModeValue])

  const toggleChromaticAberration = useCallback(() => {
    updateChromaticAberration(!chromaticAberrationEnabledRef.current)
  }, [updateChromaticAberration])

  const toggleXrayMode = useCallback(() => {
    updateXrayMode(!xrayModeRef.current)
  }, [updateXrayMode])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      if (
        event.key === APP_HOTKEYS.chromaticAberration ||
        event.key === APP_HOTKEYS.chromaticAberration.toUpperCase()
      ) {
        toggleChromaticAberration()
        return
      }

      if (event.key === APP_HOTKEYS.xrayMode || event.key === APP_HOTKEYS.xrayMode.toUpperCase()) {
        toggleXrayMode()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleChromaticAberration, toggleXrayMode])
  const label = VISUALIZATION_LABELS[visualization] ?? ''

  return (
    <main className="app-shell">
      <Canvas camera={CAMERA_DEFAULTS} gl={{ antialias: true }}>
        <AtomScene
          chromaticAberrationEnabled={chromaticAberrationEnabled}
          effectSettings={effectSettings}
          sceneSettings={sceneSettings}
          visualization={visualization}
          xrayMode={xrayMode}
          xraySettings={xraySettings}
        />
      </Canvas>

      <AtomGuiControls
        chromaticAberrationEnabled={chromaticAberrationEnabled}
        effectSettings={effectSettings}
        sceneSettings={sceneSettings}
        setEffectSettings={setEffectSettings}
        setSceneSettings={setSceneSettings}
        setVisualization={setVisualization}
        setXraySettings={setXraySettings}
        updateChromaticAberration={updateChromaticAberration}
        updateXrayMode={updateXrayMode}
        visualization={visualization}
        xrayMode={xrayMode}
        xraySettings={xraySettings}
      />

      {label ? <div className="visualization-label">{label}</div> : null}

      <div className="visualization-nav">
        {VISUALIZATION_OPTIONS.map(({ value, label: optionLabel }) => (
          <button
            key={value}
            type="button"
            title={optionLabel}
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
