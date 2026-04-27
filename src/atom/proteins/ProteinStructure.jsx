import { useCallback, useMemo, useState } from 'react'
import { Html, Line } from '@react-three/drei'
import { getAtomRenderStyle } from '../elements'
import { AtomTooltip } from '../molecules/helpers'
import { segmentBySSType, buildResidueIndex, lookupCa } from './utils.js'
import BackboneSegment from './primitives/BackboneSegment.jsx'
import HelixRibbon from './primitives/HelixRibbon.jsx'
import StrandArrow from './primitives/StrandArrow.jsx'
import DisulfideBond from './primitives/DisulfideBond.jsx'

const FALLBACK_ELEMENT = 'C'
const ATOM_RADIUS = {
  H: 0.045,
  C: 0.085,
  N: 0.09,
  O: 0.088,
  P: 0.105,
  S: 0.105,
}
const BLUEPRINT_INK = '#1f4f5a'
const BLUEPRINT_LINE = '#386d75'

function createFallbackAtomsAndBonds(data) {
  const atoms = []
  const bonds = []

  data.chains.forEach((chain) => {
    let previousIndex = null
    chain.residues.forEach((residue) => {
      const index = atoms.length
      atoms.push({
        key: `${chain.id}-${residue.resNum}-ca`,
        atomName: 'CA',
        chainId: chain.id,
        element: 'C',
        position: residue.ca,
        resName: residue.resName,
        resNum: residue.resNum,
      })

      if (previousIndex != null) {
        bonds.push({ from: previousIndex, to: index })
      }
      previousIndex = index
    })
  })

  return { atoms, bonds }
}

function ProteinWireframe({ data, proteinMode8 = false }) {
  const { atoms, bonds } = useMemo(() => {
    if (data.atoms?.length && data.bonds?.length) {
      return { atoms: data.atoms, bonds: data.bonds }
    }
    return createFallbackAtomsAndBonds(data)
  }, [data])

  return (
    <group>
      {bonds.map((bond, index) => {
        const start = atoms[bond.from]?.position
        const end = atoms[bond.to]?.position
        if (!start || !end) return null

        return (
          <Line
            key={`protein-wire-${index}`}
            points={[start, end]}
            color={proteinMode8 ? BLUEPRINT_LINE : '#79c8ff'}
            transparent
            opacity={proteinMode8 ? 0.86 : 0.42}
            lineWidth={proteinMode8 ? 1.2 : 0.7}
          />
        )
      })}
    </group>
  )
}

function ProteinMolecularStructure({ data, proteinMode8 = false }) {
  const { atoms, bonds } = useMemo(() => {
    if (data.atoms?.length && data.bonds?.length) {
      return { atoms: data.atoms, bonds: data.bonds }
    }
    return createFallbackAtomsAndBonds(data)
  }, [data])

  const [selectedAtom, setSelectedAtom] = useState(null)

  const handleClick = useCallback((e, atom) => {
    e.stopPropagation()
    setSelectedAtom((prev) => (prev?.key === atom.key ? null : atom))
  }, [])

  const handleMissed = useCallback(() => setSelectedAtom(null), [])

  return (
    <group onPointerMissed={handleMissed}>
      {bonds.map((bond, index) => {
        const start = atoms[bond.from]?.position
        const end = atoms[bond.to]?.position
        if (!start || !end) return null

        return (
          <Line
            key={`protein-bond-${index}`}
            points={[start, end]}
            color={proteinMode8 ? BLUEPRINT_LINE : '#80b9dc'}
            transparent
            opacity={proteinMode8 ? 0.82 : 0.5}
            lineWidth={proteinMode8 ? 1.2 : 0.8}
          />
        )
      })}
      {atoms.map((atom) => {
        const style = getAtomRenderStyle(atom.element) ?? getAtomRenderStyle(FALLBACK_ELEMENT)
        const radius = ATOM_RADIUS[atom.element] ?? ATOM_RADIUS.C
        const isSelected = selectedAtom?.key === atom.key

        if (proteinMode8) {
          return (
            <mesh
              key={atom.key}
              position={atom.position}
              scale={isSelected ? radius * 1.4 : radius}
              onClick={(e) => handleClick(e, atom)}
            >
              <sphereGeometry args={[1, 10, 10]} />
              <meshBasicMaterial color={style.color} wireframe transparent opacity={isSelected ? 1 : 0.92} />
            </mesh>
          )
        }

        return (
          <mesh
            key={atom.key}
            position={atom.position}
            scale={isSelected ? radius * 1.4 : radius}
            onClick={(e) => handleClick(e, atom)}
          >
            <sphereGeometry args={[1, 10, 10]} />
            <meshStandardMaterial
              color={style.color}
              emissive={style.emissive}
              emissiveIntensity={style.emissiveIntensity * 0.55}
              roughness={0.48}
              metalness={0.16}
            />
          </mesh>
        )
      })}
      {selectedAtom && (
        <Html
          position={selectedAtom.position}
          center
          distanceFactor={12}
          zIndexRange={[40, 0]}
        >
          <div style={{ pointerEvents: 'none', textAlign: 'center' }}>
            <AtomTooltip element={selectedAtom.element} />
            <div style={{
              marginTop: 4,
              padding: '3px 8px',
              background: 'rgba(3,9,20,0.82)',
              border: '1px solid rgba(90,160,255,0.28)',
              borderRadius: 4,
              color: 'rgba(190,225,255,0.9)',
              font: '10px/1.4 "Courier New", monospace',
              whiteSpace: 'nowrap',
            }}>
              <div>{selectedAtom.atomName} · {selectedAtom.resName} {selectedAtom.resNum}</div>
              <div style={{ opacity: 0.6 }}>Chain {selectedAtom.chainId}</div>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function ProteinCartoon({ data, proteinMode8 = false }) {
  const { segments, disulfideEndpoints } = useMemo(() => {
    const segments = data.chains.flatMap((chain, chainIndex) =>
      segmentBySSType(chain.residues).map((segment, segmentIndex) => ({
        key: `${chain.id}-${chainIndex}-${segmentIndex}`,
        ...segment,
      })),
    )
    const index = buildResidueIndex(data.chains)
    const disulfideEndpoints = data.disulfides
      .map((bond) => ({
        start: lookupCa(index, bond.chainA, bond.resA),
        end: lookupCa(index, bond.chainB, bond.resB),
      }))
      .filter((endpoint) => endpoint.start && endpoint.end)

    return { segments, disulfideEndpoints }
  }, [data])

  return (
    <group>
      {segments.map((segment) => (
        <group key={segment.key}>
          <BackboneSegment points={segment.caPositions} ssType={segment.type} blueprint={proteinMode8} />
          {segment.type === 'helix' && <HelixRibbon points={segment.caPositions} blueprint={proteinMode8} />}
          {segment.type === 'strand' && <StrandArrow points={segment.caPositions} blueprint={proteinMode8} />}
        </group>
      ))}
      {disulfideEndpoints.map((endpoint, index) => (
        <DisulfideBond key={index} start={endpoint.start} end={endpoint.end} />
      ))}
    </group>
  )
}

function ProteinStructure({ data, proteinMode8 = false, renderMode = 'cartoon' }) {
  if (renderMode === 'wireframe') {
    return <ProteinWireframe data={data} proteinMode8={proteinMode8} />
  }

  if (renderMode === 'molecular') {
    return <ProteinMolecularStructure data={data} proteinMode8={proteinMode8} />
  }

  return <ProteinCartoon data={data} proteinMode8={proteinMode8} />
}

export { ProteinStructure }
