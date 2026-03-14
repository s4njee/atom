import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ATOM_SCALES, BondElectronPair, Nucleus, StructuralBond } from '../core'

export function GlucoseMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.7
  const atomDefs = [
    // Approximate beta-D-glucopyranose chair conformation in ring form.
    { key: 'o5', element: 'O', scale: ATOM_SCALES.O, position: [-0.72 * scale, 0.92 * scale, 0.1 * scale] },
    { key: 'c1', element: 'C', scale: ATOM_SCALES.C, position: [0.34 * scale, 1.2 * scale, 0.42 * scale] },
    { key: 'c2', element: 'C', scale: ATOM_SCALES.C, position: [1.28 * scale, 0.42 * scale, 0.04 * scale] },
    { key: 'c3', element: 'C', scale: ATOM_SCALES.C, position: [1.02 * scale, -0.82 * scale, -0.38 * scale] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-0.14 * scale, -1.18 * scale, -0.06 * scale] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-1.02 * scale, -0.22 * scale, 0.34 * scale] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [-2.16 * scale, 0.18 * scale, 1.14 * scale] },
    { key: 'o1', element: 'O', scale: ATOM_SCALES.O, position: [0.56 * scale, 2.28 * scale, 1.2 * scale] },
    { key: 'o2', element: 'O', scale: ATOM_SCALES.O, position: [2.46 * scale, 0.78 * scale, 0.42 * scale] },
    { key: 'o3', element: 'O', scale: ATOM_SCALES.O, position: [1.82 * scale, -1.7 * scale, -0.78 * scale] },
    { key: 'o4', element: 'O', scale: ATOM_SCALES.O, position: [-0.4 * scale, -2.32 * scale, -0.86 * scale] },
    { key: 'o6', element: 'O', scale: ATOM_SCALES.O, position: [-3.1 * scale, -0.34 * scale, 1.78 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['o5', 'c1'],
    ['c1', 'c2'],
    ['c2', 'c3'],
    ['c3', 'c4'],
    ['c4', 'c5'],
    ['c5', 'o5'],
    ['c5', 'c6'],
    ['c1', 'o1'],
    ['c2', 'o2'],
    ['c3', 'o3'],
    ['c4', 'o4'],
    ['c6', 'o6'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.095
    moleculeRef.current.rotation.x = Math.sin(t * 0.2) * 0.045
    moleculeRef.current.rotation.z = Math.sin(t * 0.11) * 0.025
    moleculeRef.current.position.y = Math.sin(t * 0.4) * 0.05
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

      {bondDefs.map(([startKey, endKey], index) => (
        <BondElectronPair
          key={`${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          colorA={index < 7 ? '#8fd4ff' : '#9edbff'}
          colorB={index < 7 ? '#bfe7ff' : '#d4f1ff'}
          speed={8.4 + (index % 4) * 0.55}
          phase={index * 0.46}
          spread={index < 7 ? 0.085 : 0.07}
          lineScale={index < 7 ? 0.28 : 0.24}
        />
      ))}
    </group>
  )
}
