import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ATOM_SCALES, DoubleBond, SingleBond } from '../core'
import { AtomInstances } from './helpers'

export function EthyleneMolecule() {
  const moleculeRef = useRef(null)
  const carbonLeft = [-0.92, 0, 0]
  const carbonRight = [0.92, 0, 0]
  const hydrogens = [
    [-1.86, 0.98, 0],
    [-1.86, -0.98, 0],
    [1.86, 0.98, 0],
    [1.86, -0.98, 0],
  ]
  const singleBondDefs = [
    {
      start: carbonLeft,
      end: hydrogens[0],
      electronProps: { colorA: '#7fc3ff', colorB: '#a7ddff', speed: 9.8, phase: 0.4 },
    },
    {
      start: carbonLeft,
      end: hydrogens[1],
      electronProps: { colorA: '#7fc3ff', colorB: '#a7ddff', speed: 9.2, phase: 1.2 },
    },
    {
      start: carbonRight,
      end: hydrogens[2],
      electronProps: { colorA: '#7fc3ff', colorB: '#a7ddff', speed: 10.1, phase: 2.1 },
    },
    {
      start: carbonRight,
      end: hydrogens[3],
      electronProps: { colorA: '#7fc3ff', colorB: '#a7ddff', speed: 9.4, phase: 2.8 },
    },
  ]
  const atomDefs = [
    { key: 'c-left', element: 'C', scale: ATOM_SCALES.C, position: carbonLeft },
    { key: 'c-right', element: 'C', scale: ATOM_SCALES.C, position: carbonRight },
    ...hydrogens.map((position, index) => ({
      key: `h-${index}`,
      element: 'H',
      scale: ATOM_SCALES.H,
      position,
    })),
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.12
    moleculeRef.current.rotation.x = Math.sin(t * 0.2) * 0.035
    moleculeRef.current.position.y = Math.sin(t * 0.45) * 0.06
  })

  return (
    <group ref={moleculeRef}>
      <AtomInstances atomDefs={atomDefs} />

      {singleBondDefs.map(({ start, end, electronProps }, index) => (
        <SingleBond
          key={`single-${index}`}
          start={start}
          end={end}
          showStructure={false}
          electronProps={electronProps}
        />
      ))}

      <DoubleBond
        start={carbonLeft}
        end={carbonRight}
        showStructure={false}
        sigmaProps={{
          colorA: '#c7ebff',
          colorB: '#9fdfff',
          speed: 10.8,
          phase: 0,
          spread: 0.1,
        }}
        piPairs={[
          { sign: 1, colorA: '#9dd8ff', colorB: '#c5ebff', speed: 11.9, phase: 0 },
          { sign: -1, colorA: '#6fbfff', colorB: '#9ed9ff', speed: 11.1, phase: Math.PI * 0.7 },
        ]}
      />
    </group>
  )
}
