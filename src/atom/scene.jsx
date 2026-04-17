import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  EFFECT_DEFAULTS,
  LIGHT_POSITIONS,
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
  blueprintMode,
  chromaticAberrationEnabled,
  effectSettings,
  specialEffects,
  targetRef,
  xrayMode,
  xraySettings,
}) {
  return (
    <>
      <AtomXrayController enabled={xrayMode} settings={xraySettings} targetRef={targetRef} />
      <SharedEffectStack
        barrelBlurAmount={0.12}
        bloomEnabled={!blueprintMode && effectSettings.bloomEnabled}
        bloomIntensity={effectSettings.bloomIntensity}
        bloomRadius={effectSettings.bloomRadius}
        bloomSmoothing={effectSettings.bloomSmoothing}
        bloomThreshold={effectSettings.bloomThreshold}
        chromaticAberrationEnabled={!blueprintMode && chromaticAberrationEnabled}
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
  blueprintMode = false,
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
  const renderMode = useMemo(() => {
    if (!blueprintMode && !cinematicEnabled && !pharmacophoreMap) return DEFAULT_ATOM_RENDER_MODE

    return {
      blueprintEnabled: blueprintMode,
      bondLightIntensityScale: 1,
      cinematicEnabled,
      pharmacophoreMap,
    }
  }, [blueprintMode, cinematicEnabled, pharmacophoreMap])
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
      <color attach="background" args={[blueprintMode ? '#edf2e9' : sceneSettings.backgroundColor]} />
      <fog
        attach="fog"
        args={[
          blueprintMode ? '#edf2e9' : sceneSettings.fogColor,
          blueprintMode ? 14 : sceneSettings.fogNear,
          blueprintMode ? 28 : sceneSettings.fogFar,
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
        blueprintMode={blueprintMode}
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
