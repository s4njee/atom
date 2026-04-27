import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SS_COLORS = {
  helix:  { color: '#e8a84a', emissive: '#a0701f', emissiveIntensity: 1.4, radius: 0.18 },
  strand: { color: '#4ab8e8', emissive: '#1f607a', emissiveIntensity: 1.2, radius: 0.16 },
  loop:   { color: '#3a6080', emissive: '#1d3550', emissiveIntensity: 0.85, radius: 0.10 },
}

const BLUEPRINT_INK = '#1f4f5a'
const BLUEPRINT_COLORS = {
  helix:  '#c49a20',
  strand: '#2c6896',
  loop:   '#4a7a9b',
}

export default function BackboneSegment({ points, ssType = 'loop', blueprint = false }) {
  const materialRef = useRef(null)
  const style = SS_COLORS[ssType] ?? SS_COLORS.loop

  const geometry = useMemo(() => {
    if (!points || points.length < 2) return null
    const vec3s = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    const curve = new THREE.CatmullRomCurve3(vec3s, false, 'catmullrom', 0.5)
    const tubular = Math.max(8, points.length * 6)
    return new THREE.TubeGeometry(curve, tubular, style.radius, 8, false)
  }, [points, style.radius])

  useFrame((state) => {
    if (blueprint || !materialRef.current || ssType !== 'helix') return
    const t = state.clock.getElapsedTime()
    materialRef.current.emissiveIntensity =
      style.emissiveIntensity + Math.sin(t * 1.6) * 0.25
  })

  if (!geometry) return null

  if (blueprint) {
    return (
      <mesh geometry={geometry}>
        <meshBasicMaterial color={BLUEPRINT_COLORS[ssType] ?? BLUEPRINT_COLORS.loop} />
      </mesh>
    )
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        color={style.color}
        emissive={style.emissive}
        emissiveIntensity={style.emissiveIntensity}
        roughness={0.45}
        metalness={0.2}
      />
    </mesh>
  )
}
