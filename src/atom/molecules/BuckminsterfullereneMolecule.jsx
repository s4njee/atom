import { useRef } from 'react'
import {
  ATOM_SCALES,
  BUCKMINSTERFULLERENE,
  SingleBond,
} from '../core'
import { AtomInstances, useMoleculeAnimation } from './helpers'

export function BuckminsterfullereneMolecule() {
  const moleculeRef = useRef(null)
  const atomPositions = BUCKMINSTERFULLERENE.atomPositions
  const bondDefs = BUCKMINSTERFULLERENE.bonds
  const atomDefs = atomPositions.map((position, index) => ({
    key: `c60-${index}`,
    element: 'C',
    scale: ATOM_SCALES.C * 0.78,
    position,
  }))

  useMoleculeAnimation(moleculeRef, {
    rotationYOffset: 0.18,
    rotationSpeed: 0.1,
    rotationXBias: 0.42,
    rotationXAmplitude: 0.08,
    rotationXFrequency: 0.22,
    rotationZAmplitude: 0.04,
    rotationZFrequency: 0.17,
    floatAmplitude: 0.05,
    floatFrequency: 0.36,
  })

  return (
    <group ref={moleculeRef}>
      <AtomInstances atomDefs={atomDefs} />

      {bondDefs.map(([startIndex, endIndex], index) => (
        <SingleBond
          key={`electron-${startIndex}-${endIndex}`}
          start={atomPositions[startIndex]}
          end={atomPositions[endIndex]}
          color="#87d0ff"
          opacity={0.38}
          electronProps={{
            colorA: '#8fd4ff',
            colorB: '#d8f4ff',
            speed: 7.8 + (index % 6) * 0.35,
            phase: index * 0.29,
            spread: 0.055,
            lineScale: 0.21,
            lightIntensity: 0,
          }}
        />
      ))}
    </group>
  )
}
