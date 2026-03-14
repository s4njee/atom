import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AromaticRingPair,
  ATOM_SCALES,
  DoubleBond,
  Nucleus,
  SingleBond,
  StructuralBond,
} from '../core'

export function CapsaicinMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.72
  const atomDefs = [
    // Approximate heavy-atom layout for capsaicin emphasizing the vanillyl ring and amide tail.
    { key: 'c1', element: 'C', scale: ATOM_SCALES.C, position: [1.12 * scale, 0.02 * scale, 0.02 * scale] },
    { key: 'c2', element: 'C', scale: ATOM_SCALES.C, position: [0.56 * scale, 0.96 * scale, 0.01 * scale] },
    { key: 'c3', element: 'C', scale: ATOM_SCALES.C, position: [-0.56 * scale, 0.98 * scale, -0.03 * scale] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-1.16 * scale, 0.02 * scale, -0.02 * scale] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-0.58 * scale, -0.96 * scale, 0.03 * scale] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [0.56 * scale, -0.94 * scale, 0.01 * scale] },
    { key: 'o3', element: 'O', scale: ATOM_SCALES.O, position: [-1.08 * scale, 1.9 * scale, -0.18 * scale] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [-2.08 * scale, 2.56 * scale, -0.34 * scale] },
    { key: 'o4', element: 'O', scale: ATOM_SCALES.O, position: [-2.34 * scale, -0.04 * scale, -0.16 * scale] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [2.3 * scale, 0.08 * scale, 0.18 * scale] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [3.34 * scale, -0.44 * scale, 0.48 * scale] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [4.48 * scale, 0.02 * scale, 0.68 * scale] },
    { key: 'o9', element: 'O', scale: ATOM_SCALES.O, position: [4.88 * scale, 1.08 * scale, 0.22 * scale] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [5.42 * scale, -0.92 * scale, 1.24 * scale] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [6.68 * scale, -0.58 * scale, 1.54 * scale] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [7.76 * scale, -1.34 * scale, 2.02 * scale] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [9.04 * scale, -1.02 * scale, 2.28 * scale] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [10.12 * scale, -1.76 * scale, 2.72 * scale] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [11.28 * scale, -1.42 * scale, 2.96 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const ringKeys = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
  const ringPoints = ringKeys.map((key) => atoms[key])
  const doubleBondKeys = new Set(['c9-o9', 'c11-c12'])

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
    ['o3', 'c7'],
    ['c4', 'o4'],
    ['c1', 'c8'],
    ['c8', 'n1'],
    ['n1', 'c9'],
    ['c9', 'o9'],
    ['c9', 'c10'],
    ['c10', 'c11'],
    ['c11', 'c12'],
    ['c12', 'c13'],
    ['c13', 'c14'],
    ['c14', 'c15'],
  ]
  const tailBondDefs = bondDefs.filter(
    ([startKey, endKey]) => !ringKeys.includes(startKey) || !ringKeys.includes(endKey),
  )
  const ringBondDefs = bondDefs.filter(
    ([startKey, endKey]) => ringKeys.includes(startKey) && ringKeys.includes(endKey),
  )

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.32 + t * 0.082
    moleculeRef.current.rotation.x = Math.sin(t * 0.18) * 0.05
    moleculeRef.current.rotation.z = 0.24 + Math.sin(t * 0.12) * 0.024
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

      {ringBondDefs.map(([startKey, endKey]) => (
        <StructuralBond
          key={`structure-${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
        />
      ))}

      {tailBondDefs.map(([startKey, endKey], index) => {
        const bondKey = `${startKey}-${endKey}`
        const electronProps = {
          colorA: index < 5 ? '#8fd4ff' : '#9edbff',
          colorB: index < 5 ? '#c9edff' : '#dff5ff',
          speed: 8.2 + (index % 5) * 0.46,
          phase: index * 0.39,
          spread: index < 4 ? 0.08 : 0.07,
          lineScale: index < 4 ? 0.26 : 0.23,
        }

        if (doubleBondKeys.has(bondKey)) {
          return (
            <DoubleBond
              key={bondKey}
              start={atoms[startKey]}
              end={atoms[endKey]}
              color="#77b4df"
              opacity={0.42}
              sigmaProps={electronProps}
              piPairs={[
                {
                  sign: 1,
                  colorA: '#9edbff',
                  colorB: '#dff5ff',
                  speed: 10.9 + (index % 3) * 0.34,
                  phase: index * 0.39,
                },
                {
                  sign: -1,
                  colorA: '#7fc3ff',
                  colorB: '#c9edff',
                  speed: 10.3 + (index % 3) * 0.3,
                  phase: index * 0.39 + Math.PI * 0.56,
                },
              ]}
            />
          )
        }

        return (
          <SingleBond
            key={bondKey}
            start={atoms[startKey]}
            end={atoms[endKey]}
            color="#77b4df"
            opacity={0.42}
            electronProps={electronProps}
          />
        )
      })}

      <AromaticRingPair ringPoints={ringPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.9} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#7fc3ff" colorB="#bfe7ff" speed={11.2} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#9edbff" colorB="#eefbff" speed={10.5} />
    </group>
  )
}
