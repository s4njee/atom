/**
 * PubChem PUG REST integration
 *
 * Responsible for:
 *  - Autocomplete suggestions (live-as-you-type)
 *  - Resolving a compound name → CID
 *  - Fetching the 3D conformer JSON for a CID
 *  - Parsing PubChem's compound JSON into the { atomDefs, bondDefs } schema
 *    used by DynamicMolecule
 *
 * All successful fetches are cached in a module-level Map so switching back
 * to a previously viewed molecule costs zero network requests.
 */

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const AUTOCOMPLETE_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound'

// ---------------------------------------------------------------------------
// Atom-scale constants (mirroring ATOM_SCALES in core.jsx, kept here so this
// module has no React dependency and stays independently testable)
// ---------------------------------------------------------------------------

const ATOM_SCALE_MAP = {
  H: 0.09,
  C: 0.22,
  N: 0.205,
  O: 0.19,
  F: 0.16,
  P: 0.235,
  S: 0.24,
  Cl: 0.245,
  Br: 0.26,
  I:  0.28,
}
const DEFAULT_ATOM_SCALE = 0.22

// Atomic number → element symbol for all elements relevant to organic chemistry
const ELEMENT_SYMBOLS = {
  1:  'H',  2:  'He', 3:  'Li', 4:  'Be', 5:  'B',
  6:  'C',  7:  'N',  8:  'O',  9:  'F',  10: 'Ne',
  11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P',
  16: 'S',  17: 'Cl', 18: 'Ar', 19: 'K',  20: 'Ca',
  26: 'Fe', 29: 'Cu', 30: 'Zn', 35: 'Br', 53: 'I',
}

// ---------------------------------------------------------------------------
// Module-level result cache  { key → MoleculeResult }
// ---------------------------------------------------------------------------

const MOLECULE_CACHE = new Map()

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Centers the positions on their centroid and scales so the largest atom-to-
 * centroid distance equals `targetRadius` units.  This keeps every molecule
 * consistently sized in the Three.js viewport regardless of its physical
 * dimensions in Angstroms.
 */
function centerAndScale(positions, targetRadius = 2.4) {
  const n = positions.length
  if (n === 0) return []

  let cx = 0, cy = 0, cz = 0
  for (const [x, y, z] of positions) { cx += x; cy += y; cz += z }
  cx /= n; cy /= n; cz /= n

  const centered = positions.map(([x, y, z]) => [x - cx, y - cy, z - cz])

  let maxDist = 0
  for (const [x, y, z] of centered) {
    const d = Math.sqrt(x * x + y * y + z * z)
    if (d > maxDist) maxDist = d
  }

  const scale = maxDist > 0 ? targetRadius / maxDist : 1
  return centered.map(([x, y, z]) => [x * scale, y * scale, z * scale])
}

// ---------------------------------------------------------------------------
// PubChem JSON → internal schema
// ---------------------------------------------------------------------------

/**
 * Converts a single PC_Compounds entry from the PubChem 3D JSON response into
 * the { atomDefs, bondDefs, formula } schema expected by DynamicMolecule.
 *
 * Throws if the compound has no usable 3D coordinates.
 */
