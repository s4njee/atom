import { useRef } from 'react'
import { ElectronPair, Nucleus } from '../core'
import { useMoleculeAnimation } from './helpers'

export function Atom() {
  const atomRef = useRef(null)

  useMoleculeAnimation(atomRef, {
    rotationSpeed: 0.18,
    rotationXAmplitude: 0.08,
    rotationXFrequency: 0.35,
    floatAmplitude: 0.14,
    floatFrequency: 0.75,
  })

  return (
    <group ref={atomRef}>
      <Nucleus />
      <ElectronPair axis="y" lobeTightness={1} />
    </group>
  )
}
