import { useMemo } from 'react'
import * as THREE from 'three'

const STRAND_RADIUS = 0.20
const ARROW_BASE_RADIUS = 0.34
const ARROW_LENGTH = 0.55

const BLUEPRINT_INK = '#1f4f5a'
const BLUEPRINT_TUBE = '#2c6896'

export default function StrandArrow({ points, blueprint = false }) {
  const { tubeGeom, headGeom, headPosition, headQuaternion } = useMemo(() => {
    if (!points || points.length < 2) return {}

    const vec3s = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    const last = vec3s[vec3s.length - 1]
    const prev = vec3s[vec3s.length - 2]
    const dir = new THREE.Vector3().subVectors(last, prev).normalize()

    const bodyEnd = new THREE.Vector3().copy(last).addScaledVector(dir, -ARROW_LENGTH * 0.5)
    const bodyPoints = [...vec3s.slice(0, -1), bodyEnd]
    const curve = new THREE.CatmullRomCurve3(bodyPoints, false, 'catmullrom', 0.5)
    const tubular = Math.max(8, bodyPoints.length * 6)
    const tubeGeom = new THREE.TubeGeometry(curve, tubular, STRAND_RADIUS, 8, false)

    const headGeom = new THREE.CylinderGeometry(0, ARROW_BASE_RADIUS, ARROW_LENGTH, 12, 1, false)
    const headPosition = new THREE.Vector3().copy(bodyEnd).addScaledVector(dir, ARROW_LENGTH * 0.5)
    const up = new THREE.Vector3(0, 1, 0)
    const headQuaternion = new THREE.Quaternion().setFromUnitVectors(up, dir)

    return { tubeGeom, headGeom, headPosition, headQuaternion }
  }, [points])

  if (!tubeGeom) return null

  if (blueprint) {
    return (
      <group>
        <mesh geometry={tubeGeom}>
          <meshBasicMaterial color={BLUEPRINT_TUBE} />
        </mesh>
        <mesh
          geometry={headGeom}
          position={headPosition}
          quaternion={headQuaternion}
        >
          <meshBasicMaterial color={BLUEPRINT_TUBE} />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      <mesh geometry={tubeGeom}>
        <meshStandardMaterial
          color="#4ab8e8"
          emissive="#1f607a"
          emissiveIntensity={1.2}
          roughness={0.45}
          metalness={0.2}
        />
      </mesh>
      <mesh
        geometry={headGeom}
        position={headPosition}
        quaternion={headQuaternion}
      >
        <meshStandardMaterial
          color="#7accec"
          emissive="#2a7a9a"
          emissiveIntensity={1.3}
          roughness={0.45}
          metalness={0.2}
        />
      </mesh>
    </group>
  )
}
