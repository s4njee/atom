import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AromaticRingPair,
  ATOM_SCALES,
  BondElectronPair,
  Nucleus,
  StructuralBond,
} from '../core'

export function QuetiapineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.58
  const atomDefs = [
    // PubChem CID 5002, 2D heavy-atom coordinates centered from the compound record.
    { key: 's1', element: 'S', scale: ATOM_SCALES.S, position: [0 * scale, -4.8944 * scale, 0] },
    { key: 'o1', element: 'O', scale: ATOM_SCALES.O, position: [-2.106 * scale, 2.6274 * scale, 0] },
    { key: 'o2', element: 'O', scale: ATOM_SCALES.O, position: [-1.4133 * scale, 5.1808 * scale, 0] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [-1.8016 * scale, -0.0009 * scale, 0] },
    { key: 'n2', element: 'N', scale: ATOM_SCALES.N, position: [-0.9339 * scale, -1.8028 * scale, 0] },
    { key: 'n3', element: 'N', scale: ATOM_SCALES.N, position: [0.5 * scale, -2.7038 * scale, 0] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [-2.3649 * scale, -0.8271 * scale, 0] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [-0.8044 * scale, -0.0756 * scale, 0] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [-1.9311 * scale, -1.728 * scale, 0] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [-0.3705 * scale, -0.9766 * scale, 0] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [-2.2355 * scale, 0.9001 * scale, 0] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [-0.5 * scale, -2.7038 * scale, 0] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [-1.6722 * scale, 1.7264 * scale, 0] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [-1.1235 * scale, -3.4855 * scale, 0] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [-0.901 * scale, -4.4605 * scale, 0] },
    { key: 'c16', element: 'C', scale: ATOM_SCALES.C, position: [-2.114 * scale, -3.1632 * scale, 0] },
    { key: 'c17', element: 'C', scale: ATOM_SCALES.C, position: [1.1235 * scale, -3.4855 * scale, 0] },
    { key: 'c18', element: 'C', scale: ATOM_SCALES.C, position: [0.901 * scale, -4.4605 * scale, 0] },
    { key: 'c19', element: 'C', scale: ATOM_SCALES.C, position: [-1.6535 * scale, -5.1807 * scale, 0] },
    { key: 'c20', element: 'C', scale: ATOM_SCALES.C, position: [-1.5427 * scale, 3.4536 * scale, 0] },
    { key: 'c21', element: 'C', scale: ATOM_SCALES.C, position: [-2.883 * scale, -3.8659 * scale, 0] },
    { key: 'c22', element: 'C', scale: ATOM_SCALES.C, position: [-2.6512 * scale, -4.8814 * scale, 0] },
    { key: 'c23', element: 'C', scale: ATOM_SCALES.C, position: [2.114 * scale, -3.1632 * scale, 0] },
    { key: 'c24', element: 'C', scale: ATOM_SCALES.C, position: [1.6535 * scale, -5.1807 * scale, 0] },
    { key: 'c25', element: 'C', scale: ATOM_SCALES.C, position: [-1.9766 * scale, 4.3546 * scale, 0] },
    { key: 'c26', element: 'C', scale: ATOM_SCALES.C, position: [2.883 * scale, -3.8659 * scale, 0] },
    { key: 'c27', element: 'C', scale: ATOM_SCALES.C, position: [2.6512 * scale, -4.8814 * scale, 0] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const leftRingKeys = ['c14', 'c15', 'c19', 'c22', 'c21', 'c16']
  const rightRingKeys = ['c17', 'c18', 'c24', 'c27', 'c26', 'c23']
  const leftRingPoints = leftRingKeys.map((key) => atoms[key])
  const rightRingPoints = rightRingKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
    S: { color: '#c8a24f', emissive: '#7e5f1d', emissiveIntensity: 1.3 },
  }

  const bondDefs = [
    ['s1', 'c15'],
    ['s1', 'c18'],
    ['o1', 'c13'],
    ['o1', 'c20'],
    ['o2', 'c25'],
    ['n1', 'c7'],
    ['n1', 'c8'],
    ['n1', 'c11'],
    ['n2', 'c9'],
    ['n2', 'c10'],
    ['n2', 'c12'],
    ['n3', 'c12'],
    ['n3', 'c17'],
    ['c7', 'c9'],
    ['c8', 'c10'],
    ['c11', 'c13'],
    ['c12', 'c14'],
    ['c14', 'c15'],
    ['c14', 'c16'],
    ['c15', 'c19'],
    ['c16', 'c21'],
    ['c17', 'c18'],
    ['c17', 'c23'],
    ['c18', 'c24'],
    ['c19', 'c22'],
    ['c20', 'c25'],
    ['c21', 'c22'],
    ['c23', 'c26'],
    ['c24', 'c27'],
    ['c26', 'c27'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.12 + t * 0.074
    moleculeRef.current.rotation.x = 0.26 + Math.sin(t * 0.16) * 0.04
    moleculeRef.current.rotation.z = 0.18 + Math.sin(t * 0.12) * 0.02
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
          !leftRingKeys.includes(startKey) || !leftRingKeys.includes(endKey)
        ) && (
          !rightRingKeys.includes(startKey) || !rightRingKeys.includes(endKey)
        ))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 8 ? '#8fd4ff' : '#a7ddff'}
            colorB={index < 8 ? '#c9edff' : '#e1f6ff'}
            speed={8.2 + (index % 5) * 0.44}
            phase={index * 0.37}
            spread={index < 5 ? 0.08 : 0.07}
            lineScale={index < 5 ? 0.27 : 0.23}
          />
        ))}

      <AromaticRingPair ringPoints={leftRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.7} />
      <AromaticRingPair ringPoints={leftRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.9} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.4} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.6} />
    </group>
  )
}
