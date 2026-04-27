const RCSB_SEARCH_URL = 'https://search.rcsb.org/rcsbsearch/v2/query'
const RCSB_ENTRY_URL = 'https://data.rcsb.org/rest/v1/core/entry'
const RCSB_FILE_URL = 'https://files.rcsb.org/download'

const PDB_ID_RE = /^[0-9][A-Za-z0-9]{3}$/
const BOND_TOLERANCE_ANGSTROM = 0.45
const MAX_INFERRED_BOND_DISTANCE = 2.05
const ELEMENT_COVALENT_RADIUS = Object.freeze({
  H: 0.31,
  C: 0.76,
  N: 0.71,
  O: 0.66,
  P: 1.07,
  S: 1.05,
})

const PROTEIN_CACHE = new Map()

function isPdbId(input) {
  return PDB_ID_RE.test(input.trim())
}

function residueKey(chainId, resNum) {
  return `${chainId}:${resNum}`
}

function parseInteger(value) {
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function createTransform(positions, targetRadius = 4) {
  if (positions.length === 0) {
    return {
      apply: (position) => position,
      scale: 1,
    }
  }

  const centroid = positions.reduce(
    ([cx, cy, cz], [x, y, z]) => [cx + x, cy + y, cz + z],
    [0, 0, 0],
  ).map((value) => value / positions.length)

  let maxDistance = 0
  for (const [x, y, z] of positions) {
    const dx = x - centroid[0]
    const dy = y - centroid[1]
    const dz = z - centroid[2]
    maxDistance = Math.max(maxDistance, Math.sqrt(dx * dx + dy * dy + dz * dz))
  }

  const scale = maxDistance > 0 ? targetRadius / maxDistance : 1
  return {
    apply: (position) => position.map((value, index) => (value - centroid[index]) * scale),
    scale,
  }
}

function centerAndScaleChains(chains, transform) {
  return chains.map((chain) => ({
    ...chain,
    residues: chain.residues.map((residue) => ({
      ...residue,
      ca: transform.apply(residue.ca),
    })),
  }))
}

function parseElement(line, atomName) {
  const explicit = line.slice(76, 78).trim()
  if (explicit) return explicit[0].toUpperCase() + explicit.slice(1).toLowerCase()

  const inferred = atomName.replace(/^[0-9]+/, '').slice(0, 2).trim()
  if (!inferred) return 'C'
  if (inferred.length > 1 && inferred[1] === inferred[1].toLowerCase()) {
    return inferred[0].toUpperCase() + inferred[1].toLowerCase()
  }
  return inferred[0].toUpperCase()
}

function squaredDistance(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return dx * dx + dy * dy + dz * dz
}

function shouldBond(atomA, atomB) {
  if (atomA.chainId !== atomB.chainId && atomA.residueKey !== atomB.residueKey) return false
  const radiusA = ELEMENT_COVALENT_RADIUS[atomA.element] ?? ELEMENT_COVALENT_RADIUS.C
  const radiusB = ELEMENT_COVALENT_RADIUS[atomB.element] ?? ELEMENT_COVALENT_RADIUS.C
  const maxDistance = Math.min(radiusA + radiusB + BOND_TOLERANCE_ANGSTROM, MAX_INFERRED_BOND_DISTANCE)
  const distance2 = squaredDistance(atomA.rawPosition, atomB.rawPosition)
  return distance2 > 0.16 && distance2 <= maxDistance * maxDistance
}

function inferBonds(atoms) {
  const bonds = []
  const cellSize = MAX_INFERRED_BOND_DISTANCE
  const cells = new Map()

  const cellKey = (x, y, z) => `${x}:${y}:${z}`

  atoms.forEach((atom, index) => {
    const [x, y, z] = atom.rawPosition.map((value) => Math.floor(value / cellSize))
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nearby = cells.get(cellKey(x + dx, y + dy, z + dz)) ?? []
          for (const nearbyIndex of nearby) {
            if (shouldBond(atom, atoms[nearbyIndex])) {
              bonds.push({ from: nearbyIndex, to: index })
            }
          }
        }
      }
    }

    const ownKey = cellKey(x, y, z)
    if (!cells.has(ownKey)) cells.set(ownKey, [])
    cells.get(ownKey).push(index)
  })

  return bonds
}

