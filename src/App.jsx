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
import { PdbSearch } from './atom/PdbSearch'
import { fetchMolecule } from './atom/pubchem'
import { fetchProtein } from './atom/pdb'
import { classifyPharmacophore } from './atom/pharmacophore'
import { PharmacophoreLegend } from './atom/pharmacophore-legend'
import { ProteinScene } from './atom/protein-scene'
import { AtomScene } from './atom/scene'
import { PROTEINS } from './atom/proteins'
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

const PROTEIN_RENDER_MODES = [
  { value: 'cartoon', label: 'cartoon' },
  { value: 'wireframe', label: 'wireframe' },
  { value: 'molecular', label: 'molecular' },
]

export default function App() {
  const [mode, setMode] = useState('molecule')
  const [visualization, setVisualization]   = useState(DEFAULT_VISUALIZATION)
  const [proteinVisualization, setProteinVisualization] = useState(1)
  const [proteinRenderMode, setProteinRenderMode] = useState('cartoon')
  const [proteinMode8, setProteinMode8] = useState(false)
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
  const [dynamicProtein, setDynamicProtein] = useState(null)
  const [proteinSearchLoading, setProteinSearchLoading] = useState(false)
  const [proteinSearchError, setProteinSearchError] = useState(null)

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

  const handleProteinSearch = useCallback(async (query) => {
    setProteinSearchLoading(true)
    setProteinSearchError(null)
    setDynamicProtein(null)

    try {
      const result = await fetchProtein(query)
      setDynamicProtein(result)
    } catch (err) {
      setProteinSearchError(err.message ?? 'Failed to fetch PDB entry.')
    } finally {
      setProteinSearchLoading(false)
    }
  }, [])

  const handleClearProteinSearch = useCallback(() => {
    setDynamicProtein(null)
    setProteinSearchError(null)
  }, [])

  const toggleMode = useCallback(() => {
    setMode((currentMode) => (currentMode === 'molecule' ? 'protein' : 'molecule'))
    setProteinVisualization(1)
    handleClearSearch()
    handleClearProteinSearch()
  }, [handleClearProteinSearch, handleClearSearch])

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
        if (mode === 'protein') {
          setProteinMode8((enabled) => !enabled)
          return
        }
        updateBlueprintMode(themeMode !== 'blueprint')
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const direction = event.key === 'ArrowRight' ? 1 : -1

        if (mode === 'protein') {
          const proteinIds = Object.keys(PROTEINS).map(Number).sort((a, b) => a - b)
          setProteinVisualization((current) => {
            const currentIndex = proteinIds.indexOf(current)
            if (currentIndex < 0) return proteinIds[0] ?? 1
            return proteinIds[(currentIndex + direction + proteinIds.length) % proteinIds.length]
          })
          return
        }

        // Arrow keys while a dynamic molecule is shown: clear it and cycle presets
        if (dynamicMolecule) handleClearSearch()
        setVisualization((current) => getNextVisualization(current, direction))
        return
      }

      if (handleSharedEffectHotkey(event)) return
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    themeMode,
    mode,
    specialEffects.currentFx,
    dynamicMolecule,
    handleClearSearch,
    pharmacophoreMode,
    updateBlueprintMode,
    updatePharmacophoreMode,
  ])

  // Label shown beneath the molecule
  const displayLabel = mode === 'protein'
    ? (
      dynamicProtein
        ? null
        : (PROTEINS[proteinVisualization]?.label ?? '')
    )
    : (
      dynamicMolecule
        ? null // the search pill handles labelling for dynamic molecules
        : (VISUALIZATION_LABELS[visualization] ?? '')
    )

  const moleculeMode = mode === 'molecule'
  const blueprintMode = moleculeMode && themeMode === 'blueprint'
  const proteinBlueprint = !moleculeMode && proteinMode8
  const themeClass = moleculeMode && themeMode
    ? ` is-${themeMode}`
    : (proteinBlueprint ? ' is-blueprint' : '')
  const cameraDefaults = moleculeMode ? CAMERA_DEFAULTS : { position: [0, 0.2, 14], fov: 45 }

  return (
    <main className={`app-shell${themeClass}`}>
      {/* 3-D scene -------------------------------------------------------- */}
      <SafeCanvas
        key={mode}
        camera={cameraDefaults}
        dpr={0.75}
        rendererOptions={{ antialias: false, powerPreference: 'high-performance' }}
        sceneLabel={moleculeMode ? 'Atom' : 'Protein'}
      >
        {moleculeMode ? (
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
        ) : (
          <ProteinScene
            dynamicProtein={dynamicProtein}
            proteinMode8={proteinMode8}
            renderMode={proteinRenderMode}
            visualization={proteinVisualization}
          />
        )}
      </SafeCanvas>

      {/* Theme overlays --------------------------------------------------- */}
      {moleculeMode && themeMode === 'blueprint' && (
        <div className="blueprint-paper-overlay" aria-hidden="true">
          <div className="blueprint-compass">
            <span>N</span><span>E</span><span>S</span><span>W</span>
          </div>
          <div className="blueprint-stamp">SCHRODINGER BLUEPRINT</div>
        </div>
      )}
      {moleculeMode && themeMode === 'chalkboard' && (
        <div className="chalkboard-overlay" aria-hidden="true">
          <div className="chalkboard-eraser">▓ eraser</div>
        </div>
      )}
      {moleculeMode && themeMode === 'hologram' && (
        <div className="hologram-overlay" aria-hidden="true">
          <div className="hologram-readout">DISPLAY ACTIVE</div>
        </div>
      )}
      {moleculeMode && themeMode === 'circuit' && (
        <div className="circuit-overlay" aria-hidden="true">
          <div className="circuit-readout">PCB TRACE VIEW</div>
        </div>
      )}
      {moleculeMode && themeMode === 'thermal' && (
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
        className="mode-toggle"
        onClick={toggleMode}
      >
        {moleculeMode ? 'protein' : 'molecule'}
      </button>

      {moleculeMode ? (
        <button
          type="button"
        className={`blueprint-toggle${blueprintMode ? ' is-active' : ''}`}
        aria-pressed={blueprintMode}
        title="Toggle Schrödinger blueprint"
        onClick={() => updateBlueprintMode(!blueprintMode)}
      >
        8
      </button>
      ) : null}

      {!moleculeMode ? (
        <button
          type="button"
          className={`blueprint-toggle${proteinMode8 ? ' is-active' : ''}`}
          aria-pressed={proteinMode8}
          title="Toggle protein blueprint"
          onClick={() => setProteinMode8((enabled) => !enabled)}
        >
          8
        </button>
      ) : null}

      {proteinBlueprint && (
        <div className="blueprint-paper-overlay" aria-hidden="true">
          <div className="blueprint-compass">
            <span>N</span><span>E</span><span>S</span><span>W</span>
          </div>
          <div className="blueprint-stamp">PROTEIN BLUEPRINT</div>
        </div>
      )}

      {!moleculeMode ? (
        <div className="protein-render-modes" role="group" aria-label="Protein rendering mode">
          {PROTEIN_RENDER_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`protein-render-mode ${proteinRenderMode === value ? 'is-active' : ''}`}
              aria-pressed={proteinRenderMode === value}
              onClick={() => setProteinRenderMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {/* PubChem search bar ---------------------------------------------- */}
      {moleculeMode ? (
        <PubChemSearch
          loading={searchLoading}
          error={searchError}
          activeMolecule={dynamicMolecule}
          onSearch={handleSearch}
          onClear={handleClearSearch}
        />
      ) : (
        <PdbSearch
          loading={proteinSearchLoading}
          error={proteinSearchError}
          activeProtein={dynamicProtein}
          onSearch={handleProteinSearch}
          onClear={handleClearProteinSearch}
        />
      )}

      {/* GUI panel -------------------------------------------------------- */}
      {moleculeMode ? (
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
      ) : null}

      {/* Preset molecule label ------------------------------------------- */}
      {displayLabel ? (
        <div className="visualization-label">{displayLabel}</div>
      ) : null}

      {/* Preset molecule nav --------------------------------------------- */}
      <div className="atom-bottom-controls">
        {moleculeMode ? <PharmacophoreLegend pharmacophoreMap={pharmacophoreMap} /> : null}
        <div className="visualization-nav">
          {moleculeMode ? (
            VISUALIZATION_OPTIONS.map(({ value, label }) => (
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
            ))
          ) : (
            Object.entries(PROTEINS).map(([value, { label }]) => (
              <button
                key={value}
                type="button"
                title={label}
                className={`visualization-button ${!dynamicProtein && proteinVisualization === Number(value) ? 'is-active' : ''}`}
                onClick={() => {
                  setProteinVisualization(Number(value))
                  handleClearProteinSearch()
                }}
              >
                {value}
              </button>
            ))
          )}
        </div>
      </div>
    </main>
  )
}
