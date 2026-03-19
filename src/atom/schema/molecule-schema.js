const MOLECULE_SCHEMA_VERSION = 1
const DEFAULT_RENDER_SCALE_BY_ELEMENT = Object.freeze({
  H: 0.09,
  C: 0.22,
  N: 0.205,
  O: 0.19,
  Cl: 0.245,
  S: 0.24,
})
const ELEMENT_SYMBOLS_BY_ATOMIC_NUMBER = Object.freeze({
  1: 'H',
  6: 'C',
  7: 'N',
  8: 'O',
  9: 'F',
  15: 'P',
  16: 'S',
  17: 'Cl',
  35: 'Br',
  53: 'I',
})
const compiledSchemaCache = new WeakMap()

/**
 * @typedef {Object} MoleculeSchema
 * @property {number} version
 * @property {{
 *   provider: 'pubchem' | string,
 *   sourceUrl: string | null,
 *   canonicalUrl: string | null,
 *   cid: number | null,
 *   query: string | null,
 *   recordType: '2d' | '3d',
 *   coordinateUnits: 'angstrom'
 * }} source
 * @property {{
 *   id: string,
 *   name: string,
 *   formula: string | null
 * }} molecule
 * @property {{
 *   count: number,
 *   ids: number[],
 *   atomicNumbers: number[],
 *   positions: number[][]
 * }} atoms
 * @property {{
 *   count: number,
 *   atomIndexA: number[],
 *   atomIndexB: number[],
 *   order: number[]
 * }} bonds
 * @property {{
 *   heavyAtomCount: number,
 *   hydrogenCount: number,
 *   has3dCoordinates: boolean,
 *   ringGroups: number[][],
 *   aromaticBondIndices: number[]
 * }} annotations
 */

function atomicNumberToElementSymbol(atomicNumber) {
  return ELEMENT_SYMBOLS_BY_ATOMIC_NUMBER[atomicNumber] ?? `Z${atomicNumber}`
}

function getDefaultRenderScale(element, renderScaleByElement = DEFAULT_RENDER_SCALE_BY_ELEMENT) {
  return renderScaleByElement[element] ?? renderScaleByElement.C ?? DEFAULT_RENDER_SCALE_BY_ELEMENT.C
}

function createMoleculeSchema({
  source,
  molecule,
  atoms,
  bonds,
  annotations = {},
}) {
  const atomCount = atoms.ids.length
  const bondCount = bonds.atomIndexA.length

  if (atoms.atomicNumbers.length !== atomCount || atoms.positions.length !== atomCount) {
    throw new Error('MoleculeSchema atoms must keep ids, atomicNumbers, and positions aligned')
  }

  if (bonds.atomIndexB.length !== bondCount || bonds.order.length !== bondCount) {
    throw new Error('MoleculeSchema bonds must keep atomIndexA, atomIndexB, and order aligned')
  }

  return {
    version: MOLECULE_SCHEMA_VERSION,
    source: {
      provider: source.provider ?? 'unknown',
      sourceUrl: source.sourceUrl ?? null,
      canonicalUrl: source.canonicalUrl ?? null,
      cid: source.cid ?? null,
      query: source.query ?? null,
      recordType: source.recordType ?? '3d',
      coordinateUnits: 'angstrom',
    },
    molecule: {
      id: molecule.id,
      name: molecule.name,
      formula: molecule.formula ?? null,
    },
    atoms: {
      count: atomCount,
      ids: atoms.ids,
      atomicNumbers: atoms.atomicNumbers,
      positions: atoms.positions,
    },
    bonds: {
      count: bondCount,
      atomIndexA: bonds.atomIndexA,
      atomIndexB: bonds.atomIndexB,
      order: bonds.order,
    },
    annotations: {
      heavyAtomCount: annotations.heavyAtomCount ?? atoms.atomicNumbers.filter((value) => value !== 1).length,
      hydrogenCount: annotations.hydrogenCount ?? atoms.atomicNumbers.filter((value) => value === 1).length,
      has3dCoordinates: annotations.has3dCoordinates ?? atoms.positions.some(([, , z = 0]) => Math.abs(z) > 1e-6),
      ringGroups: annotations.ringGroups ?? [],
      aromaticBondIndices: annotations.aromaticBondIndices ?? [],
    },
  }
}

function createCompileOptionsKey({
  includeHydrogens = true,
  positionScale = 1,
} = {}) {
  return `${includeHydrogens ? 'all' : 'heavy'}|${positionScale}`
}

function getCompiledSchemaCache(schema, optionsKey) {
  let schemaCache = compiledSchemaCache.get(schema)

  if (!schemaCache) {
    schemaCache = new Map()
    compiledSchemaCache.set(schema, schemaCache)
  }

  return schemaCache.get(optionsKey)
}

