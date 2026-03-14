import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AromaticRingPair,
  ATOM_SCALES,
  BondElectronPair,
  Nucleus,
  StructuralBond,
} from '../core'

export function LSDMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.74
  const atomDefs = [
    // PubChem CID 5761, 2D heavy-atom coordinates centered from the compound record.
    { key: 'o1', element: 'O', scale: ATOM_SCALES.O, position: [-2.4942 * scale, 0.8021 * scale, 0] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [1.0379 * scale, 0.8019 * scale, 0] },
    { key: 'n2', element: 'N', scale: ATOM_SCALES.N, position: [2.0259 * scale, -3.3883 * scale, 0] },
    { key: 'n3', element: 'N', scale: ATOM_SCALES.N, position: [-1.634 * scale, 2.3055 * scale, 0] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [1.0219 * scale, -0.2396 * scale, 0] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [0.1558 * scale, -0.7395 * scale, 0] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [1.8879 * scale, -0.7395 * scale, 0] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [-0.7622 * scale, 0.8089 * scale, 0] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [0.1399 * scale, 1.3297 * scale, 0] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [1.8879 * scale, -1.7396 * scale, 0] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [0.1558 * scale, -1.7396 * scale, 0] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [1.0219 * scale, -2.2395 * scale, 0] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [-0.7542 * scale, -0.2327 * scale, 0] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [1.0379 * scale, -3.2811 * scale, 0] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [1.9097 * scale, 1.2919 * scale, 0] },
    { key: 'c16', element: 'C', scale: ATOM_SCALES.C, position: [-1.6301 * scale, 1.3056 * scale, 0] },
    { key: 'c17', element: 'C', scale: ATOM_SCALES.C, position: [2.5058 * scale, -2.5179 * scale, 0] },
    { key: 'c18', element: 'C', scale: ATOM_SCALES.C, position: [-0.7542 * scale, -2.2464 * scale, 0] },
    { key: 'c19', element: 'C', scale: ATOM_SCALES.C, position: [0.1399 * scale, -3.8089 * scale, 0] },
    { key: 'c20', element: 'C', scale: ATOM_SCALES.C, position: [-0.7622 * scale, -3.288 * scale, 0] },
    { key: 'c21', element: 'C', scale: ATOM_SCALES.C, position: [-2.5019 * scale, 2.8021 * scale, 0] },
    { key: 'c22', element: 'C', scale: ATOM_SCALES.C, position: [-0.7699 * scale, 2.8089 * scale, 0] },
    { key: 'c23', element: 'C', scale: ATOM_SCALES.C, position: [-2.5058 * scale, 3.8021 * scale, 0] },
    { key: 'c24', element: 'C', scale: ATOM_SCALES.C, position: [-0.7738 * scale, 3.8089 * scale, 0] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const benzeneRingKeys = ['c11', 'c12', 'c14', 'c19', 'c20', 'c18']
  const indoleRingKeys = ['c10', 'c12', 'c14', 'n2', 'c17']
  const benzeneRingPoints = benzeneRingKeys.map((key) => atoms[key])
  const indoleRingPoints = indoleRingKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['o1', 'c16'],
    ['n1', 'c5'],
    ['n1', 'c9'],
    ['n1', 'c15'],
    ['n2', 'c14'],
    ['n2', 'c17'],
    ['n3', 'c16'],
    ['n3', 'c21'],
    ['n3', 'c22'],
    ['c5', 'c6'],
    ['c5', 'c7'],
    ['c6', 'c11'],
    ['c6', 'c13'],
    ['c7', 'c10'],
    ['c8', 'c9'],
    ['c8', 'c13'],
    ['c8', 'c16'],
    ['c10', 'c12'],
    ['c10', 'c17'],
    ['c11', 'c12'],
    ['c11', 'c18'],
    ['c12', 'c14'],
    ['c14', 'c19'],
    ['c18', 'c20'],
    ['c19', 'c20'],
    ['c21', 'c23'],
    ['c22', 'c24'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = 0.16 + t * 0.078
    moleculeRef.current.rotation.x = 0.28 + Math.sin(t * 0.16) * 0.04
    moleculeRef.current.rotation.z = -0.18 + Math.sin(t * 0.12) * 0.022
    moleculeRef.current.position.y = Math.sin(t * 0.36) * 0.05
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
          !benzeneRingKeys.includes(startKey) || !benzeneRingKeys.includes(endKey)
        ) && (
          !indoleRingKeys.includes(startKey) || !indoleRingKeys.includes(endKey)
        ))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 8 ? '#8fd4ff' : '#a7ddff'}
            colorB={index < 8 ? '#c9edff' : '#e1f6ff'}
            speed={8.1 + (index % 5) * 0.42}
            phase={index * 0.36}
            spread={index < 6 ? 0.078 : 0.068}
            lineScale={index < 6 ? 0.26 : 0.22}
          />
        ))}

      <AromaticRingPair ringPoints={benzeneRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.6} />
      <AromaticRingPair ringPoints={benzeneRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.8} />
      <AromaticRingPair ringPoints={indoleRingPoints} colorA="#9edbff" colorB="#e6f7ff" speed={10.9} />
    </group>
  )
}
