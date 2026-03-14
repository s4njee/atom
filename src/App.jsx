import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import {
  CAMERA_DEFAULTS,
  EFFECT_DEFAULTS,
  SCENE_DEFAULTS,
  XRAY_DEFAULTS,
} from './atom/config'
import { AtomGuiControls } from './atom/gui'
import { AtomScene } from './atom/scene'
import {
  createInitialSharedSpecialEffectState,
  createSharedEffectHotkeyListener,
  createSharedSpecialEffectHandlers,
  isEditableTarget,
  setSharedChromaticAberrationEnabled,
  setSharedXrayModeEnabled,
} from '../../../src/shared/special-effects/index.ts'
import {
  DEFAULT_VISUALIZATION,
  getNextVisualization,
  VISUALIZATION_LABELS,
  VISUALIZATION_OPTIONS,
} from './atom/visualizations'

export default function App() {
  const [visualization, setVisualization] = useState(DEFAULT_VISUALIZATION)
  const [sceneSettings, setSceneSettings] = useState(SCENE_DEFAULTS)
  const [effectSettings, setEffectSettings] = useState(EFFECT_DEFAULTS)
  const [xraySettings, setXraySettings] = useState(XRAY_DEFAULTS)
  const [specialEffects, setSpecialEffects] = useState(() => createInitialSharedSpecialEffectState())

  const updateChromaticAberration = (enabled) => {
    setSpecialEffects((current) => setSharedChromaticAberrationEnabled(current, enabled))
  }

  const updateXrayMode = (enabled) => {
    setSpecialEffects((current) => setSharedXrayModeEnabled(current, enabled))
  }

  useEffect(() => {
    const handleSharedEffectHotkey = createSharedEffectHotkeyListener(
      createSharedSpecialEffectHandlers(setSpecialEffects),
    )

    const onKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      // Keep the local molecule switcher separate from the global scene effect hotkeys.
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()

        const direction = event.key === 'ArrowRight' ? 1 : -1
        setVisualization((current) => getNextVisualization(current, direction))

        return
      }

      if (handleSharedEffectHotkey(event)) return
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const label = VISUALIZATION_LABELS[visualization] ?? ''

  return (
    <main className="app-shell">
      {/* The canvas owns the 3D scene; the controls stay outside so they do not rerender the scene tree. */}
      <Canvas camera={CAMERA_DEFAULTS} gl={{ antialias: true }}>
        <AtomScene
          chromaticAberrationEnabled={specialEffects.chromaticAberrationEnabled}
          effectSettings={effectSettings}
          sceneSettings={sceneSettings}
          specialEffects={specialEffects}
          visualization={visualization}
          xrayMode={specialEffects.xrayMode}
          xraySettings={xraySettings}
        />
      </Canvas>

      {/* Keep the GUI and quick-pick nav decoupled from scene rendering for readability. */}
      <AtomGuiControls
        chromaticAberrationEnabled={specialEffects.chromaticAberrationEnabled}
        effectSettings={effectSettings}
        sceneSettings={sceneSettings}
        setEffectSettings={setEffectSettings}
        setSceneSettings={setSceneSettings}
        setVisualization={setVisualization}
        setXraySettings={setXraySettings}
        updateChromaticAberration={updateChromaticAberration}
        updateXrayMode={updateXrayMode}
        visualization={visualization}
        xrayMode={specialEffects.xrayMode}
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