function setCompiledSchemaCache(schema, optionsKey, compiled) {
  let schemaCache = compiledSchemaCache.get(schema)

  if (!schemaCache) {
    schemaCache = new Map()
    compiledSchemaCache.set(schema, schemaCache)
  }

  schemaCache.set(optionsKey, compiled)
  return compiled
}

function compileMoleculeSchema(
  schema,
  {
    includeHydrogens = true,
    positionScale = 1,
    renderScaleByElement = DEFAULT_RENDER_SCALE_BY_ELEMENT,
  } = {},
) {
  const optionsKey = createCompileOptionsKey({ includeHydrogens, positionScale })
  const cached = getCompiledSchemaCache(schema, optionsKey)

  if (cached) return cached

  const atomDefs = []
  const atomPositionsByKey = Object.create(null)
  const atomKeyByAtomIndex = new Array(schema.atoms.count).fill(null)
  const sourceAtomIndexByCompiledIndex = []

  schema.atoms.ids.forEach((atomId, atomIndex) => {
    const atomicNumber = schema.atoms.atomicNumbers[atomIndex]
    const element = atomicNumberToElementSymbol(atomicNumber)

    if (!includeHydrogens && element === 'H') return

    const key = `a${atomId}`
    const [x = 0, y = 0, z = 0] = schema.atoms.positions[atomIndex] ?? []
    const position = [x * positionScale, y * positionScale, z * positionScale]
    const compiledIndex = atomDefs.length

    atomDefs.push({
      key,
      atomId,
      atomIndex,
      atomicNumber,
      element,
      scale: getDefaultRenderScale(element, renderScaleByElement),
      position,
    })
    atomPositionsByKey[key] = position
    atomKeyByAtomIndex[atomIndex] = key
    sourceAtomIndexByCompiledIndex.push(atomIndex)
  })

  const compiledIndexBySourceAtomIndex = new Map(
    sourceAtomIndexByCompiledIndex.map((sourceIndex, compiledIndex) => [sourceIndex, compiledIndex]),
  )
  const bondDefs = []
  const doubleBondKeys = new Set()
  const tripleBondKeys = new Set()
  const aromaticBondKeys = new Set()

  schema.bonds.atomIndexA.forEach((startIndex, bondIndex) => {
    const endIndex = schema.bonds.atomIndexB[bondIndex]
    const order = schema.bonds.order[bondIndex]
    const startKey = atomKeyByAtomIndex[startIndex]
    const endKey = atomKeyByAtomIndex[endIndex]

    if (!startKey || !endKey) return

    const bondKey = `${startKey}-${endKey}`
    bondDefs.push({
      key: bondKey,
      startKey,
      endKey,
      startIndex,
      endIndex,
      order,
    })

    if (order === 2) doubleBondKeys.add(bondKey)
    if (order === 3) tripleBondKeys.add(bondKey)
    if (schema.annotations.aromaticBondIndices.includes(bondIndex) || order === 4) {
      aromaticBondKeys.add(bondKey)
    }
  })

  const atomPositionBuffer = new Float32Array(atomDefs.length * 3)
  const atomAtomicNumberBuffer = new Uint8Array(atomDefs.length)

  atomDefs.forEach(({ position, atomicNumber }, atomIndex) => {
    const offset = atomIndex * 3
    atomPositionBuffer[offset] = position[0]
    atomPositionBuffer[offset + 1] = position[1]
    atomPositionBuffer[offset + 2] = position[2]
    atomAtomicNumberBuffer[atomIndex] = atomicNumber
  })

  const bondIndexBufferFactory = atomDefs.length > 65535 ? Uint32Array : Uint16Array
  const bondIndexBuffer = new bondIndexBufferFactory(bondDefs.length * 2)
  const bondOrderBuffer = new Uint8Array(bondDefs.length)

  bondDefs.forEach(({ startIndex, endIndex, order }, bondIndex) => {
    const compiledStartIndex = compiledIndexBySourceAtomIndex.get(startIndex)
    const compiledEndIndex = compiledIndexBySourceAtomIndex.get(endIndex)
    const offset = bondIndex * 2

    bondIndexBuffer[offset] = compiledStartIndex
    bondIndexBuffer[offset + 1] = compiledEndIndex
    bondOrderBuffer[bondIndex] = order
  })

  const compiled = {
    schema,
    atomDefs,
    atomPositionsByKey,
    atomKeyByAtomIndex,
    bondDefs,
    doubleBondKeys,
    tripleBondKeys,
    aromaticBondKeys,
    buffers: {
      atomPositions: atomPositionBuffer,
      atomAtomicNumbers: atomAtomicNumberBuffer,
      bondIndices: bondIndexBuffer,
      bondOrders: bondOrderBuffer,
    },
  }

  return setCompiledSchemaCache(schema, optionsKey, compiled)
}

export {
  MOLECULE_SCHEMA_VERSION,
  DEFAULT_RENDER_SCALE_BY_ELEMENT,
  atomicNumberToElementSymbol,
  compileMoleculeSchema,
  createMoleculeSchema,
  getDefaultRenderScale,
}
