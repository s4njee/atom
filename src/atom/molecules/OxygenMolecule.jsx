import { useRef } from 'react'
import { ATOM_SCALES, DoubleBond } from '../core'
import { AtomInstances, useMoleculeAnimation } from './helpers'

export function OxygenMolecule() {
  const moleculeRef = useRef(null)
  const separation = 1.18
  const atomDefs = [
    { key: 'o-left', element: 'O', scale: ATOM_SCALES.O, position: [-separation, 0, 0] },
    { key: 'o-right', element: 'O', scale: ATOM_SCALES.O, position: [separation, 0, 0] },
  ]

  useMoleculeAnimation(moleculeRef, {
    rotationSpeed: 0.14,
    rotationXAmplitude: 0.04,
    rotationXFrequency: 0.22,
    floatAmplitude: 0.08,
    floatFrequency: 0.5,
  })

  return (
    <group ref={moleculeRef}>
      <AtomInstances atomDefs={atomDefs} />
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
