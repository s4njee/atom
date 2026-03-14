import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AromaticRingPair,
  ATOM_SCALES,
  BondElectronPair,
  Nucleus,
  StructuralBond,
} from '../core'

export function EpinephrineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.78
  const atomDefs = [
    // Approximate heavy-atom layout for epinephrine highlighting the catechol ring.
    { key: 'c1', element: 'C', scale: ATOM_SCALES.C, position: [1.12 * scale, 0.04 * scale, 0.02 * scale] },
    { key: 'c2', element: 'C', scale: ATOM_SCALES.C, position: [0.54 * scale, 0.98 * scale, 0.01 * scale] },
    { key: 'c3', element: 'C', scale: ATOM_SCALES.C, position: [-0.56 * scale, 0.96 * scale, -0.02 * scale] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-1.12 * scale, -0.02 * scale, -0.01 * scale] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-0.54 * scale, -0.98 * scale, 0.02 * scale] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [0.56 * scale, -0.96 * scale, 0.01 * scale] },
    { key: 'o3', element: 'O', scale: ATOM_SCALES.O, position: [-1.1 * scale, 1.78 * scale, -0.12 * scale] },
    { key: 'o4', element: 'O', scale: ATOM_SCALES.O, position: [-2.26 * scale, -0.02 * scale, -0.16 * scale] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [2.28 * scale, 0.06 * scale, 0.2 * scale] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [3.18 * scale, -0.84 * scale, 0.66 * scale] },
    { key: 'o8', element: 'O', scale: ATOM_SCALES.O, position: [3.42 * scale, -1.92 * scale, -0.12 * scale] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [4.26 * scale, -0.06 * scale, 0.92 * scale] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [5.34 * scale, -0.58 * scale, 1.58 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const ringKeys = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
  const ringPoints = ringKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['c1', 'c2'],
    ['c2', 'c3'],
    ['c3', 'c4'],
    ['c4', 'c5'],
    ['c5', 'c6'],
    ['c6', 'c1'],
    ['c3', 'o3'],
    ['c4', 'o4'],
    ['c1', 'c7'],
    ['c7', 'c8'],
    ['c8', 'o8'],
    ['c8', 'n1'],
    ['n1', 'c9'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.22 + t * 0.085
    moleculeRef.current.rotation.x = Math.sin(t * 0.18) * 0.05
    moleculeRef.current.rotation.z = 0.34 + Math.sin(t * 0.13) * 0.028
    moleculeRef.current.position.y = Math.sin(t * 0.38) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {atomDefs.map(({ key, element, scale }) => (
        <Nucleus
          key={key}
          position={atoms[key]}
          scale={scale}
          color={atomStyle[element].color}
          emissive={atomStyle[element].emissive}
          emissiveIntensity={atomStyle[element].emissiveIntensity}
        />
      ))}

      {bondDefs.map(([startKey, endKey]) => (
        <StructuralBond
          key={`structure-${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
        />
      ))}

      {bondDefs
        .filter(([startKey, endKey]) => !ringKeys.includes(startKey) || !ringKeys.includes(endKey))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 3 ? '#8fd4ff' : '#9edbff'}
            colorB={index < 3 ? '#bde7ff' : '#d4f1ff'}
            speed={8.6 + (index % 4) * 0.5}
            phase={index * 0.44}
            spread={0.075}
            lineScale={0.25}
          />
        ))}

      <AromaticRingPair ringPoints={ringPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.8} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#7fc3ff" colorB="#bfe7ff" speed={11.1} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#9edbff" colorB="#e6f7ff" speed={10.6} />
    </group>
  )
}
