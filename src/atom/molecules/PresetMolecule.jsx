/**
 * PresetMolecule — generic renderer for JSON-defined preset molecules.
 *
 * Reads a molecule data object (from molecules/data/*.json) and renders it
 * using AtomInstances + Bond + AromaticRingPair. Ring bonds are rendered as
 * StructuralBond (no electron animation) when the aromaticRing has
 * structural:true.
 */
import { useMemo, useRef } from 'react'
import { ATOM_SCALES, AromaticRingPair } from '../core'
import { AtomInstances, createAtomPositionLookup, useMoleculeAnimation } from './helpers'
import { Bond } from './Bond'

export function PresetMolecule({ data }) {
  const moleculeRef = useRef(null)
  const {
    positionScale = 1,
    animation = {},
    atoms: rawAtoms,
    bonds,
    aromaticRings = [],
  } = data

  // Build atomDefs: apply positionScale and look up sphere scale per element.
  const atomDefs = useMemo(
    () =>
      rawAtoms.map(({ key, element, position }) => ({
        key,
        element,
        scale: ATOM_SCALES[element] ?? ATOM_SCALES.C,
        position: [
          position[0] * positionScale,
          position[1] * positionScale,
          position[2] * positionScale,
        ],
      })),
    [rawAtoms, positionScale],
  )

  const atomPositions = useMemo(
    () => createAtomPositionLookup(atomDefs),
    [atomDefs],
  )

  useMoleculeAnimation(moleculeRef, animation)

  // Pre-compute which bond pairs are structural (ring backbone).
  // A bond is structural when both endpoints belong to a ring marked structural:true.
  const structuralPairs = useMemo(() => {
    const pairs = new Set()
    aromaticRings.forEach(({ keys, structural }) => {
      if (!structural) return
      const keySet = new Set(keys)
      bonds.forEach(({ from, to }) => {
        if (keySet.has(from) && keySet.has(to)) {
          pairs.add(`${from}-${to}`)
          pairs.add(`${to}-${from}`)
        }
      })
    })
    return pairs
  }, [aromaticRings, bonds])

  return (
    <group ref={moleculeRef}>
      <AtomInstances atomDefs={atomDefs} />

      {bonds.map(({ from, to, order = 1 }, index) => {
        const start = atomPositions[from]
        const end = atomPositions[to]
        if (!start || !end) return null
        const isStructural = structuralPairs.has(`${from}-${to}`)
        return (
          <Bond
            key={`${from}-${to}`}
            start={start}
            end={end}
            order={order}
            structural={isStructural}
            index={index}
          />
        )
      })}

      {aromaticRings.flatMap(({ keys, pairs = [] }, ringIndex) => {
        const ringPoints = keys.map((k) => atomPositions[k]).filter(Boolean)
        if (ringPoints.length < 3) return []
        return pairs.map((pair, pairIndex) => (
          <AromaticRingPair
            key={`ring-${ringIndex}-${pairIndex}`}
            ringPoints={ringPoints}
            colorA={pair.colorA}
            colorB={pair.colorB}
            speed={pair.speed}
          />
        ))
      })}
    </group>
  )
}
