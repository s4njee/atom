import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AromaticRingPair,
  ATOM_SCALES,
  BondElectronPair,
  Nucleus,
  StructuralBond,
} from '../core'

export function AtropineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.6
  const atomDefs = [
    // PubChem CID 174174, 3D conformer heavy-atom coordinates.
    { key: 'o1', element: 'O', scale: ATOM_SCALES.O, position: [-0.3627 * scale, 0.3694 * scale, 0.8291 * scale] },
    { key: 'o2', element: 'O', scale: ATOM_SCALES.O, position: [0.6817 * scale, -0.5873 * scale, -0.987 * scale] },
    { key: 'o3', element: 'O', scale: ATOM_SCALES.O, position: [0.7298 * scale, 2.9774 * scale, 0.2128 * scale] },
    { key: 'n4', element: 'N', scale: ATOM_SCALES.N, position: [-4.27 * scale, 0.5499 * scale, -0.192 * scale] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-3.4977 * scale, -0.1941 * scale, -1.205 * scale] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [-4.0753 * scale, -0.2608 * scale, 1.025 * scale] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [-3.8296 * scale, -1.6658 * scale, -0.9353 * scale] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [-4.2133 * scale, -1.7103 * scale, 0.5459 * scale] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [-2.0131 * scale, 0.1194 * scale, -0.9336 * scale] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [-2.6501 * scale, 0.0458 * scale, 1.5259 * scale] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [-1.5755 * scale, -0.2876 * scale, 0.4814 * scale] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [-5.6777 * scale, 0.7007 * scale, -0.552 * scale] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [0.7053 * scale, 0.1329 * scale, 0.0029 * scale] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [1.9275 * scale, 0.8965 * scale, 0.5049 * scale] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [3.2072 * scale, 0.127 * scale, 0.2187 * scale] },
    { key: 'c16', element: 'C', scale: ATOM_SCALES.C, position: [1.9529 * scale, 2.3125 * scale, -0.0882 * scale] },
    { key: 'c17', element: 'C', scale: ATOM_SCALES.C, position: [3.6767 * scale, -0.7645 * scale, 1.1627 * scale] },
    { key: 'c18', element: 'C', scale: ATOM_SCALES.C, position: [3.8636 * scale, 0.3421 * scale, -0.9768 * scale] },
    { key: 'c19', element: 'C', scale: ATOM_SCALES.C, position: [4.851 * scale, -1.4701 * scale, 0.9004 * scale] },
    { key: 'c20', element: 'C', scale: ATOM_SCALES.C, position: [5.0378 * scale, -0.3636 * scale, -1.2392 * scale] },
    { key: 'c21', element: 'C', scale: ATOM_SCALES.C, position: [5.5315 * scale, -1.2697 * scale, -0.3006 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const phenylRingKeys = ['c15', 'c17', 'c19', 'c21', 'c20', 'c18']
  const phenylRingPoints = phenylRingKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['o1', 'c11'],
    ['o1', 'c13'],
    ['o2', 'c13'],
    ['o3', 'c16'],
    ['n4', 'c5'],
    ['n4', 'c6'],
    ['n4', 'c12'],
    ['c5', 'c7'],
    ['c5', 'c9'],
    ['c6', 'c8'],
    ['c6', 'c10'],
    ['c7', 'c8'],
    ['c9', 'c11'],
    ['c10', 'c11'],
    ['c13', 'c14'],
    ['c14', 'c15'],
    ['c14', 'c16'],
    ['c15', 'c17'],
    ['c15', 'c18'],
    ['c17', 'c19'],
    ['c18', 'c20'],
    ['c19', 'c21'],
    ['c20', 'c21'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.18 + t * 0.076
    moleculeRef.current.rotation.x = 0.24 + Math.sin(t * 0.16) * 0.04
    moleculeRef.current.rotation.z = -0.12 + Math.sin(t * 0.11) * 0.024
    moleculeRef.current.position.y = Math.sin(t * 0.34) * 0.05
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
        .filter(([startKey, endKey]) => (
          !phenylRingKeys.includes(startKey) || !phenylRingKeys.includes(endKey)
        ))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 7 ? '#8fd4ff' : '#a7ddff'}
            colorB={index < 7 ? '#c9edff' : '#e6f7ff'}
            speed={8.25 + (index % 5) * 0.44}
            phase={index * 0.38}
            spread={index < 5 ? 0.08 : 0.07}
            lineScale={index < 5 ? 0.27 : 0.23}
          />
        ))}

      <AromaticRingPair ringPoints={phenylRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.5} />
      <AromaticRingPair ringPoints={phenylRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.7} />
    </group>
  )
}
