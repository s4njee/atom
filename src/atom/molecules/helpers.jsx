import { Html, Instance, Instances } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ATOM_RENDER_STYLES,
  DEFAULT_ATOM_RENDER_STYLE,
  getAtomRenderStyle,
  getElementInfo,
} from '../elements'
import { useAtomInteraction } from '../interaction'
import { useAtomRenderMode } from '../render-mode'

// ---------------------------------------------------------------------------
// Shared idle animation hook
// ---------------------------------------------------------------------------

/**
 * Drives the standard molecule idle animation — a gentle Y-axis rotation,
 * optional X/Z tilts, and a slow sinusoidal float. All params are optional;
 * defaults reproduce the Caffeine molecule look.
 *
 * @param {React.RefObject} ref - ref attached to the molecule <group>
 * @param {object} [options]
 */
function useMoleculeAnimation(ref, {
  rotationSpeed = 0.09,
  rotationYOffset = 0,
  rotationXBias = 0,
  rotationXAmplitude = 0.04,
  rotationXFrequency = 0.18,
  rotationZBias = 0,
  rotationZAmplitude = 0,
  rotationZFrequency = 0.12,
  floatAmplitude = 0.05,
  floatFrequency = 0.38,
  pauseOnInteraction = true,
} = {}) {
  const interactionRef = useAtomInteraction()
  const animationTimeRef = useRef(0)

  useFrame((_state, delta) => {
    if (!ref.current) return

    if (pauseOnInteraction) {
      const interaction = interactionRef.current
      const pausedByControls = interaction.controlsActive
      const pausedForIdleWindow = interaction.pauseAnimationUntil > performance.now()

      if (pausedByControls || pausedForIdleWindow) return
    }

    animationTimeRef.current += delta
    const t = animationTimeRef.current

    ref.current.rotation.y = rotationYOffset + t * rotationSpeed
    ref.current.rotation.x = rotationXBias + Math.sin(t * rotationXFrequency) * rotationXAmplitude

    if (rotationZAmplitude !== 0 || rotationZBias !== 0) {
      ref.current.rotation.z = rotationZBias + Math.sin(t * rotationZFrequency) * rotationZAmplitude
    }

    ref.current.position.y = Math.sin(t * floatFrequency) * floatAmplitude
  })
}

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
  roughness: 0.34,
  metalness: 0.08,
  clearcoat: 0.18,
  clearcoatRoughness: 0.4,
  reflectivity: 0.34,
  sheen: 0.04,
  specularIntensity: 0.28,
  specularColor: '#cfe6f6',
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

// ---------------------------------------------------------------------------
// AtomInstances — instanced renderer with hover glow + click selection
// ---------------------------------------------------------------------------

function AtomInstances({ atomDefs = [] }) {
  const { cinematicEnabled } = useAtomRenderMode()
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
      const style = getAtomRenderStyle(element)
      const batchKey = `${element}|${style.color}|${style.emissive}|${style.emissiveIntensity}`
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
  }, [atomDefs])

  // Clear hover/selection when the molecule unmounts (e.g., switching molecules).
  // Also restore the cursor in case the pointer was over an atom at unmount time.
  useState(() => () => {
    document.body.style.cursor = ''
  })

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

  return (
    <>
      {batches.map(({ key, style, items }) => (
        <Instances key={key} limit={items.length}>
          <sphereGeometry args={[1, 16, 16]} />
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
          {items.map(({ key: itemKey, element, position, scale }) => (
            <Instance
              key={itemKey}
              position={position}
              // Hovering scales the atom up 15% for a tactile focus-glow effect
              scale={hoveredKey === itemKey ? scale * 1.15 : scale}
              onPointerOver={(e) => handlePointerOver(e, itemKey)}
              onPointerOut={(e) => handlePointerOut(e, itemKey)}
              onClick={(e) => handleClick(e, itemKey, element, position)}
            />
          ))}
        </Instances>
      ))}

      {/* Tooltip is anchored in 3D world-space and follows the atom as the
          molecule rotates, because it's rendered inside the same group hierarchy. */}
      {selectedAtom && (
        <Html
          position={selectedAtom.position}
          center
          distanceFactor={10}
          zIndexRange={[100, 0]}
        >
          <AtomTooltip element={selectedAtom.element} />
        </Html>
      )}
    </>
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
