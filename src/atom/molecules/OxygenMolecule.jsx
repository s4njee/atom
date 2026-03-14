import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ATOM_SCALES, DoubleBond, Nucleus } from '../core'

export function OxygenMolecule() {
  const moleculeRef = useRef(null)
  const separation = 1.18

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.14
    moleculeRef.current.rotation.x = Math.sin(t * 0.22) * 0.04
    moleculeRef.current.position.y = Math.sin(t * 0.5) * 0.08
  })

  return (
    <group ref={moleculeRef}>
      <Nucleus position={[-separation, 0, 0]} scale={ATOM_SCALES.O} />
      <Nucleus position={[separation, 0, 0]} scale={ATOM_SCALES.O} />
      <DoubleBond
        start={[-separation, 0, 0]}
        end={[separation, 0, 0]}
        showStructure={false}
        sigmaProps={{
          colorA: '#c7ebff',
          colorB: '#9fdfff',
          speed: 11.2,
          phase: 0,
          spread: 0.1,
        }}
        piPairs={[
          { sign: 1, colorA: '#98d8ff', colorB: '#69c1ff', speed: 13.6, phase: 0 },
          { sign: -1, colorA: '#66b8ff', colorB: '#9fdfff', speed: 12.8, phase: Math.PI / 2 },
        ]}
      />
    </group>
  )
}
