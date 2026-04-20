import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  EFFECT_DEFAULTS,
  LIGHT_POSITIONS,
  THEME_SCENE_OVERRIDES,
} from './config'
import { createXrayMaterialController } from './core'
import {
  AtomRenderModeProvider,
  DEFAULT_ATOM_RENDER_MODE,
} from './render-mode'
import {
  ATOM_INTERACTION_RESUME_DELAY_MS,
  AtomInteractionProvider,
} from './interaction'

const THEME_TO_NUCLEUS_STYLE = {
  chalkboard: 'chalk',
  hologram:   'hologram',
  circuit:    'circuit',
  thermal:    'thermal',
}

const THEMES_WITHOUT_ELECTRONS = new Set(['chalk', 'circuit'])
import { StandingWaveProvider } from './standing-wave'
import {
  SharedEffectStack,
  SHARED_FX_CINEMATIC,
  SHARED_FX_DATABEND,
} from '../../../../src/shared/special-effects/index.ts'
import {
  DEFAULT_VISUALIZATION,
  VISUALIZATION_COMPONENTS,
} from './visualizations.jsx'
import { DynamicMolecule } from './molecules/DynamicMolecule'

function AtomXrayController({ enabled, settings, targetRef }) {
  const controller = useMemo(() => createXrayMaterialController(settings), [])

  useEffect(() => {
    controller.setConfig(settings)
  }, [controller, settings])

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    if (enabled) {
      controller.apply(target)
      return () => controller.restore(target)
    }

    controller.restore(target)

    return undefined
  }, [controller, enabled, targetRef])

  useFrame((state) => {
    if (enabled) controller.update(state.clock.getElapsedTime())
  })

  return null
}

function AtomSceneEffects({
  themeMode,
  chromaticAberrationEnabled,
  effectSettings,
  specialEffects,
  targetRef,
  xrayMode,
  xraySettings,
}) {
  const disablePostFx = themeMode != null
  return (
    <>
      <AtomXrayController enabled={xrayMode} settings={xraySettings} targetRef={targetRef} />
      <SharedEffectStack
        barrelBlurAmount={0.12}
        bloomEnabled={!disablePostFx && effectSettings.bloomEnabled}
        bloomIntensity={effectSettings.bloomIntensity}
        bloomRadius={effectSettings.bloomRadius}
        bloomSmoothing={effectSettings.bloomSmoothing}
        bloomThreshold={effectSettings.bloomThreshold}
        chromaticAberrationEnabled={!disablePostFx && chromaticAberrationEnabled}
        chromaticModulationOffset={effectSettings.chromaticModulationOffset}
        chromaticOffset={effectSettings.chromaticOffset}
        chromaticOscillationSpeed={effectSettings.chromaticOscillationSpeed}
        chromaticRadialModulation={effectSettings.chromaticRadialModulation}
        cinematicEnabled={specialEffects.currentFx === SHARED_FX_CINEMATIC}
        databendEnabled={specialEffects.currentFx === SHARED_FX_DATABEND}
        hue={specialEffects.hue}
        hueCycleBaseHue={specialEffects.hueCycleBaseHue}
        hueCycleEnabled={specialEffects.hueCycleEnabled}
        hueCycleStartTime={specialEffects.hueCycleStartTime}
        hueSatEnabled={specialEffects.hueSatEnabled}
        pixelMosaicEnabled={specialEffects.pixelMosaicEnabled}
        saturation={specialEffects.saturation}
        thermalVisionEnabled={specialEffects.thermalVisionEnabled}
      />
    </>
  )
}

