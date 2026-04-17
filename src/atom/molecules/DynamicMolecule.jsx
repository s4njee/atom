/**
 * DynamicMolecule — generic renderer for molecules fetched from PubChem.
 *
 * Accepts the { atomDefs, bondDefs } schema produced by pubchem.js and
 * renders it using the same instanced atom + electron-bond pipeline as the
 * hand-authored molecule files, so PubChem molecules automatically inherit
 * hover / selection interactivity, x-ray mode, cinematic lighting, etc.
 *
 * Bond order mapping:
 *   1  → SingleBond
 *   2  → DoubleBond
 *   3  → DoubleBond  (triple bonds rendered as double — closest available)
 *   4  → SingleBond  (aromatic, slightly different colour)
 */

import { useMemo, useRef } from 'react'
import { AromaticRingPair, DoubleBond, SingleBond } from '../core'
import { AtomInstances, createAtomPositionLookup, useMoleculeAnimation } from './helpers'

// Electron style presets — vary slightly by bond type for visual richness
const ELECTRON_SINGLE = {
  colorA: '#8fd4ff',
  colorB: '#bce8ff',
  speed: 9.5,
  spread: 0.1,
  lineScale: 0.3,
}

const ELECTRON_DOUBLE_SIGMA = {
  colorA: '#9edbff',
  colorB: '#d1f0ff',
  speed: 8.8,
  spread: 0.09,
  lineScale: 0.28,
}

const ELECTRON_AROMATIC = {
  colorA: '#7ec8ff',
  colorB: '#a8ddff',
  speed: 9.2,
  spread: 0.08,
  lineScale: 0.26,
}

const AROMATIC_RING_PAIRS = Object.freeze([
  Object.freeze({ colorA: '#8fd4ff', colorB: '#d4f1ff', speed: 11.6 }),
  Object.freeze({ colorA: '#7fc3ff', colorB: '#c7ebff', speed: 10.9 }),
])

function getCycleKey(cycle) {
  return [...cycle].sort().join('|')
}

function detectAromaticRings(atomDefs = [], bondDefs = []) {
  const atomKeys = new Set(atomDefs.map(({ key }) => key))
  const graph = new Map()

  const addEdge = (from, to) => {
    if (!atomKeys.has(from) || !atomKeys.has(to)) return
    if (!graph.has(from)) graph.set(from, new Set())
    graph.get(from).add(to)
  }

  bondDefs.forEach(({ from, to, order }) => {
    if (order !== 4) return
    addEdge(from, to)
    addEdge(to, from)
  })

  const cycles = new Map()

  const visit = (start, current, path) => {
    if (path.length > 6) return

    for (const next of graph.get(current) ?? []) {
      if (next === start && path.length >= 5) {
        cycles.set(getCycleKey(path), path)
        continue
      }

      if (path.includes(next) || path.length === 6) continue
      visit(start, next, [...path, next])
    }
  }

  for (const start of graph.keys()) {
    visit(start, start, [start])
  }

  return Array.from(cycles.values()).map((keys) => ({
    keys,
    pairs: AROMATIC_RING_PAIRS,
  }))
}

export function DynamicMolecule({ atomDefs, bondDefs, aromaticRings = [] }) {
  const moleculeRef = useRef(null)

  useMoleculeAnimation(moleculeRef, {
    rotationSpeed: 0.085,
    rotationXAmplitude: 0.04,
    rotationXFrequency: 0.18,
    floatAmplitude: 0.05,
    floatFrequency: 0.38,
  })

  // Build the position lookup once per schema change
  const atomPositions = useMemo(
    () => createAtomPositionLookup(atomDefs),
    [atomDefs],
  )
  const inferredAromaticRings = useMemo(
    () => (aromaticRings.length > 0 ? aromaticRings : detectAromaticRings(atomDefs, bondDefs)),
    [aromaticRings, atomDefs, bondDefs],
  )

  return (
    <group ref={moleculeRef}>
      <AtomInstances atomDefs={atomDefs} />

      {bondDefs.map(({ from, to, order }, index) => {
        const start = atomPositions[from]
        const end = atomPositions[to]

        // Skip degenerate bonds where atoms aren't found (malformed data guard)
        if (!start || !end) return null

        const key = `${from}-${to}-${index}`
        const phase = index * 0.41

        if (order === 2 || order === 3) {
          return (
            <DoubleBond
              key={key}
              start={start}
              end={end}
              color="#77b4df"
              opacity={0.42}
              sigmaProps={{ ...ELECTRON_DOUBLE_SIGMA, phase }}
              piPairs={[
                {
                  sign: 1,
                  colorA: '#9dd8ff',
                  colorB: '#dff5ff',
                  speed: 11.1 + (index % 3) * 0.3,
                  phase,
                },
                {
                  sign: -1,
                  colorA: '#7fc3ff',
                  colorB: '#c7ebff',
                  speed: 10.6 + (index % 3) * 0.26,
                  phase: phase + Math.PI * 0.58,
                },
              ]}
            />
          )
        }

        const isAromatic = order === 4
        return (
          <SingleBond
            key={key}
            start={start}
            end={end}
            // Aromatic bonds use a slightly cooler, more diffuse hue
            color={isAromatic ? '#5fa0cc' : '#77b4df'}
            opacity={isAromatic ? 0.36 : 0.42}
            electronProps={{
              ...(isAromatic ? ELECTRON_AROMATIC : ELECTRON_SINGLE),
              phase,
            }}
          />
        )
      })}

      {inferredAromaticRings.flatMap(({ keys, pairs = [] }, ringIndex) => {
        const ringPoints = keys.map((key) => atomPositions[key]).filter(Boolean)
        if (ringPoints.length < 3) return []
        return pairs.map((pair, pairIndex) => (
          <AromaticRingPair
            key={`dynamic-ring-${ringIndex}-${pairIndex}`}
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
