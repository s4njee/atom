/**
 * Protein data shape (used by files in src/data/proteins/):
 *
 *   {
 *     name: string,
 *     chains: [
 *       {
 *         id: string,
 *         residues: [
 *           { resNum: number, resName: string, ca: [x, y, z], ss: 'helix'|'strand'|'loop' },
 *           ...
 *         ],
 *       },
 *     ],
 *     disulfides: [{ chainA, resA, chainB, resB }],
 *     boundingRadius: number,   // used for camera placement
 *     ligands?: [],
 *   }
 *
 * Coordinates are pre-extracted from PDB structures (Cα-only), scaled to
 * roughly 4–6 unit world span. SS labels come from DSSP (H/G/I -> 'helix',
 * E/B -> 'strand', else 'loop'). No runtime parsing.
 */

/**
 * Group consecutive residues by SS type into segments suitable for
 * rendering as a single backbone tube.
 *
 * Returns: [{ type, residues, caPositions }]
 *
 * Adjacent segments overlap by one residue (the boundary residue is
 * included in both the previous and next segment) so the rendered tubes
 * meet without visible gaps.
 */
export function segmentBySSType(residues) {
  if (!residues || residues.length === 0) return []

  const segments = []
  let current = { type: residues[0].ss, residues: [residues[0]] }

  for (let i = 1; i < residues.length; i++) {
    const r = residues[i]
    if (r.ss === current.type) {
      current.residues.push(r)
    } else {
      current.residues.push(r)
      segments.push(finalize(current))
      current = { type: r.ss, residues: [residues[i - 1], r] }
    }
  }

  segments.push(finalize(current))
  return segments
}

function finalize(seg) {
  return {
    type: seg.type,
    residues: seg.residues,
    caPositions: seg.residues.map((r) => r.ca),
  }
}

/**
 * Build a flat lookup so disulfides can resolve their endpoints in O(1).
 */
export function buildResidueIndex(chains) {
  const index = new Map()
  for (const chain of chains) {
    for (const r of chain.residues) {
      index.set(`${chain.id}:${r.resNum}`, r)
    }
  }
  return index
}

export function lookupCa(index, chainId, resNum) {
  const r = index.get(`${chainId}:${resNum}`)
  return r ? r.ca : null
}