function AtomScene({
  themeMode = null,
  chromaticAberrationEnabled,
  dynamicMolecule,
  effectSettings = EFFECT_DEFAULTS,
  sceneSettings,
  specialEffects,
  standingWaveSettings,
  pharmacophoreMap,
  visualization,
  xrayMode,
  xraySettings,
}) {
  const moleculeRef = useRef(null)
  const interactionRef = useRef({
    controlsActive: false,
    pauseAnimationUntil: 0,
  })
  const ActiveVisualization = VISUALIZATION_COMPONENTS[visualization] ?? VISUALIZATION_COMPONENTS[DEFAULT_VISUALIZATION]
  const cinematicEnabled = specialEffects.currentFx === SHARED_FX_CINEMATIC
  const blueprintMode = themeMode === 'blueprint'
  const nucleusStyle = themeMode && themeMode !== 'blueprint'
    ? THEME_TO_NUCLEUS_STYLE[themeMode] ?? null
    : null
  const electronsHidden = blueprintMode || (nucleusStyle != null && THEMES_WITHOUT_ELECTRONS.has(nucleusStyle))
  const themeOverrides = themeMode ? THEME_SCENE_OVERRIDES[themeMode] : null
  const renderMode = useMemo(() => {
    if (!blueprintMode && !cinematicEnabled && !electronsHidden && !pharmacophoreMap && !nucleusStyle)
      return DEFAULT_ATOM_RENDER_MODE

    return {
      blueprintEnabled: blueprintMode,
      bondLightIntensityScale: 1,
      cinematicEnabled,
      electronsHidden,
      nucleusStyle,
      pharmacophoreMap,
    }
  }, [blueprintMode, cinematicEnabled, electronsHidden, nucleusStyle, pharmacophoreMap])
  const handleControlsStart = useCallback(() => {
    interactionRef.current.controlsActive = true
    interactionRef.current.pauseAnimationUntil = performance.now() + ATOM_INTERACTION_RESUME_DELAY_MS
  }, [])
  const handleControlsChange = useCallback(() => {
    interactionRef.current.pauseAnimationUntil = performance.now() + ATOM_INTERACTION_RESUME_DELAY_MS
  }, [])
  const handleControlsEnd = useCallback(() => {
    interactionRef.current.controlsActive = false
    interactionRef.current.pauseAnimationUntil = performance.now() + ATOM_INTERACTION_RESUME_DELAY_MS
  }, [])

  return (
    <>
      <color attach="background" args={[themeOverrides?.bg ?? sceneSettings.backgroundColor]} />
      <fog
        attach="fog"
        args={[
          themeOverrides?.fog ?? sceneSettings.fogColor,
          themeOverrides?.fogNear ?? sceneSettings.fogNear,
          themeOverrides?.fogFar ?? sceneSettings.fogFar,
        ]}
      />
      <ambientLight intensity={sceneSettings.ambientIntensity} />
      <hemisphereLight
        args={[
          sceneSettings.hemisphereSkyColor,
          sceneSettings.hemisphereGroundColor,
          sceneSettings.hemisphereIntensity,
        ]}
      />
      <directionalLight
        position={LIGHT_POSITIONS.key}
        intensity={sceneSettings.keyLightIntensity}
        color={sceneSettings.keyLightColor}
      />
      <directionalLight
        position={LIGHT_POSITIONS.fill}
        intensity={sceneSettings.fillLightIntensity}
        color={sceneSettings.fillLightColor}
      />
      <pointLight
        position={LIGHT_POSITIONS.back}
        intensity={sceneSettings.backLightIntensity}
        distance={sceneSettings.backLightDistance}
        color={sceneSettings.backLightColor}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={4.5}
        maxDistance={28}
        makeDefault
        onStart={handleControlsStart}
        onChange={handleControlsChange}
        onEnd={handleControlsEnd}
      />
      <AtomInteractionProvider value={interactionRef}>
        <AtomRenderModeProvider value={renderMode}>
          <StandingWaveProvider value={standingWaveSettings}>
            <group ref={moleculeRef}>
              {dynamicMolecule ? (
                // PubChem-fetched molecule — keyed by CID so React fully unmounts
                // and remounts when the user searches a different compound.
                <DynamicMolecule
                  key={dynamicMolecule.cid}
                  atomDefs={dynamicMolecule.atomDefs}
                  aromaticRings={dynamicMolecule.aromaticRings}
                  bondDefs={dynamicMolecule.bondDefs}
                />
              ) : (
                <ActiveVisualization />
              )}
            </group>
          </StandingWaveProvider>
        </AtomRenderModeProvider>
      </AtomInteractionProvider>
      <AtomSceneEffects
        themeMode={themeMode}
        chromaticAberrationEnabled={chromaticAberrationEnabled}
        effectSettings={effectSettings}
        specialEffects={specialEffects}
        targetRef={moleculeRef}
        xrayMode={xrayMode}
        xraySettings={xraySettings}
      />
    </>
  )
}

export { AtomScene }
