import { Html, Instance, Instances } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ATOM_RENDER_STYLES,
  DEFAULT_ATOM_RENDER_STYLE,
  getAtomRenderStyle,
  getElementInfo,
} from '../elements'
import { useAtomRenderMode } from '../render-mode'

// ---------------------------------------------------------------------------
// Shared idle animation hook
// ---------------------------------------------------------------------------

/**
 * Kept as a compatibility hook for molecule components that still call it.
 * Idle animation is intentionally disabled so only OrbitControls moves models.
 *
 * @param {React.RefObject} ref - ref attached to the molecule <group>
 * @param {object} [options]
 */
function useMoleculeAnimation() {}

// ---------------------------------------------------------------------------
// Atom-selection tooltip — periodic table tile style
// ---------------------------------------------------------------------------

function AtomTooltip({ element }) {
  const info = getElementInfo(element)
  const style = getAtomRenderStyle(element)

  // Use the element's existing render color as the card background, darkened
  // slightly so text stays legible.
  const bgColor = style.color

  if (!info) {
    // Fallback for uncommon elements not in our table
    return (
      <div className="atom-tooltip" style={{ '--atom-tile-bg': bgColor }}>
        <div className="atom-tooltip__symbol">{element}</div>
      </div>
    )
  }

  return (
    <div className="atom-tooltip" style={{ '--atom-tile-bg': bgColor }}>
      {/* Top row: atomic number (left) + electron shells (right) */}
      <div className="atom-tooltip__top">
        <span className="atom-tooltip__atomic-number">{info.atomicNumber}</span>
        <span className="atom-tooltip__shells">
          {info.shells.map((n, i) => (
            <span key={i}>{n}</span>
          ))}
        </span>
      </div>

      {/* Large element symbol */}
      <div className="atom-tooltip__symbol">{element}</div>

      {/* Name + atomic mass */}
      <div className="atom-tooltip__name">{info.name}</div>
      <div className="atom-tooltip__mass">{info.atomicMass}</div>
    </div>
  )
}

function createAtomPositionLookup(atomDefs) {
  return Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
}

const BASE_ATOM_SURFACE = Object.freeze({
  roughness: 0.2,
  metalness: 0.18,
  clearcoat: 0.9,
  clearcoatRoughness: 0.16,
  reflectivity: 1,
  sheen: 0.2,
  specularIntensity: 1,
  specularColor: '#f4fbff',
})

const CINEMATIC_ATOM_SURFACE = Object.freeze({
  roughness: 0.2,
  metalness: 0.18,
  clearcoat: 0.9,
  clearcoatRoughness: 0.16,
  reflectivity: 1,
  sheen: 0.2,
  specularIntensity: 1,
  specularColor: '#f4fbff',
})

const DIMMED_PHARMACOPHORE_STYLE = Object.freeze({
  color: '#1a2a3a',
  emissive: '#0a1520',
  emissiveIntensity: 0.4,
})

const BLUEPRINT_ATOM_STYLE = Object.freeze({
  color: '#1f4f5a',
  emissive: '#1f4f5a',
  emissiveIntensity: 0,
})

// ---------------------------------------------------------------------------
// AtomInstances — instanced renderer with hover glow + click selection
// ---------------------------------------------------------------------------

