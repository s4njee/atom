import { useCallback, useEffect, useState } from 'react'
import './styles.css'
import {
  APP_HOTKEYS,
  CAMERA_DEFAULTS,
  EFFECT_DEFAULTS,
  SCENE_DEFAULTS,
  XRAY_DEFAULTS,
} from './atom/config'
import { AtomGuiControls } from './atom/gui'
import { PubChemSearch } from './atom/PubChemSearch'
import { fetchMolecule } from './atom/pubchem'
import { AtomScene } from './atom/scene'
import {
  applySharedSpecialEffectAction,
  createInitialSharedSpecialEffectState,
  createSharedEffectHotkeyListener,
  createSharedSpecialEffectHandlers,
  isEditableTarget,
  SHARED_FX_CINEMATIC,
  setSharedChromaticAberrationEnabled,
  setSharedXrayModeEnabled,
} from '../../../src/shared/special-effects/index.ts'
import SafeCanvas from '../../../src/shared/webgl/SafeCanvas.tsx'
import {
  DEFAULT_VISUALIZATION,
  getNextVisualization,
  VISUALIZATION_LABELS,
  VISUALIZATION_OPTIONS,
} from './atom/visualizations'

export default function App() {
  const [visualization, setVisualization]   = useState(DEFAULT_VISUALIZATION)
  const [sceneSettings, setSceneSettings]   = useState(SCENE_DEFAULTS)
  const [effectSettings, setEffectSettings] = useState(EFFECT_DEFAULTS)
  const [xraySettings, setXraySettings]     = useState(XRAY_DEFAULTS)
  const [specialEffects, setSpecialEffects] = useState(() => createInitialSharedSpecialEffectState())

  // PubChem dynamic molecule state
  // `dynamicMolecule` overrides the preset visualization when set.
  const [dynamicMolecule, setDynamicMolecule] = useState(null)
  const [searchLoading, setSearchLoading]     = useState(false)
  const [searchError, setSearchError]         = useState(null)

  const handleApplyPreset = useCallback((preset) => {
    if (preset.effect && Object.keys(preset.effect).length > 0) {
      setEffectSettings((current) => ({ ...current, ...preset.effect }))
    }
    if (preset.scene && Object.keys(preset.scene).length > 0) {
      setSceneSettings((current) => ({ ...current, ...preset.scene }))
    }
  }, [])

  const updateChromaticAberration = (enabled) => {
    setSpecialEffects((current) => setSharedChromaticAberrationEnabled(current, enabled))
  }

  const updateXrayMode = (enabled) => {
    setSpecialEffects((current) => setSharedXrayModeEnabled(current, enabled))
  }

  // -------------------------------------------------------------------------
  // PubChem search handler
  // -------------------------------------------------------------------------

  const handleSearch = useCallback(async (nameOrCid) => {
    setSearchLoading(true)
    setSearchError(null)
    setDynamicMolecule(null)

    try {
      const result = await fetchMolecule(nameOrCid)
      setDynamicMolecule(result)
    } catch (err) {
      setSearchError(err.message ?? 'Failed to fetch molecule.')
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleClearSearch = useCallback(() => {
    setDynamicMolecule(null)
    setSearchError(null)
  }, [])

  // -------------------------------------------------------------------------
  // Keyboard navigation (arrow keys cycle presets; search input is excluded
  // by isEditableTarget so it can handle its own arrow-key navigation)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleSharedEffectHotkey = createSharedEffectHotkeyListener(
      createSharedSpecialEffectHandlers(setSpecialEffects),
    )

    const onKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      if (event.key === APP_HOTKEYS.bloom) {
        event.preventDefault()
        const bloomEnabled = specialEffects.currentFx !== SHARED_FX_CINEMATIC

        setEffectSettings((current) => (
          current.bloomEnabled === bloomEnabled
            ? current
            : { ...current, bloomEnabled }
        ))
        setSpecialEffects((current) => (
          applySharedSpecialEffectAction(current, 'cinematic', performance.now() / 1000)
        ))
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        // Arrow keys while a dynamic molecule is shown: clear it and cycle presets
        if (dynamicMolecule) handleClearSearch()
        const direction = event.key === 'ArrowRight' ? 1 : -1
        setVisualization((current) => getNextVisualization(current, direction))
        return
      }

      if (handleSharedEffectHotkey(event)) return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [specialEffects.currentFx, dynamicMolecule, handleClearSearch])

  // Label shown beneath the molecule
  const displayLabel = dynamicMolecule
    ? null // the search pill handles labelling for dynamic molecules
    : (VISUALIZATION_LABELS[visualization] ?? '')

  return (
    <main className="app-shell">
      {/* 3-D scene -------------------------------------------------------- */}
      <SafeCanvas
        camera={CAMERA_DEFAULTS}
        rendererOptions={{ antialias: true }}
        sceneLabel="Atom"
      >
        <AtomScene
          chromaticAberrationEnabled={specialEffects.chromaticAberrationEnabled}
          dynamicMolecule={dynamicMolecule}
          effectSettings={effectSettings}
          sceneSettings={sceneSettings}
          specialEffects={specialEffects}
          visualization={visualization}
          xrayMode={specialEffects.xrayMode}
          xraySettings={xraySettings}
        />
      </SafeCanvas>

      {/* PubChem search bar ---------------------------------------------- */}
      <PubChemSearch
        loading={searchLoading}
        error={searchError}
        activeMolecule={dynamicMolecule}
        onSearch={handleSearch}
        onClear={handleClearSearch}
      />

      {/* GUI panel -------------------------------------------------------- */}
      <AtomGuiControls
        chromaticAberrationEnabled={specialEffects.chromaticAberrationEnabled}
        effectSettings={effectSettings}
        onApplyPreset={handleApplyPreset}
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

      {/* Preset molecule label ------------------------------------------- */}
      {displayLabel ? (
        <div className="visualization-label">{displayLabel}</div>
      ) : null}

      {/* Preset molecule nav --------------------------------------------- */}
      <div className="visualization-nav">
        {VISUALIZATION_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            title={label}
            className={`visualization-button ${!dynamicMolecule && visualization === value ? 'is-active' : ''}`}
            onClick={() => {
              setVisualization(value)
              // Switching to a preset always clears the dynamic molecule
              handleClearSearch()
            }}
          >
            {value}
          </button>
        ))}
      </div>
    </main>
  )
}
