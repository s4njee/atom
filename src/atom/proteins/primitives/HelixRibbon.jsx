import { useMemo } from 'react'
import * as THREE from 'three'

const HELIX_RADIUS = 0.32
const TURNS_PER_RESIDUE = 1 / 3.6
const TUBE_RADIUS = 0.05

const BLUEPRINT_INK = '#1f4f5a'
const BLUEPRINT_HELIX = '#8a9aaa'

export default function HelixRibbon({ points, blueprint = false }) {
  const geometry = useMemo(() => {
    if (!points || points.length < 3) return null

    const vec3s = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    const center = new THREE.Vector3()
    vec3s.forEach((v) => center.add(v))
    center.multiplyScalar(1 / vec3s.length)

    const axis = new THREE.Vector3()
      .subVectors(vec3s[vec3s.length - 1], vec3s[0])
      .normalize()

    const ref = Math.abs(axis.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    const u = new THREE.Vector3().crossVectors(axis, ref).normalize()
    const v = new THREE.Vector3().crossVectors(axis, u).normalize()

    const segments = vec3s.length * 8
    const length = vec3s[0].distanceTo(vec3s[vec3s.length - 1])
    const turns = vec3s.length * TURNS_PER_RESIDUE

    const path = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const along = new THREE.Vector3().copy(axis).multiplyScalar(length * t)
      const angle = turns * Math.PI * 2 * t
      const radial = new THREE.Vector3()
        .addScaledVector(u, Math.cos(angle) * HELIX_RADIUS)
        .addScaledVector(v, Math.sin(angle) * HELIX_RADIUS)
      path.push(new THREE.Vector3().copy(vec3s[0]).add(along).add(radial))
    }

    const curve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.5)
    return new THREE.TubeGeometry(curve, segments, TUBE_RADIUS, 6, false)
  }, [points])

  if (!geometry) return null

  if (blueprint) {
    return (
      <mesh geometry={geometry}>
        <meshBasicMaterial color={BLUEPRINT_HELIX} wireframe />
      </mesh>
    )
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#ffce7a"
        emissive="#c08a36"
        emissiveIntensity={1.5}
        roughness={0.4}
        metalness={0.3}
        transparent
        opacity={0.85}
      />
    </mesh>
  )
}
