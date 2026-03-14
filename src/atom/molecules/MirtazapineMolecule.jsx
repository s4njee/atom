import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AromaticRingPair,
  ATOM_SCALES,
  Nucleus,
  SingleBond,
  StructuralBond,
} from '../core'
import { ATOM_RENDER_STYLES, createAtomPositionLookup } from './helpers'

export function MirtazapineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.82
  const atomDefs = [
    // PubChem CID 4205, 2D heavy-atom coordinates centered from the compound record.
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [-0.1696 * scale, -0.7951 * scale, 0] },
    { key: 'n2', element: 'N', scale: ATOM_SCALES.N, position: [-1.8703 * scale, -1.974 * scale, 0] },
    { key: 'n3', element: 'N', scale: ATOM_SCALES.N, position: [1.4839 * scale, -1.0814 * scale, 0] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-1.0706 * scale, -0.3612 * scale, 0] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-1.9402 * scale, -0.9347 * scale, 0] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [-0.0758 * scale, -1.8325 * scale, 0] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [-0.9319 * scale, -2.4259 * scale, 0] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [-1.2931 * scale, 0.6137 * scale, 0] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [0.7313 * scale, -0.3612 * scale, 0] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [-0.6696 * scale, 1.3955 * scale, 0] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [0.3304 * scale, 1.3955 * scale, 0] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [0.9539 * scale, 0.6137 * scale, 0] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [-2.6987 * scale, -2.5341 * scale, 0] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [-2.3254 * scale, 0.753 * scale, 0] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [-1.0352 * scale, 2.3709 * scale, 0] },
    { key: 'c16', element: 'C', scale: ATOM_SCALES.C, position: [1.9444 * scale, 0.936 * scale, 0] },
    { key: 'c17', element: 'C', scale: ATOM_SCALES.C, position: [-2.7134 * scale, 1.7197 * scale, 0] },
    { key: 'c18', element: 'C', scale: ATOM_SCALES.C, position: [-2.0639 * scale, 2.5341 * scale, 0] },
    { key: 'c19', element: 'C', scale: ATOM_SCALES.C, position: [2.7134 * scale, 0.2334 * scale, 0] },
    { key: 'c20', element: 'C', scale: ATOM_SCALES.C, position: [2.4816 * scale, -0.7821 * scale, 0] },
  ]
  const atoms = createAtomPositionLookup(atomDefs)
  const leftRingKeys = ['c8', 'c10', 'c15', 'c18', 'c17', 'c14']
  const rightRingKeys = ['c9', 'c12', 'c16', 'c19', 'c20', 'n3']
  const leftRingPoints = leftRingKeys.map((key) => atoms[key])
  const rightRingPoints = rightRingKeys.map((key) => atoms[key])

  const bondDefs = [
    ['n1', 'c4'],
    ['n1', 'c6'],
    ['n1', 'c9'],
    ['n2', 'c5'],
    ['n2', 'c7'],
    ['n2', 'c13'],
    ['n3', 'c9'],
    ['n3', 'c20'],
    ['c4', 'c5'],
    ['c4', 'c8'],
    ['c6', 'c7'],
    ['c8', 'c10'],
    ['c8', 'c14'],
    ['c9', 'c12'],
    ['c10', 'c11'],
    ['c10', 'c15'],
    ['c11', 'c12'],
    ['c12', 'c16'],
    ['c14', 'c17'],
    ['c15', 'c18'],
    ['c16', 'c19'],
    ['c17', 'c18'],
    ['c19', 'c20'],
  ]
  const bridgeBondDefs = bondDefs.filter(([startKey, endKey]) => (
    !leftRingKeys.includes(startKey) || !leftRingKeys.includes(endKey)
  ) && (
    !rightRingKeys.includes(startKey) || !rightRingKeys.includes(endKey)
  ))
  const ringBondDefs = bondDefs.filter(([startKey, endKey]) => (
    (leftRingKeys.includes(startKey) && leftRingKeys.includes(endKey)) ||
    (rightRingKeys.includes(startKey) && rightRingKeys.includes(endKey))
  ))

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.2 + t * 0.078
    moleculeRef.current.rotation.x = 0.22 + Math.sin(t * 0.17) * 0.04
    moleculeRef.current.rotation.z = -0.14 + Math.sin(t * 0.12) * 0.02
    moleculeRef.current.position.y = Math.sin(t * 0.34) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {atomDefs.map(({ key, element, scale }) => (
        <Nucleus
          key={key}
          position={atoms[key]}
          scale={scale}
          color={ATOM_RENDER_STYLES[element].color}
          emissive={ATOM_RENDER_STYLES[element].emissive}
          emissiveIntensity={ATOM_RENDER_STYLES[element].emissiveIntensity}
        />
      ))}

      {ringBondDefs.map(([startKey, endKey]) => (
        <StructuralBond
          key={`structure-${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
        />
      ))}

      {bridgeBondDefs.map(([startKey, endKey], index) => (
        <SingleBond
          key={`${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
          electronProps={{
            colorA: index < 6 ? '#8fd4ff' : '#a7ddff',
            colorB: index < 6 ? '#c9edff' : '#e6f7ff',
            speed: 8.3 + (index % 5) * 0.42,
            phase: index * 0.4,
            spread: index < 4 ? 0.08 : 0.07,
            lineScale: index < 4 ? 0.27 : 0.23,
          }}
        />
      ))}

      <AromaticRingPair ringPoints={leftRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.8} />
      <AromaticRingPair ringPoints={leftRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={11} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#9edbff" colorB="#e6f7ff" speed={11.3} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.5} />
    </group>
  )
}
