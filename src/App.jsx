import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import {
  CAMERA_DEFAULTS,
  EFFECT_DEFAULTS,
  SCENE_DEFAULTS,
  XRAY_DEFAULTS,
} from './atom/config'
import { isEditableTarget } from './atom/core'
import { AtomGuiControls } from './atom/gui'
import { AtomScene } from './atom/scene'
import {
  createSharedEffectHotkeyListener,
  setChromaticAberrationState,
  setXrayModeState,
  SHARED_FX_CINEMATIC,
  SHARED_FX_DATABEND,
  SHARED_FX_NONE,
  toggleHueCycleState,
  toggleSharedFxMode,
} from '../../../src/shared/special-effects/shared-special-effects.ts'
import {
  DEFAULT_VISUALIZATION,
  VISUALIZATION_LABELS,
  VISUALIZATION_OPTIONS,
} from './atom/visualizations'

export default function App() {
  const [visualization, setVisualization] = useState(DEFAULT_VISUALIZATION)
  const [sceneSettings, setSceneSettings] = useState(SCENE_DEFAULTS)
  const [effectSettings, setEffectSettings] = useState(EFFECT_DEFAULTS)
  const [xraySettings, setXraySettings] = useState(XRAY_DEFAULTS)
  const [specialEffects, setSpecialEffects] = useState({
    chromaticAberrationEnabled: false,
    currentFx: SHARED_FX_NONE,
    hue: 0,
    hueCycleBaseHue: 0,
    hueCycleEnabled: false,
    hueCycleSavedEnabled: false,
    hueCycleSavedHue: 0,
    hueCycleSavedSaturation: 0,
    hueCycleStartTime: 0,
    hueSatEnabled: false,
    pixelMosaicEnabled: false,
    restoreChromaticAfterXray: false,
    saturation: 0,
    thermalVisionEnabled: false,
    xrayMode: false,
  })

  const updateChromaticAberration = (enabled) => {
    setSpecialEffects((current) => ({
      ...current,
      ...setChromaticAberrationState(current, enabled),
    }))
  }

  const updateXrayMode = (enabled) => {
    setSpecialEffects((current) => ({
      ...current,
      ...setXrayModeState(current, enabled),
    }))
  }

  useEffect(() => {
    const handleSharedEffectHotkey = createSharedEffectHotkeyListener({
      cinematic: () => {
        setSpecialEffects((current) => ({
          ...current,
          currentFx: toggleSharedFxMode(current.currentFx, SHARED_FX_CINEMATIC),
        }))
      },
      chromaticAberration: () => {
        updateChromaticAberration(!specialEffects.chromaticAberrationEnabled)
      },
      databend: () => {
        setSpecialEffects((current) => ({
          ...current,
          currentFx: toggleSharedFxMode(current.currentFx, SHARED_FX_DATABEND),
        }))
      },
      hueCycle: () => {
        setSpecialEffects((current) => ({
          ...current,
          ...toggleHueCycleState(current, performance.now() / 1000),
        }))
      },
      pixelMosaic: () => {
        setSpecialEffects((current) => ({
          ...current,
          pixelMosaicEnabled: !current.pixelMosaicEnabled,
        }))
      },
      thermalVision: () => {
        setSpecialEffects((current) => ({
          ...current,
          thermalVisionEnabled: !current.thermalVisionEnabled,
        }))
      },
      xrayMode: () => {
        updateXrayMode(!specialEffects.xrayMode)
      },
    })

    const onKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      if (handleSharedEffectHotkey(event)) return
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [specialEffects.chromaticAberrationEnabled, specialEffects.xrayMode])
  const label = VISUALIZATION_LABELS[visualization] ?? ''

  return (
    <main className="app-shell">
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