function parseCompound(compound) {
  const { atoms, bonds, coords, props } = compound

  if (!atoms?.aid?.length) throw new Error('Compound has no atom data.')
  if (!coords?.length)     throw new Error('Compound has no coordinate data.')

  // Find the first coordinate set that contains 3D (z) data
  let conformer = null
  let coordAids = atoms.aid

  for (const coordSet of coords) {
    const c = coordSet.conformers?.[0]
    if (c?.z?.length) {
      conformer = c
      // coords can have their own atom-id mapping; fall back to the global list
      coordAids = coordSet.aid ?? atoms.aid
      break
    }
  }

  if (!conformer) {
    throw new Error(
      'No 3D conformer is available for this compound in PubChem. ' +
      'Try a more common molecule.'
    )
  }

  // Build atom-id → [x, y, z] lookup
  const posMap = new Map()
  coordAids.forEach((aid, i) => {
    posMap.set(aid, [conformer.x[i] ?? 0, conformer.y[i] ?? 0, conformer.z[i] ?? 0])
  })

  const rawPositions = atoms.aid.map((aid) => posMap.get(aid) ?? [0, 0, 0])
  const scaledPositions = centerAndScale(rawPositions)

  const atomDefs = atoms.aid.map((aid, i) => {
    const element = ELEMENT_SYMBOLS[atoms.element[i]] ?? 'C'
    return {
      key:      `a${aid}`,
      element,
      scale:    ATOM_SCALE_MAP[element] ?? DEFAULT_ATOM_SCALE,
      position: scaledPositions[i],
    }
  })

  const bondDefs = !bonds ? [] : bonds.aid1.map((aid1, i) => ({
    from:  `a${aid1}`,
    to:    `a${bonds.aid2[i]}`,
    order: bonds.order?.[i] ?? 1,
  }))

  // The 3D record sometimes embeds the formula in its props array
  const formula = props
    ?.find((p) => p.urn?.label === 'Molecular Formula')
    ?.value?.sval ?? ''

  return { atomDefs, bondDefs, formula }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns up to 8 compound name suggestions for the given partial query.
 * Safe to call on every keystroke — returns [] on network failure.
 */
async function fetchAutocomplete(query) {
  if (!query || query.trim().length < 2) return []

  try {
    const res = await fetch(
      `${AUTOCOMPLETE_BASE}/${encodeURIComponent(query.trim())}/JSON?limit=8`,
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.dictionary_terms?.compound ?? []
  } catch {
    return []
  }
}

/**
 * Resolves `nameOrCid` (a compound name string, or a numeric CID) to a
 * full molecule result and caches it.
 *
 * Returns: { cid, name, formula, atomDefs, bondDefs }
 * Throws a user-readable Error string on failure.
 */
async function fetchMolecule(nameOrCid) {
  const trimmed = String(nameOrCid).trim()
  const cacheKey = trimmed.toLowerCase()

  if (MOLECULE_CACHE.has(cacheKey)) return MOLECULE_CACHE.get(cacheKey)

  // Determine whether we were given a CID directly
  const isNumericCid = /^\d+$/.test(trimmed)

  let cid
  let displayName

  if (isNumericCid) {
    cid = Number(trimmed)
    displayName = `CID ${cid}`
  } else {
    // Resolve name → CID
    const cidRes = await fetch(
      `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(trimmed)}/cids/JSON`,
    )
    if (!cidRes.ok) throw new Error(`"${trimmed}" was not found in PubChem.`)

    const cidData = await cidRes.json()
    cid = cidData.IdentifierList?.CID?.[0]
    if (!cid) throw new Error(`No compound matched "${trimmed}".`)
    displayName = trimmed
  }

  // Check cache by CID in case the same compound was previously fetched under
  // a different name key
  const cidKey = `cid:${cid}`
  if (MOLECULE_CACHE.has(cidKey)) {
    const cached = MOLECULE_CACHE.get(cidKey)
    MOLECULE_CACHE.set(cacheKey, cached)
    return cached
  }

  // Fetch 3D conformer + properties in parallel
  const [conformerRes, propRes] = await Promise.all([
    fetch(`${PUBCHEM_BASE}/compound/cid/${cid}/JSON?record_type=3d`),
    fetch(`${PUBCHEM_BASE}/compound/cid/${cid}/property/MolecularFormula/JSON`),
  ])

  if (!conformerRes.ok) {
    throw new Error(
      `PubChem does not have a 3D structure for this compound (CID ${cid}). ` +
      'Try a smaller organic molecule.'
    )
  }

  const conformerData = await conformerRes.json()
  const compound = conformerData.PC_Compounds?.[0]
  if (!compound) throw new Error('Unexpected response format from PubChem.')

  const parsed = parseCompound(compound)

  // Prefer the formula embedded in the conformer; fall back to the property endpoint
  let formula = parsed.formula
  if (!formula && propRes.ok) {
    const propData = await propRes.json()
    formula = propData.PropertyTable?.Properties?.[0]?.MolecularFormula ?? ''
  }

  const result = {
    cid,
    name: displayName,
    formula,
    atomDefs: parsed.atomDefs,
    bondDefs: parsed.bondDefs,
  }

  MOLECULE_CACHE.set(cacheKey, result)
  MOLECULE_CACHE.set(cidKey, result)

  return result
}

export { fetchAutocomplete, fetchMolecule }
