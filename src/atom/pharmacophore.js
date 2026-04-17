const GROUP_STYLES = Object.freeze({
  amine: Object.freeze({
    group: 'Amine',
    color: '#4a7dff',
    emissive: '#244ecc',
  }),
  hydroxyl: Object.freeze({
    group: 'Hydroxyl',
    color: '#22d66f',
    emissive: '#15984c',
  }),
  carbonyl: Object.freeze({
    group: 'Carbonyl',
    color: '#f0a030',
    emissive: '#c07820',
  }),
  ether: Object.freeze({
    group: 'Ether / Ester O',
    color: '#a8e05f',
    emissive: '#6ea83d',
  }),
  aromatic: Object.freeze({
    group: 'Aromatic ring',
    color: '#b07aff',
    emissive: '#8855cc',
  }),
  halogen: Object.freeze({
    group: 'Halogen',
    color: '#ff6b8a',
    emissive: '#cc4466',
  }),
})

const HEAVY_ELEMENTS = new Set(['B', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I'])
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I'])

function addBond(adjacency, from, to, order = 1) {
  if (!adjacency.has(from)) adjacency.set(from, [])
  adjacency.get(from).push({ neighbor: to, order })
}

function isHeavyElement(element) {
  return HEAVY_ELEMENTS.has(element)
}

function getHeavyNeighbors(neighbors, elementOf) {
  return neighbors.filter(({ neighbor }) => isHeavyElement(elementOf.get(neighbor)))
}

/**
 * @param {Array<{ key: string, element: string }>} atomDefs
 * @param {Array<{ from: string, to: string, order?: number }>} bondDefs
 * @param {Array<{ keys: string[] }>} [aromaticRings]
 * @returns {Map<string, { group: string, color: string, emissive: string }>}
 */
function classifyPharmacophore(atomDefs = [], bondDefs = [], aromaticRings = []) {
  const adjacency = new Map()
  const elementOf = new Map()
  const classified = new Map()

  atomDefs.forEach(({ key, element }) => {
    elementOf.set(key, element)
    adjacency.set(key, [])
  })

  bondDefs.forEach(({ from, to, order = 1 }) => {
    addBond(adjacency, from, to, order)
    addBond(adjacency, to, from, order)
  })

  aromaticRings.forEach(({ keys = [] }) => {
    keys.forEach((key) => {
      if (elementOf.has(key)) classified.set(key, GROUP_STYLES.aromatic)
    })
  })

  bondDefs.forEach(({ from, to, order = 1 }) => {
    if (order !== 4) return
    if (elementOf.has(from)) classified.set(from, GROUP_STYLES.aromatic)
    if (elementOf.has(to)) classified.set(to, GROUP_STYLES.aromatic)
  })

  atomDefs.forEach(({ key, element }) => {
    const neighbors = adjacency.get(key) ?? []
    const heavyNeighbors = getHeavyNeighbors(neighbors, elementOf)

    if (HALOGENS.has(element) && neighbors.length === 1) {
      classified.set(key, GROUP_STYLES.halogen)
      return
    }

    if (element === 'N') {
      const onlyCarbonOrHydrogen = neighbors.every(({ neighbor }) => {
        const neighborElement = elementOf.get(neighbor)
        return neighborElement === 'C' || neighborElement === 'H'
      })

      if (neighbors.length > 0 && onlyCarbonOrHydrogen) {
        classified.set(key, GROUP_STYLES.amine)
      }
      return
    }

    if (element !== 'O') return

    const carbonylBond = neighbors.find(({ neighbor, order }) => (
      order === 2 && elementOf.get(neighbor) === 'C'
    ))

    if (carbonylBond && heavyNeighbors.length === 1) {
      classified.set(key, GROUP_STYLES.carbonyl)
      classified.set(carbonylBond.neighbor, GROUP_STYLES.carbonyl)
      return
    }

    const hasDoubleBond = neighbors.some(({ order }) => order === 2)

    if (!hasDoubleBond && heavyNeighbors.length === 1) {
      classified.set(key, GROUP_STYLES.hydroxyl)
      return
    }

    if (heavyNeighbors.length === 2 && heavyNeighbors.every(({ neighbor }) => elementOf.get(neighbor) === 'C')) {
      classified.set(key, GROUP_STYLES.ether)
    }
  })

  return classified
}

export {
  GROUP_STYLES,
  classifyPharmacophore,
}