function readRange(line, chainStartColumn, resStartColumn, chainEndColumn, resEndColumn, ss) {
  const chainStart = line.slice(chainStartColumn, chainStartColumn + 1).trim()
  const chainEnd = line.slice(chainEndColumn, chainEndColumn + 1).trim()
  const start = parseInteger(line.slice(resStartColumn, resStartColumn + 4))
  const end = parseInteger(line.slice(resEndColumn, resEndColumn + 4))

  if (!chainStart || !chainEnd || start == null || end == null) return null

  return {
    chainStart,
    chainEnd,
    start: Math.min(start, end),
    end: Math.max(start, end),
    ss,
  }
}

function secondaryStructureFor(residue, ranges) {
  const match = ranges.find((range) => (
    range.chainStart === residue.chainId
      && range.chainEnd === residue.chainId
      && residue.resNum >= range.start
      && residue.resNum <= range.end
  ))

  return match?.ss ?? 'loop'
}

function parsePdbText(text, metadata = {}) {
  const ranges = []
  const residuesByKey = new Map()
  const atomsByKey = new Map()
  const disulfides = []

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('HELIX ')) {
      const range = readRange(line, 19, 21, 31, 33, 'helix')
      if (range) ranges.push(range)
      continue
    }

    if (line.startsWith('SHEET ')) {
      const range = readRange(line, 21, 22, 32, 33, 'strand')
      if (range) ranges.push(range)
      continue
    }

    if (line.startsWith('SSBOND')) {
      const chainA = line.slice(15, 16).trim()
      const resA = parseInteger(line.slice(17, 21))
      const chainB = line.slice(29, 30).trim()
      const resB = parseInteger(line.slice(31, 35))
      if (chainA && chainB && resA != null && resB != null) {
        disulfides.push({ chainA, resA, chainB, resB })
      }
      continue
    }

    if (!line.startsWith('ATOM  ')) continue

    const atomName = line.slice(12, 16).trim()
    const altLoc = line.slice(16, 17)
    if (altLoc && altLoc !== ' ' && altLoc !== 'A') continue

    const resName = line.slice(17, 20).trim()
    const chainId = line.slice(21, 22).trim() || '_'
    const resNum = parseInteger(line.slice(22, 26))
    const insertionCode = line.slice(26, 27).trim()
    const x = Number.parseFloat(line.slice(30, 38))
    const y = Number.parseFloat(line.slice(38, 46))
    const z = Number.parseFloat(line.slice(46, 54))

    if (resNum == null || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue
    }

    const residueAtomKey = `${chainId}:${resNum}:${insertionCode}`
    const atomKey = `${residueAtomKey}:${atomName}`
    if (!atomsByKey.has(atomKey)) {
      atomsByKey.set(atomKey, {
        atomName,
        chainId,
        element: parseElement(line, atomName),
        rawPosition: [x, y, z],
        residueKey: residueAtomKey,
        resName,
        resNum,
      })
    }

    if (atomName !== 'CA') continue
    if (residuesByKey.has(residueAtomKey)) continue

    residuesByKey.set(residueAtomKey, {
      chainId,
      resNum,
      resName,
      ca: [x, y, z],
      ss: 'loop',
    })
  }

  const residues = [...residuesByKey.values()].map((residue) => ({
    ...residue,
    ss: secondaryStructureFor(residue, ranges),
  }))

  const chainsById = new Map()
  for (const residue of residues) {
    if (!chainsById.has(residue.chainId)) {
      chainsById.set(residue.chainId, { id: residue.chainId, residues: [] })
    }
    chainsById.get(residue.chainId).residues.push({
      resNum: residue.resNum,
      resName: residue.resName,
      ca: residue.ca,
      ss: residue.ss,
    })
  }

  const rawChains = [...chainsById.values()].map((chain) => ({
    ...chain,
    residues: chain.residues.sort((a, b) => a.resNum - b.resNum),
  }))

  if (rawChains.length === 0) {
    throw new Error('No protein C-alpha atoms were found in this PDB entry.')
  }

  const transform = createTransform(
    rawChains.flatMap((chain) => chain.residues.map((residue) => residue.ca)),
  )
  const chains = centerAndScaleChains(rawChains, transform)
  const atoms = [...atomsByKey.values()].map((atom, index) => ({
    key: `pdb-atom-${index}`,
    atomName: atom.atomName,
    chainId: atom.chainId,
    element: atom.element,
    position: transform.apply(atom.rawPosition),
    rawPosition: atom.rawPosition,
    resName: atom.resName,
    resNum: atom.resNum,
    residueKey: atom.residueKey,
  }))
  const bonds = inferBonds(atoms)

  const residueIndex = new Map()
  for (const chain of chains) {
    for (const residue of chain.residues) {
      residueIndex.set(residueKey(chain.id, residue.resNum), residue)
    }
  }

  return {
    pdbId: metadata.pdbId,
    name: metadata.name ?? metadata.pdbId,
    title: metadata.title ?? metadata.name ?? metadata.pdbId,
    chains,
    atoms: atoms.map(({ rawPosition, ...atom }) => atom),
    bonds,
    disulfides: disulfides.filter((bond) => (
      residueIndex.has(residueKey(bond.chainA, bond.resA))
        && residueIndex.has(residueKey(bond.chainB, bond.resB))
    )),
    boundingRadius: 4,
    sourceUrl: `${RCSB_FILE_URL}/${metadata.pdbId}.pdb`,
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) throw new Error(`RCSB request failed (${response.status})`)
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`RCSB PDB download failed (${response.status})`)
  return response.text()
}

