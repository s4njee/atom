// Keep the shared molecule rendering bits in one place so each molecule file
// can focus on geometry, bonds, and animation.
const DEFAULT_ATOM_RENDER_STYLE = Object.freeze({
  color: '#4c6174',
  emissive: '#233445',
  emissiveIntensity: 1.2,
})

const ATOM_RENDER_STYLES = Object.freeze({
  C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
  Cl: { color: '#74c46e', emissive: '#356f2f', emissiveIntensity: 1.35 },
  H: { color: '#e9f3ff', emissive: '#8fb5d6', emissiveIntensity: 0.9 },
  N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
  O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  S: { color: '#c8a24f', emissive: '#7e5f1d', emissiveIntensity: 1.3 },
})

function createAtomPositionLookup(atomDefs) {
  return Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
}

function getAtomRenderStyle(element) {
  return ATOM_RENDER_STYLES[element] ?? DEFAULT_ATOM_RENDER_STYLE
}

export {
  ATOM_RENDER_STYLES,
  DEFAULT_ATOM_RENDER_STYLE,
  createAtomPositionLookup,
  getAtomRenderStyle,
}
