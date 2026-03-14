import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  CHROMATIC_ABERRATION_OFFSET,
  CHROMATIC_OSCILLATION_SPEED,
  createXrayMaterialController,
} from './core'
import {
  Atom,
  OxygenMolecule,
  EthyleneMolecule,
  CaffeineMolecule,
  EpinephrineMolecule,
  CapsaicinMolecule,
  MirtazapineMolecule,
  QuetiapineMolecule,
  LSDMolecule,
  AtropineMolecule,
  EmpagliflozinMolecule,
  BuckminsterfullereneMolecule,
} from './molecules'

const VISUALIZATION_COMPONENTS = {
  1: Atom,
  2: OxygenMolecule,
  4: CaffeineMolecule,
  5: EpinephrineMolecule,
  6: BuckminsterfullereneMolecule,
  7: CapsaicinMolecule,
  8: MirtazapineMolecule,
  9: QuetiapineMolecule,
  10: LSDMolecule,
  11: AtropineMolecule,
  12: EmpagliflozinMolecule,
}

function AtomXrayController({ enabled, targetRef }) {
  const controller = useMemo(() => createXrayMaterialController(), [])

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

function AtomSceneEffects({ chromaticAberrationEnabled, targetRef, xrayMode }) {
  const chromaticOffset = useMemo(
    () => new THREE.Vector2(CHROMATIC_ABERRATION_OFFSET, CHROMATIC_ABERRATION_OFFSET),
    [],
  )

  useFrame((state) => {
    if (!chromaticAberrationEnabled) return

    const oscillation = 0.75 + 0.25 * Math.sin(state.clock.getElapsedTime() * CHROMATIC_OSCILLATION_SPEED)
    chromaticOffset.set(
      CHROMATIC_ABERRATION_OFFSET * oscillation,
      CHROMATIC_ABERRATION_OFFSET * oscillation,
    )
  })

  return (
    <>
      <AtomXrayController enabled={xrayMode} targetRef={targetRef} />
      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={0.72}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.26}
          radius={0.46}
        />
        {chromaticAberrationEnabled ? (
          <ChromaticAberration
            offset={chromaticOffset}
            radialModulation
            modulationOffset={0.15}
          />
        ) : null}
      </EffectComposer>
    </>
  )
}

function AtomScene({ chromaticAberrationEnabled, visualization, xrayMode }) {
  const moleculeRef = useRef(null)
  const ActiveVisualization = VISUALIZATION_COMPONENTS[visualization] ?? EthyleneMolecule

  return (
    <>
      <fog attach="fog" args={['#040913', 10, 20]} />
      <ambientLight intensity={0.36} />
      <hemisphereLight args={['#d2ecff', '#071018', 0.92]} />
      <directionalLight position={[4, 4, 6]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-4, -2, 3]} intensity={0.5} color="#4da3ff" />
      <pointLight position={[0, 0, -5]} intensity={10} distance={18} color="#13304f" />
      <group ref={moleculeRef}>
        <ActiveVisualization />
      </group>
      <AtomSceneEffects
        chromaticAberrationEnabled={chromaticAberrationEnabled}
        targetRef={moleculeRef}
        xrayMode={xrayMode}
      />
    </>
  )
}

export { AtomScene }
