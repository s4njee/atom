import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  ATOM_SCALES,
  BondElectronPair,
  BUCKMINSTERFULLERENE,
  Nucleus,
  StructuralBond,
} from '../core'

export function BuckminsterfullereneMolecule() {
  const moleculeRef = useRef(null)
  const atomPositions = BUCKMINSTERFULLERENE.atomPositions
  const bondDefs = BUCKMINSTERFULLERENE.bonds

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = 0.18 + t * 0.1
    moleculeRef.current.rotation.x = 0.42 + Math.sin(t * 0.22) * 0.08
    moleculeRef.current.rotation.z = Math.sin(t * 0.17) * 0.04
    moleculeRef.current.position.y = Math.sin(t * 0.36) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {bondDefs.map(([startIndex, endIndex]) => (
        <StructuralBond
          key={`structure-${startIndex}-${endIndex}`}
          start={atomPositions[startIndex]}
          end={atomPositions[endIndex]}
          color="#87d0ff"
          opacity={0.38}
        />
      ))}

      {bondDefs.map(([startIndex, endIndex], index) => (
        <BondElectronPair
          key={`electron-${startIndex}-${endIndex}`}
          start={atomPositions[startIndex]}
          end={atomPositions[endIndex]}
          colorA="#8fd4ff"
          colorB="#d8f4ff"
          speed={7.8 + (index % 6) * 0.35}
          phase={index * 0.29}
          spread={0.055}
          lineScale={0.21}
          lightIntensity={0}
        />
      ))}

      {atomPositions.map((position, index) => (
        <Nucleus
          key={`c60-${index}`}
          position={position}
          scale={ATOM_SCALES.C * 0.78}
          color="#2e516f"
          emissive="#1b3550"
          emissiveIntensity={1.35}
        />
      ))}
    </group>
  )
}
