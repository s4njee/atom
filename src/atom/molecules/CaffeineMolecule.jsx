import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ATOM_SCALES, DoubleBond, Nucleus, SingleBond } from '../core'
import { ATOM_RENDER_STYLES, createAtomPositionLookup } from './helpers'

export function CaffeineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.58
  const atomDefs = [
    // PubChem CID 2519, 3D conformer heavy-atom coordinates.
    { key: 'a1', element: 'O', scale: ATOM_SCALES.O, position: [0.4700 * scale, 2.5688 * scale, 0.0006 * scale] },
    { key: 'a2', element: 'O', scale: ATOM_SCALES.O, position: [-3.1271 * scale, -0.4436 * scale, -0.0003 * scale] },
    { key: 'a3', element: 'N', scale: ATOM_SCALES.N, position: [-0.9686 * scale, -1.3125 * scale, 0] },
    { key: 'a4', element: 'N', scale: ATOM_SCALES.N, position: [2.2182 * scale, 0.1412 * scale, -0.0003 * scale] },
    { key: 'a5', element: 'N', scale: ATOM_SCALES.N, position: [-1.3477 * scale, 1.0797 * scale, -0.0001 * scale] },
    { key: 'a6', element: 'N', scale: ATOM_SCALES.N, position: [1.4119 * scale, -1.9372 * scale, 0.0002 * scale] },
    { key: 'a7', element: 'C', scale: ATOM_SCALES.C, position: [0.8579 * scale, 0.2592 * scale, -0.0008 * scale] },
    { key: 'a8', element: 'C', scale: ATOM_SCALES.C, position: [0.3897 * scale, -1.0264 * scale, -0.0004 * scale] },
    { key: 'a9', element: 'C', scale: ATOM_SCALES.C, position: [0.0307 * scale, 1.4220 * scale, -0.0006 * scale] },
    { key: 'a10', element: 'C', scale: ATOM_SCALES.C, position: [-1.9061 * scale, -0.2495 * scale, -0.0004 * scale] },
    { key: 'a11', element: 'C', scale: ATOM_SCALES.C, position: [2.5032 * scale, -1.1998 * scale, 0.0003 * scale] },
    { key: 'a12', element: 'C', scale: ATOM_SCALES.C, position: [-1.4276 * scale, -2.6960 * scale, 0.0008 * scale] },
    { key: 'a13', element: 'C', scale: ATOM_SCALES.C, position: [3.1926 * scale, 1.2061 * scale, 0.0003 * scale] },
    { key: 'a14', element: 'C', scale: ATOM_SCALES.C, position: [-2.2969 * scale, 2.1881 * scale, 0.0007 * scale] },
  ]
  const atoms = createAtomPositionLookup(atomDefs)
  const doubleBondKeys = new Set(['a1-a9', 'a2-a10'])

  const bondDefs = [
    ['a1', 'a9'],
    ['a2', 'a10'],
    ['a3', 'a8'],
    ['a3', 'a10'],
    ['a3', 'a12'],
    ['a4', 'a7'],
    ['a4', 'a11'],
    ['a4', 'a13'],
    ['a5', 'a9'],
    ['a5', 'a10'],
    ['a5', 'a14'],
    ['a6', 'a8'],
    ['a6', 'a11'],
    ['a7', 'a8'],
    ['a7', 'a9'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.09
    moleculeRef.current.rotation.x = Math.sin(t * 0.18) * 0.04
    moleculeRef.current.position.y = Math.sin(t * 0.38) * 0.05
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

      {bondDefs.map(([startKey, endKey], index) => {
        const bondKey = `${startKey}-${endKey}`
        const electronProps = {
          colorA: index < 12 ? '#9edbff' : '#7fc3ff',
          colorB: index < 12 ? '#d1f0ff' : '#b7e6ff',
          speed: 8.6 + (index % 5) * 0.45,
          phase: index * 0.41,
          spread: index < 12 ? 0.09 : 0.07,
          lineScale: index < 12 ? 0.3 : 0.26,
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
                  speed: 11.1 + (index % 3) * 0.32,
                  phase: index * 0.41,
                },
                {
                  sign: -1,
                  colorA: '#7fc3ff',
                  colorB: '#c7ebff',
                  speed: 10.6 + (index % 3) * 0.28,
                  phase: index * 0.41 + Math.PI * 0.58,
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
    </group>
  )
}
