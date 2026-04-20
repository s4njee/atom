import { useCallback, useEffect, useMemo, useState } from 'react'
import './styles.css'
import {
  APP_HOTKEYS,
  CAMERA_DEFAULTS,
  EFFECT_DEFAULTS,
  SCENE_DEFAULTS,
  STANDING_WAVE_DEFAULTS,
  XRAY_DEFAULTS,
} from './atom/config'
import { AtomGuiControls } from './atom/gui'
import { PubChemSearch } from './atom/PubChemSearch'
import { fetchMolecule } from './atom/pubchem'
import { classifyPharmacophore } from './atom/pharmacophore'
import { PharmacophoreLegend } from './atom/pharmacophore-legend'
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
  getVisualizationMoleculeData,
  VISUALIZATION_LABELS,
  VISUALIZATION_OPTIONS,
} from './atom/visualizations'

export default function App() {
  const [visualization, setVisualization]   = useState(DEFAULT_VISUALIZATION)
  const [sceneSettings, setSceneSettings]   = useState(SCENE_DEFAULTS)
  const [effectSettings, setEffectSettings] = useState(EFFECT_DEFAULTS)
  const [xraySettings, setXraySettings]     = useState(XRAY_DEFAULTS)
  const [standingWaveSettings, setStandingWaveSettings] = useState(STANDING_WAVE_DEFAULTS)
  const [specialEffects, setSpecialEffects] = useState(() => createInitialSharedSpecialEffectState({ chromaticAberrationEnabled: true }))
  const [pharmacophoreMode, setPharmacophoreModeEnabled] = useState(false)
  const [themeMode, setThemeMode] = useState(null)

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

  const updatePharmacophoreMode = useCallback((enabled) => {
    setPharmacophoreModeEnabled(enabled)

    if (enabled) {
      setEffectSettings((current) => (
        current.bloomEnabled
          ? { ...current, bloomEnabled: false }
          : current
      ))
    }
  }, [])

  const updateBlueprintMode = useCallback((enabled) => {
    setThemeMode(enabled ? 'blueprint' : null)

    if (enabled) {
      setEffectSettings((current) => (
        current.bloomEnabled
          ? { ...current, bloomEnabled: false }
          : current
      ))
    }
  }, [])

  const updateTheme = useCallback((theme) => {
    setThemeMode(theme)

    // Disable bloom for any visual theme so it doesn't fight the overlay
    if (theme) {
      setEffectSettings((current) => (
        current.bloomEnabled
          ? { ...current, bloomEnabled: false }
          : current
      ))
    }
  }, [])

  const pharmacophoreMap = useMemo(() => {
    if (!pharmacophoreMode || specialEffects.xrayMode) return null

    if (dynamicMolecule) {
      return classifyPharmacophore(
        dynamicMolecule.atomDefs,
        dynamicMolecule.bondDefs,
        dynamicMolecule.aromaticRings,
      )
    }

    const data = getVisualizationMoleculeData(visualization)
    if (!data) return null

    return classifyPharmacophore(data.atoms, data.bonds, data.aromaticRings)
  }, [dynamicMolecule, pharmacophoreMode, specialEffects.xrayMode, visualization])

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

      if (event.key === APP_HOTKEYS.pharmacophore) {
        event.preventDefault()
        setEffectSettings((current) => (
          current.bloomEnabled
            ? { ...current, bloomEnabled: false }
            : current
        ))
        const enabled = !pharmacophoreMode
        updatePharmacophoreMode(enabled)
        return
      }

      if (event.key === APP_HOTKEYS.blueprint) {
        event.preventDefault()
        updateBlueprintMode(themeMode !== 'blueprint')
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
  }, [
    themeMode,
    specialEffects.currentFx,
    dynamicMolecule,
    handleClearSearch,
    pharmacophoreMode,
    updateBlueprintMode,
    updatePharmacophoreMode,
  ])

  // Label shown beneath the molecule
  const displayLabel = dynamicMolecule
    ? null // the search pill handles labelling for dynamic molecules
    : (VISUALIZATION_LABELS[visualization] ?? '')

  const blueprintMode = themeMode === 'blueprint'
  const themeClass = themeMode ? ` is-${themeMode}` : ''

  return (
    <main className={`app-shell${themeClass}`}>
      {/* 3-D scene -------------------------------------------------------- */}
      <SafeCanvas
        camera={CAMERA_DEFAULTS}
        dpr={0.75}
        rendererOptions={{ antialias: false, powerPreference: 'high-performance' }}
        sceneLabel="Atom"
      >
        <AtomScene
          chromaticAberrationEnabled={specialEffects.chromaticAberrationEnabled}
          themeMode={themeMode}
          dynamicMolecule={dynamicMolecule}
          effectSettings={effectSettings}
          sceneSettings={sceneSettings}
          specialEffects={specialEffects}
          standingWaveSettings={standingWaveSettings}
          pharmacophoreMap={pharmacophoreMap}
          visualization={visualization}
          xrayMode={specialEffects.xrayMode}
          xraySettings={xraySettings}
        />
      </SafeCanvas>

      {/* Theme overlays --------------------------------------------------- */}
      {themeMode === 'blueprint' && (
        <div className="blueprint-paper-overlay" aria-hidden="true">
          <div className="blueprint-compass">
            <span>N</span><span>E</span><span>S</span><span>W</span>
          </div>
          <div className="blueprint-stamp">SCHRODINGER BLUEPRINT</div>
        </div>
      )}
      {themeMode === 'chalkboard' && (
        <div className="chalkboard-overlay" aria-hidden="true">
          <div className="chalkboard-eraser">▓ eraser</div>
        </div>
      )}
      {themeMode === 'hologram' && (
        <div className="hologram-overlay" aria-hidden="true">
          <div className="hologram-readout">DISPLAY ACTIVE</div>
        </div>
      )}
{themeMode === 'circuit' && (
        <div className="circuit-overlay" aria-hidden="true">
          <div className="circuit-readout">PCB TRACE VIEW</div>
        </div>
      )}
      {themeMode === 'thermal' && (
        <div className="thermal-overlay" aria-hidden="true">
          <div className="thermal-legend">
            <div className="thermal-legend-bar" />
            <div className="thermal-legend-labels">
              <span>COLD</span><span>HOT</span>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`blueprint-toggle${blueprintMode ? ' is-active' : ''}`}
        aria-pressed={blueprintMode}
        title="Toggle Schrödinger blueprint"
        onClick={() => updateBlueprintMode(!blueprintMode)}
      >
        8
      </button>

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
        themeMode={themeMode}
        effectSettings={effectSettings}
        onApplyPreset={handleApplyPreset}
        sceneSettings={sceneSettings}
        setEffectSettings={setEffectSettings}
        setSceneSettings={setSceneSettings}
        setStandingWaveSettings={setStandingWaveSettings}
        setVisualization={setVisualization}
        setXraySettings={setXraySettings}
        standingWaveSettings={standingWaveSettings}
        pharmacophoreMode={pharmacophoreMode}
        updateBlueprintMode={updateBlueprintMode}
        updateTheme={updateTheme}
        updateChromaticAberration={updateChromaticAberration}
        updatePharmacophoreMode={updatePharmacophoreMode}
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
      <div className="atom-bottom-controls">
        <PharmacophoreLegend pharmacophoreMap={pharmacophoreMap} />
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
      </div>
    </main>
  )
}