async function fetchEntryMetadata(pdbId) {
  const data = await fetchJson(`${RCSB_ENTRY_URL}/${pdbId}`)
  return {
    pdbId,
    name: data.struct?.title ?? pdbId,
    title: data.struct?.title ?? pdbId,
  }
}

async function searchPdbIds(query, rows = 8) {
  const trimmed = query.trim()
  if (!trimmed) return []

  if (isPdbId(trimmed)) return [trimmed.toUpperCase()]

  const payload = {
    query: {
      type: 'terminal',
      service: 'text',
      parameters: {
        attribute: 'struct.title',
        operator: 'contains_words',
        value: trimmed,
      },
    },
    return_type: 'entry',
    request_options: {
      paginate: { start: 0, rows },
      scoring_strategy: 'combined',
    },
  }

  const data = await fetchJson(RCSB_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return (data.result_set ?? []).map((result) => result.identifier).filter(Boolean)
}

async function fetchPdbAutocomplete(query) {
  if (!query || query.trim().length < 2) return []

  try {
    const ids = await searchPdbIds(query, 8)
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const metadata = await fetchEntryMetadata(id)
          return {
            id,
            label: `${id} · ${metadata.title}`,
          }
        } catch {
          return { id, label: id }
        }
      }),
    )
    return entries
  } catch {
    return []
  }
}

async function fetchProtein(query) {
  const trimmed = query.trim()
  if (!trimmed) throw new Error('Enter a PDB ID or protein name.')

  const cacheKey = trimmed.toLowerCase()
  if (PROTEIN_CACHE.has(cacheKey)) return PROTEIN_CACHE.get(cacheKey)

  const pdbId = isPdbId(trimmed)
    ? trimmed.toUpperCase()
    : (await searchPdbIds(trimmed, 1))[0]

  if (!pdbId) {
    throw new Error(`No PDB entry was found for "${trimmed}".`)
  }

  const [metadata, pdbText] = await Promise.all([
    fetchEntryMetadata(pdbId),
    fetchText(`${RCSB_FILE_URL}/${pdbId}.pdb`),
  ])
  const result = parsePdbText(pdbText, metadata)

  PROTEIN_CACHE.set(cacheKey, result)
  PROTEIN_CACHE.set(pdbId.toLowerCase(), result)
  return result
}

export { fetchPdbAutocomplete, fetchProtein }