function AtomInstances({ atomDefs = [] }) {
  const { blueprintEnabled, cinematicEnabled, pharmacophoreMap } = useAtomRenderMode()
  const [hoveredKey, setHoveredKey] = useState(null)
  const [selectedAtom, setSelectedAtom] = useState(null)
  // Track the canvas domElement for cursor changes without useThree at this level
  const glRef = useRef(null)

  // Group atoms by element/style so we can batch them into a single InstancedMesh
  // per element type. `element` is now included in items so pointer handlers can
  // reference it without closing over the outer atomDefs array.
  const batches = useMemo(() => {
    const grouped = new Map()

    atomDefs.forEach(({ key, element, position, scale }) => {
      const pharma = pharmacophoreMap?.get(key)
      const style = blueprintEnabled
        ? BLUEPRINT_ATOM_STYLE
        : pharma
          ? { color: pharma.color, emissive: pharma.emissive, emissiveIntensity: 2.2 }
          : pharmacophoreMap
            ? DIMMED_PHARMACOPHORE_STYLE
            : getAtomRenderStyle(element)
      const batchKey = `${blueprintEnabled ? 'blueprint' : element}|${style.color}|${style.emissive}|${style.emissiveIntensity}`
      const existing = grouped.get(batchKey)

      if (existing) {
        existing.items.push({ key, element, position, scale })
        return
      }

      grouped.set(batchKey, {
        key: batchKey,
        style,
        items: [{ key, element, position, scale }],
      })
    })

    return Array.from(grouped.values())
  }, [atomDefs, blueprintEnabled, pharmacophoreMap])

  // Clear hover/selection when the molecule unmounts (e.g., switching molecules).
  // Also restore the cursor in case the pointer was over an atom at unmount time.
  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
    }
  }, [])

  const surface = cinematicEnabled ? CINEMATIC_ATOM_SURFACE : BASE_ATOM_SURFACE

  const handlePointerOver = useCallback((e, atomKey) => {
    e.stopPropagation()
    setHoveredKey(atomKey)
    document.body.style.cursor = 'pointer'
  }, [])

  const handlePointerOut = useCallback((e, atomKey) => {
    e.stopPropagation()
    // Only clear if this atom is actually the one being tracked — prevents a
    // fast pointer move from clearing a hover that already transferred to a
    // different atom.
    setHoveredKey((prev) => (prev === atomKey ? null : prev))
    document.body.style.cursor = ''
  }, [])

  const handleClick = useCallback((e, atomKey, element, position) => {
    e.stopPropagation()
    // Clicking the already-selected atom deselects it; clicking a new atom selects it.
    setSelectedAtom((prev) => (prev?.key === atomKey ? null : { key: atomKey, element, position }))
  }, [])

  const handlePointerMissed = useCallback(() => {
    setSelectedAtom(null)
  }, [])

  return (
    <group onPointerMissed={handlePointerMissed}>
      {batches.map(({ key, style, items }) => (
        <Instances key={key} limit={items.length}>
          <sphereGeometry args={[1, 16, 16]} />
          {blueprintEnabled ? (
            <meshBasicMaterial
              color={style.color}
              wireframe
              transparent
              opacity={0.92}
            />
          ) : (
            <meshPhysicalMaterial
              color={style.color}
              emissive={style.emissive}
              emissiveIntensity={style.emissiveIntensity}
              roughness={surface.roughness}
              metalness={surface.metalness}
              clearcoat={surface.clearcoat}
              clearcoatRoughness={surface.clearcoatRoughness}
              reflectivity={surface.reflectivity}
              sheen={surface.sheen}
              sheenColor="#d9f3ff"
              specularIntensity={surface.specularIntensity}
              specularColor={surface.specularColor}
              toneMapped={false}
            />
          )}
          {items.map(({ key: itemKey, element, position, scale }) => (
            <Instance
              key={itemKey}
              position={position}
              // Hovering scales the atom up 15% for a tactile focus-glow effect
              scale={(hoveredKey === itemKey ? scale * 1.15 : scale) * (blueprintEnabled ? 1.08 : 1)}
              onPointerOver={(e) => handlePointerOver(e, itemKey)}
              onPointerOut={(e) => handlePointerOut(e, itemKey)}
              onClick={(e) => handleClick(e, itemKey, element, position)}
            />
          ))}
        </Instances>
      ))}

      {blueprintEnabled ? (
        atomDefs.map(({ key, element, position }) => (
          <Html
            key={`blueprint-label-${key}`}
            position={position}
            center
            distanceFactor={11}
            zIndexRange={[50, 0]}
          >
            <span className="blueprint-atom-label">{element}</span>
          </Html>
        ))
      ) : null}

      {/* Tooltip is anchored in 3D world-space and follows the atom as the
          molecule rotates, because it's rendered inside the same group hierarchy. */}
      {selectedAtom && !blueprintEnabled && (
        <Html
          position={selectedAtom.position}
          center
          distanceFactor={10}
          zIndexRange={[100, 0]}
        >
          <AtomTooltip element={selectedAtom.element} />
        </Html>
      )}
    </group>
  )
}

export {
  AtomInstances,
  ATOM_RENDER_STYLES,
  DEFAULT_ATOM_RENDER_STYLE,
  createAtomPositionLookup,
  getAtomRenderStyle,
  useMoleculeAnimation,
}
