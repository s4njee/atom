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
 * Caching strategy (two tiers):
 *  1. Module-level Map  — instant in-session lookups (lost on page reload)
 *  2. localStorage      — persists across sessions with LRU eviction and TTL
 *
 * Both caches are keyed by lowercased query AND by "cid:<N>" so that the same
 * compound fetched under different names (e.g. "aspirin" vs CID 2244) resolves
 * to a single cached entry.
 */

import { fetchPubChemMoleculeSchema } from './schema/index.js'
import {
  ATOM_SCALES,
  DEFAULT_ATOM_SCALE,
  atomicNumberToElementSymbol,
} from './elements.js'

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const AUTOCOMPLETE_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound'
const KNOWN_CID_BY_QUERY = Object.freeze({
  mirtazapine: 4205,
  quetiapine: 5002,
})

// ---------------------------------------------------------------------------
// Module-level result cache  { key → MoleculeResult }
// ---------------------------------------------------------------------------

const MOLECULE_CACHE = new Map()

// ---------------------------------------------------------------------------
// localStorage persistence layer
// ---------------------------------------------------------------------------

/** Storage key prefix — all molecule cache entries live under this namespace. */
const LS_PREFIX = 'pubchem:'

/** Index key that tracks insertion order for LRU eviction. */
const LS_INDEX_KEY = 'pubchem:__index__'

/** Maximum number of molecules stored in localStorage. */
const LS_MAX_ENTRIES = 20

/** Time-to-live for cached entries (7 days in milliseconds). */
const LS_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Reads the LRU index from localStorage.
 * The index is an ordered array of CID strings (oldest first).
 * Returns [] if the index is missing or corrupt.
 */
function readLsIndex() {
  try {
    const raw = localStorage.getItem(LS_INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Writes the LRU index back to localStorage.
 */
function writeLsIndex(index) {
  try {
    localStorage.setItem(LS_INDEX_KEY, JSON.stringify(index))
  } catch {
    // localStorage is full or disabled — silently ignore
  }
}

/**
 * Attempts to load a cached molecule result from localStorage.
 * Returns null if:
 *  - the entry doesn't exist
 *  - the entry has expired (older than LS_TTL_MS)
 *  - the JSON is corrupt
 */
function loadFromLocalStorage(cid) {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${cid}`)
    if (!raw) return null

    const entry = JSON.parse(raw)

    // Check TTL — discard stale entries
    if (Date.now() - entry.timestamp > LS_TTL_MS) {
      localStorage.removeItem(`${LS_PREFIX}${cid}`)
      return null
    }

    return entry.data
  } catch {
    return null
  }
}

/**
 * Saves a molecule result to localStorage with LRU eviction.
 *
 * The eviction strategy:
 *  1. If the CID already exists in the index, move it to the end (most recent).
 *  2. If the index exceeds LS_MAX_ENTRIES, remove the oldest entry (front).
 *  3. Write the entry and updated index.
 */
function saveToLocalStorage(cid, data) {
  try {
    const entry = { timestamp: Date.now(), data }
    localStorage.setItem(`${LS_PREFIX}${cid}`, JSON.stringify(entry))

    // Update the LRU index — move this CID to the end (most recently used)
    const index = readLsIndex().filter((id) => id !== String(cid))
    index.push(String(cid))

    // Evict oldest entries if we exceed the cap
    while (index.length > LS_MAX_ENTRIES) {
      const evicted = index.shift()
      localStorage.removeItem(`${LS_PREFIX}${evicted}`)
    }

    writeLsIndex(index)
  } catch {
    // localStorage is full or disabled — silently ignore.
    // The in-memory cache still works.
  }
}

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
    const element = atomicNumberToElementSymbol(atoms.element[i]) ?? 'C'
    return {
      key:      `a${aid}`,
      element,
      scale:    ATOM_SCALES[element] ?? DEFAULT_ATOM_SCALE,
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
 * full molecule result and caches it in both the in-memory Map and
 * localStorage.
 *
 * Lookup order:
 *  1. In-memory Map (instant, current session only)
 *  2. localStorage   (persistent across sessions, with TTL + LRU eviction)
 *  3. PubChem API    (network fetch, result is cached in both tiers)
 *
 * Returns: { cid, name, formula, atomDefs, bondDefs }
 * Throws a user-readable Error string on failure.
 */
async function fetchMolecule(nameOrCid) {
  const trimmed = String(nameOrCid).trim()
  const cacheKey = trimmed.toLowerCase()

  // --- Tier 1: in-memory cache ---
  if (MOLECULE_CACHE.has(cacheKey)) return MOLECULE_CACHE.get(cacheKey)

  // Determine whether we were given a CID directly
  const isNumericCid = /^\d+$/.test(trimmed)

  let cid
  let displayName

  if (isNumericCid) {
    cid = Number(trimmed)
    displayName = `CID ${cid}`
  } else {
    cid = KNOWN_CID_BY_QUERY[cacheKey]

    if (!cid) {
      // Resolve name → CID
      const cidRes = await fetch(
        `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(trimmed)}/cids/JSON`,
      )

      if (!cidRes.ok) {
        try {
          const fallbackSchema = await fetchPubChemMoleculeSchema(trimmed)
          cid = fallbackSchema.source.cid
        } catch {
          throw new Error(`"${trimmed}" was not found in PubChem.`)
        }
      } else {
        const cidData = await cidRes.json()
        cid = cidData.IdentifierList?.CID?.[0]
      }
    }

    if (!cid) throw new Error(`No compound matched "${trimmed}".`)
    displayName = trimmed
  }

  // Check in-memory cache by CID in case the same compound was previously
  // fetched under a different name key
  const cidKey = `cid:${cid}`
  if (MOLECULE_CACHE.has(cidKey)) {
    const cached = MOLECULE_CACHE.get(cidKey)
    MOLECULE_CACHE.set(cacheKey, cached)
    return cached
  }

  // --- Tier 2: localStorage cache ---
  const lsCached = loadFromLocalStorage(cid)
  if (lsCached) {
    // Populate in-memory cache and return
    MOLECULE_CACHE.set(cacheKey, lsCached)
    MOLECULE_CACHE.set(cidKey, lsCached)
    return lsCached
  }

  // --- Tier 3: network fetch ---
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

  // Populate both cache tiers
  MOLECULE_CACHE.set(cacheKey, result)
  MOLECULE_CACHE.set(cidKey, result)
  saveToLocalStorage(cid, result)

  return result
}

export { fetchAutocomplete, fetchMolecule }
