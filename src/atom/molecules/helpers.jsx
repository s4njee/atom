import { Instance, Instances } from '@react-three/drei'
import { useMemo } from 'react'

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

function AtomInstances({ atomDefs = [] }) {
  const batches = useMemo(() => {
    const grouped = new Map()

    atomDefs.forEach(({ key, element, position, scale }) => {
      const style = getAtomRenderStyle(element)
      const batchKey = `${element}|${style.color}|${style.emissive}|${style.emissiveIntensity}`
      const existing = grouped.get(batchKey)

      if (existing) {
        existing.items.push({ key, position, scale })
        return
      }

      grouped.set(batchKey, {
        key: batchKey,
        style,
        items: [{ key, position, scale }],
      })
    })

    return Array.from(grouped.values())
  }, [atomDefs])

  return batches.map(({ key, style, items }) => (
    <Instances key={key} limit={items.length}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshPhysicalMaterial
        color={style.color}
        emissive={style.emissive}
        emissiveIntensity={style.emissiveIntensity}
        roughness={0.2}
        metalness={0.18}
        clearcoat={0.9}
        clearcoatRoughness={0.16}
        reflectivity={1}
        sheen={0.2}
        sheenColor="#d9f3ff"
        specularIntensity={1}
        specularColor="#f4fbff"
        toneMapped={false}
      />
      {items.map(({ key: itemKey, position, scale }) => (
        <Instance key={itemKey} position={position} scale={scale} />
      ))}
    </Instances>
  ))
}

export {
  AtomInstances,
  ATOM_RENDER_STYLES,
  DEFAULT_ATOM_RENDER_STYLE,
  createAtomPositionLookup,
  getAtomRenderStyle,
}
