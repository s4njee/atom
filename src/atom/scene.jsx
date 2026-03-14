import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EFFECT_DEFAULTS,
  LIGHT_POSITIONS,
} from './config'
import { createXrayMaterialController } from './core'
import SharedEffectStack from '../../../../src/shared/special-effects/SharedEffectStack.tsx'
import {
  SHARED_FX_CINEMATIC,
  SHARED_FX_DATABEND,
} from '../../../../src/shared/special-effects/shared-special-effects.ts'
import {
  DEFAULT_VISUALIZATION,
  VISUALIZATION_COMPONENTS,
} from './visualizations'

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
        bloomEnabled={effectSettings.bloomEnabled}
        bloomIntensity={effectSettings.bloomIntensity}
        bloomRadius={effectSettings.bloomRadius}
        bloomSmoothing={effectSettings.bloomSmoothing}
        bloomThreshold={effectSettings.bloomThreshold}
        chromaticAberrationEnabled={chromaticAberrationEnabled}
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
  chromaticAberrationEnabled,
  effectSettings = EFFECT_DEFAULTS,
  sceneSettings,
  specialEffects,
  visualization,
  xrayMode,
  xraySettings,
}) {
  const moleculeRef = useRef(null)
  const ActiveVisualization = VISUALIZATION_COMPONENTS[visualization] ?? VISUALIZATION_COMPONENTS[DEFAULT_VISUALIZATION]

  return (
    <>
      <color attach="background" args={[sceneSettings.backgroundColor]} />
      <fog attach="fog" args={[sceneSettings.fogColor, sceneSettings.fogNear, sceneSettings.fogFar]} />
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
      <group ref={moleculeRef}>
        <ActiveVisualization />
      </group>
      <AtomSceneEffects
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
