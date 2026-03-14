import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  EFFECT_DEFAULTS,
  LIGHT_POSITIONS,
} from './config'
import { createXrayMaterialController } from './core'
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
  targetRef,
  xrayMode,
  xraySettings,
}) {
  const chromaticOffset = useMemo(() => new THREE.Vector2(), [])

  useEffect(() => {
    chromaticOffset.set(effectSettings.chromaticOffset, effectSettings.chromaticOffset)
  }, [chromaticOffset, effectSettings.chromaticOffset])

  useFrame((state) => {
    if (!chromaticAberrationEnabled) return

    const oscillation = 0.75 + 0.25 * Math.sin(
      state.clock.getElapsedTime() * effectSettings.chromaticOscillationSpeed,
    )
    const offset = effectSettings.chromaticOffset * oscillation

    chromaticOffset.set(offset, offset)
  })

  return (
    <>
      <AtomXrayController enabled={xrayMode} settings={xraySettings} targetRef={targetRef} />
      <EffectComposer>
        {effectSettings.bloomEnabled ? (
          <Bloom
            mipmapBlur
            intensity={effectSettings.bloomIntensity}
            luminanceThreshold={effectSettings.bloomThreshold}
            luminanceSmoothing={effectSettings.bloomSmoothing}
            radius={effectSettings.bloomRadius}
          />
        ) : null}
        {chromaticAberrationEnabled ? (
          <ChromaticAberration
            offset={chromaticOffset}
            radialModulation={effectSettings.chromaticRadialModulation}
            modulationOffset={effectSettings.chromaticModulationOffset}
          />
        ) : null}
      </EffectComposer>
    </>
  )
}

function AtomScene({
  chromaticAberrationEnabled,
  effectSettings = EFFECT_DEFAULTS,
  sceneSettings,
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
        targetRef={moleculeRef}
        xrayMode={xrayMode}
        xraySettings={xraySettings}
      />
    </>
  )
}

export { AtomScene }
