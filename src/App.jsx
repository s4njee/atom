import { Line } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useRef, useState } from 'react'
import * as THREE from 'three'

const ORBITAL_SCALE = 0.82
const ATOM_SCALES = {
  H: 0.09,
  C: 0.22,
  N: 0.205,
  O: 0.19,
}
const ELECTRON_TEXTURE = (() => {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )

  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(180,225,255,0.95)')
  gradient.addColorStop(0.45, 'rgba(77,163,255,0.38)')
  gradient.addColorStop(1, 'rgba(77,163,255,0)')

  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
})()
function sampleGamma5(scale) {
  let sum = 0

  for (let i = 0; i < 5; i += 1) {
    sum += -Math.log(Math.max(1e-6, Math.random()))
  }

  return sum * scale
}

function samplePOrbitalPoint(scale = ORBITAL_SCALE) {
  let x = 0
  let y = 0
  let z = 0
  let length = 0

  do {
    x = Math.random() * 2 - 1
    y = Math.random() * 2 - 1
    z = Math.random() * 2 - 1
    length = Math.sqrt(x * x + y * y + z * z)
  } while (length === 0 || length > 1)

  x /= length
  y /= length
  z /= length

  while (Math.random() > y * y) {
    do {
      x = Math.random() * 2 - 1
      y = Math.random() * 2 - 1
      z = Math.random() * 2 - 1
      length = Math.sqrt(x * x + y * y + z * z)
    } while (length === 0 || length > 1)

    x /= length
    y /= length
    z /= length
  }

  const radius = sampleGamma5(scale)

  return new THREE.Vector3(x * radius, y * radius, z * radius)
}

function createCloudPositions(count = 1200) {
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i += 1) {
    const point = samplePOrbitalPoint()
    const stride = i * 3
    positions[stride] = point.x
    positions[stride + 1] = point.y
    positions[stride + 2] = point.z
  }

  return positions
}

function Electron({
  color = '#66b8ff',
  speed = 6.5,
  phase = 0,
  yBiasRef = null,
  invertBias = false,
  axis = 'y',
  lobeTightness = 1,
}) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 28 }, () => new THREE.Vector3()),
  )

  useFrame((state) => {
    const wobble = state.clock.getElapsedTime() * speed + phase
    const bias = yBiasRef ? yBiasRef.current * (invertBias ? -1 : 1) : 1
    const radialA = 0.85 + Math.sin(wobble * 0.31) * 0.22 + Math.cos(wobble * 0.57) * 0.08
    const radialB = 0.82 + Math.cos(wobble * 0.27) * 0.2 + Math.sin(wobble * 0.49) * 0.1

    const transverseA =
      (Math.sin(wobble * 2.7) * 0.72 + Math.sin(wobble * 4.9) * 0.16) *
      radialA *
      ORBITAL_SCALE *
      lobeTightness
    const longitudinal =
      bias *
      (Math.abs(Math.sin(wobble * 1.18)) * 2.7 + Math.abs(Math.sin(wobble * 2.05)) * 0.38) *
      ORBITAL_SCALE
    const transverseB =
      (Math.cos(wobble * 2.3) * 0.74 + Math.cos(wobble * 4.3) * 0.15) *
      radialB *
      ORBITAL_SCALE *
      lobeTightness

    let px = transverseA
    let py = longitudinal
    let pz = transverseB

    if (axis === 'x') {
      px = longitudinal
      py = transverseA
      pz = transverseB
    }

    electronRef.current.position.set(px, py, pz)

    const history = historyRef.current
    const oldest = history.pop()
    oldest.set(px, py, pz)
    history.unshift(oldest)

    if (trailRef.current) {
      trailRef.current.geometry.setFromPoints(history)
    }
  })

  return (
    <>
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color={color} transparent opacity={0.22} />
      </line>

      <group ref={electronRef}>
        <sprite scale={[0.24, 0.24, 0.24]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[0.7, 0.7, 0.7]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.15}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight color={color} intensity={18} distance={3.8} decay={2} />
      </group>
    </>
  )
}

function SigmaBondElectron({ color = '#a8e0ff', speed = 11.5, phase = 0 }) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 24 }, () => new THREE.Vector3()),
  )

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase
    const px =
      Math.sin(t * 1.8) * 0.86 +
      Math.sin(t * 3.1) * 0.12
    const py =
      Math.sin(t * 2.4) * 0.14 +
      Math.cos(t * 4.2) * 0.03
    const pz =
      Math.cos(t * 2.1) * 0.12 +
      Math.sin(t * 3.6) * 0.03

    electronRef.current.position.set(px, py, pz)

    const history = historyRef.current
    const oldest = history.pop()
    oldest.set(px, py, pz)
    history.unshift(oldest)

    if (trailRef.current) {
      trailRef.current.geometry.setFromPoints(history)
    }
  })

  return (
    <>
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color={color} transparent opacity={0.18} />
      </line>

      <group ref={electronRef}>
        <sprite scale={[0.2, 0.2, 0.2]} renderOrder={5}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.95}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[0.58, 0.58, 0.58]} renderOrder={5}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.14}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight color={color} intensity={12} distance={2.6} decay={2} />
      </group>
    </>
  )
}

function SigmaBondPair({ colorA = '#c2ebff', colorB = '#8fd2ff', speedA = 11.8, speedB = 10.9 }) {
  return (
    <>
      <SigmaBondElectron color={colorA} speed={speedA} phase={0} />
      <SigmaBondElectron color={colorB} speed={speedB} phase={Math.PI * 0.75} />
    </>
  )
}

function SigmaBondCloud() {
  return null
}

function PiBondCloud({ offset = [0, 0.62, 0] }) {
  return null
}

function OrbitalCloud() {
  const cloudRef = useRef(null)
  const pointsRef = useRef(createCloudPositions())

  useFrame((state) => {
    const positions = pointsRef.current
    const start = (Math.floor(state.clock.getElapsedTime() * 120) * 15) % 1200

    for (let i = 0; i < 15; i += 1) {
      const point = samplePOrbitalPoint()
      const stride = ((start + i) % 1200) * 3
      positions[stride] = point.x
      positions[stride + 1] = point.y
      positions[stride + 2] = point.z
    }

    cloudRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={cloudRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pointsRef.current, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#6bbcff"
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.18}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function ElectronPair({ axis = 'y', lobeTightness = 1 }) {
  const swapRef = useRef(1)
  const swapTimerRef = useRef(0)
  const swapProgressRef = useRef(1)
  const polarityRef = useRef(1)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const interval = 1.8 + (Math.sin(t * 0.37) * 0.5 + 0.5) * 1.4

    if (swapProgressRef.current < 1) {
      swapProgressRef.current = Math.min(1, swapProgressRef.current + state.clock.getDelta() * 2.8)
    } else {
      swapTimerRef.current += state.clock.getDelta()

      if (swapTimerRef.current >= interval) {
        swapTimerRef.current = 0
        swapProgressRef.current = 0
        swapRef.current *= -1
      }
    }

    const swapMix = 1 - (1 - swapProgressRef.current) ** 3
    polarityRef.current = THREE.MathUtils.lerp(-swapRef.current, swapRef.current, swapMix)
  })

  return (
    <>
      <Electron
        color="#4da3ff"
        speed={16}
        phase={0}
        yBiasRef={polarityRef}
        axis={axis}
        lobeTightness={lobeTightness}
      />
      <Electron
        color="#79c0ff"
        speed={14.5}
        phase={Math.PI / 2}
        yBiasRef={polarityRef}
        invertBias
        axis={axis}
        lobeTightness={lobeTightness}
      />
    </>
  )
}

function Nucleus({
  position = [0, 0, 0],
  scale = 0.24,
  color = '#23425d',
  emissive = '#18334d',
  emissiveIntensity = 1.4,
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.35}
        metalness={0.08}
        toneMapped={false}
      />
    </mesh>
  )
}

function BondElectron({
  start = [0, 0, 0],
  end = [1, 0, 0],
  color = '#8fd4ff',
  speed = 10,
  phase = 0,
  lineScale = 0.34,
  spread = 0.12,
}) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 24 }, () => new THREE.Vector3()),
  )

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase
    const startVec = new THREE.Vector3(...start)
    const endVec = new THREE.Vector3(...end)
    const midpoint = startVec.clone().add(endVec).multiplyScalar(0.5)
    const axis = endVec.clone().sub(startVec).normalize()
    const length = startVec.distanceTo(endVec)
    const reference = Math.abs(axis.y) < 0.92
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    const normalA = axis.clone().cross(reference).normalize()
    const normalB = axis.clone().cross(normalA).normalize()

    const along = Math.sin(t * 1.7) * length * lineScale
    const offsetA = Math.sin(t * 3.1) * spread
    const offsetB = Math.cos(t * 2.6) * spread * 0.65

    const position = midpoint
      .clone()
      .add(axis.multiplyScalar(along))
      .add(normalA.multiplyScalar(offsetA))
      .add(normalB.multiplyScalar(offsetB))

    electronRef.current.position.copy(position)

    const history = historyRef.current
    const oldest = history.pop()
    oldest.copy(position)
    history.unshift(oldest)

    if (trailRef.current) {
      trailRef.current.geometry.setFromPoints(history)
    }
  })

  return (
    <>
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color={color} transparent opacity={0.16} />
      </line>

      <group ref={electronRef}>
        <sprite scale={[0.18, 0.18, 0.18]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.94}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[0.5, 0.5, 0.5]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.12}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight color={color} intensity={10} distance={2.4} decay={2} />
      </group>
    </>
  )
}

function BondElectronPair({
  start,
  end,
  colorA = '#8fd4ff',
  colorB = '#6fbfff',
  speed = 10,
  phase = 0,
  lineScale = 0.34,
  spread = 0.12,
}) {
  return (
    <>
      <BondElectron
        start={start}
        end={end}
        color={colorA}
        speed={speed}
        phase={phase}
        lineScale={lineScale}
        spread={spread}
      />
      <BondElectron
        start={start}
        end={end}
        color={colorB}
        speed={speed * 0.96}
        phase={phase + Math.PI * 0.78}
        lineScale={lineScale}
        spread={spread * 0.92}
      />
    </>
  )
}

function AromaticRingElectron({
  ringPoints,
  color = '#a7ddff',
  speed = 11.5,
  phase = 0,
  lift = 0.2,
  side = 1,
}) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 36 }, () => new THREE.Vector3()),
  )

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const curve = new THREE.CatmullRomCurve3(
      ringPoints.map((point) => new THREE.Vector3(...point)),
      true,
      'catmullrom',
      0.12,
    )
    const progress = ((t * speed) / 8 + phase) % 1
    const basePoint = curve.getPointAt(progress)
    const tangent = curve.getTangentAt(progress).normalize()
    const center = ringPoints.reduce(
      (sum, point) => sum.add(new THREE.Vector3(...point)),
      new THREE.Vector3(),
    ).multiplyScalar(1 / ringPoints.length)
    const ringNormal = new THREE.Vector3()
      .subVectors(new THREE.Vector3(...ringPoints[1]), new THREE.Vector3(...ringPoints[0]))
      .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...ringPoints[2]), new THREE.Vector3(...ringPoints[1])))
      .normalize()
    const radial = basePoint.clone().sub(center).normalize()
    const hover = ringNormal.multiplyScalar(
      side * (lift + Math.sin(t * 4.2 + phase * Math.PI * 2) * lift * 0.18),
    )
    const position = basePoint
      .clone()
      .add(radial.multiplyScalar(0.07))
      .add(hover)
      .add(tangent.multiplyScalar(Math.sin(t * 3.3 + phase * Math.PI * 2) * 0.02))

    electronRef.current.position.copy(position)

    const history = historyRef.current
    const oldest = history.pop()
    oldest.copy(position)
    history.unshift(oldest)

    if (trailRef.current) {
      trailRef.current.geometry.setFromPoints(history)
    }
  })

  return (
    <>
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color={color} transparent opacity={0.18} />
      </line>

      <group ref={electronRef}>
        <sprite scale={[0.18, 0.18, 0.18]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[0.52, 0.52, 0.52]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.14}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight color={color} intensity={10} distance={2.4} decay={2} />
      </group>
    </>
  )
}

function AromaticRingPair({
  ringPoints,
  colorA = '#9edbff',
  colorB = '#d4f1ff',
  speed = 11.5,
}) {
  return (
    <>
      <AromaticRingElectron
        ringPoints={ringPoints}
        color={colorA}
        speed={speed}
        phase={0}
        side={1}
      />
      <AromaticRingElectron
        ringPoints={ringPoints}
        color={colorB}
        speed={speed * 1.06}
        phase={0.5}
        side={-1}
      />
    </>
  )
}

function StructuralBond({
  start = [0, 0, 0],
  end = [1, 0, 0],
  color = '#6eaad8',
  opacity = 0.55,
}) {
  return (
    <Line
      points={[start, end]}
      color={color}
      transparent
      opacity={opacity}
      lineWidth={1}
    />
  )
}

function PiBondElectron({ sign = 1, color = '#8fd0ff', speed = 12, phase = 0 }) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 26 }, () => new THREE.Vector3(0, sign * 0.55, 0)),
  )

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase
    const position = new THREE.Vector3(
      Math.sin(t * 1.9) * 0.92 + Math.sin(t * 3.2) * 0.14,
      sign * (0.58 + Math.abs(Math.sin(t * 1.4)) * 0.28),
      Math.cos(t * 2.3) * 0.16 + Math.sin(t * 4.1) * 0.04,
    )

    electronRef.current.position.copy(position)

    const history = historyRef.current
    const oldest = history.pop()
    oldest.copy(position)
    history.unshift(oldest)

    if (trailRef.current) {
      trailRef.current.geometry.setFromPoints(history)
    }
  })

  return (
    <>
      <line ref={trailRef}>
        <bufferGeometry />
        <lineBasicMaterial color={color} transparent opacity={0.18} />
      </line>

      <group ref={electronRef}>
        <sprite scale={[0.19, 0.19, 0.19]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[0.56, 0.56, 0.56]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.14}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight color={color} intensity={11} distance={2.5} decay={2} />
      </group>
    </>
  )
}

function PiBondPair({
  sign = 1,
  colorA = '#9dd8ff',
  colorB = '#6fbfff',
  speed = 11.9,
  phase = 0,
}) {
  return (
    <>
      <PiBondElectron sign={sign} color={colorA} speed={speed} phase={phase} />
      <PiBondElectron
        sign={sign}
        color={colorB}
        speed={speed * 0.94}
        phase={phase + Math.PI * 0.82}
      />
    </>
  )
}

function Atom() {
  const atomRef = useRef(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    atomRef.current.rotation.y = t * 0.18
    atomRef.current.rotation.x = Math.sin(t * 0.35) * 0.08
    atomRef.current.position.y = Math.sin(t * 0.75) * 0.14
  })

  return (
    <group ref={atomRef}>
      <Nucleus />
      <ElectronPair axis="y" lobeTightness={1} />
    </group>
  )
}

function OxygenMolecule() {
  const moleculeRef = useRef(null)
  const separation = 1.18

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.14
    moleculeRef.current.rotation.x = Math.sin(t * 0.22) * 0.04
    moleculeRef.current.position.y = Math.sin(t * 0.5) * 0.08
  })

  return (
    <group ref={moleculeRef}>
      <Nucleus position={[-separation, 0, 0]} scale={ATOM_SCALES.O} />
      <Nucleus position={[separation, 0, 0]} scale={ATOM_SCALES.O} />
      <SigmaBondCloud />
      <PiBondCloud offset={[0, 0.64, 0]} />
      <PiBondCloud offset={[0, -0.64, 0]} />
      <SigmaBondPair />
      <PiBondPair sign={1} colorA="#98d8ff" colorB="#69c1ff" speed={13.6} phase={0} />
      <PiBondPair sign={-1} colorA="#66b8ff" colorB="#9fdfff" speed={12.8} phase={Math.PI / 2} />
    </group>
  )
}

function EthyleneMolecule() {
  const moleculeRef = useRef(null)
  const carbonLeft = [-0.92, 0, 0]
  const carbonRight = [0.92, 0, 0]
  const hydrogens = [
    [-1.86, 0.98, 0],
    [-1.86, -0.98, 0],
    [1.86, 0.98, 0],
    [1.86, -0.98, 0],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.12
    moleculeRef.current.rotation.x = Math.sin(t * 0.2) * 0.035
    moleculeRef.current.position.y = Math.sin(t * 0.45) * 0.06
  })

  return (
    <group ref={moleculeRef}>
      <Nucleus
        position={carbonLeft}
        scale={ATOM_SCALES.C}
        color="#294866"
        emissive="#1d3550"
        emissiveIntensity={1.55}
      />
      <Nucleus
        position={carbonRight}
        scale={ATOM_SCALES.C}
        color="#294866"
        emissive="#1d3550"
        emissiveIntensity={1.55}
      />

      {hydrogens.map((position, index) => (
        <Nucleus
          key={`h-${index}`}
          position={position}
          scale={ATOM_SCALES.H}
          color="#7ea7c9"
          emissive="#40607f"
          emissiveIntensity={0.9}
        />
      ))}

      <BondElectronPair
        start={carbonLeft}
        end={carbonRight}
        colorA="#c7ebff"
        colorB="#9fdfff"
        speed={10.8}
        phase={0}
        spread={0.1}
      />
      <BondElectronPair
        start={carbonLeft}
        end={hydrogens[0]}
        colorA="#7fc3ff"
        colorB="#a7ddff"
        speed={9.8}
        phase={0.4}
      />
      <BondElectronPair
        start={carbonLeft}
        end={hydrogens[1]}
        colorA="#7fc3ff"
        colorB="#a7ddff"
        speed={9.2}
        phase={1.2}
      />
      <BondElectronPair
        start={carbonRight}
        end={hydrogens[2]}
        colorA="#7fc3ff"
        colorB="#a7ddff"
        speed={10.1}
        phase={2.1}
      />
      <BondElectronPair
        start={carbonRight}
        end={hydrogens[3]}
        colorA="#7fc3ff"
        colorB="#a7ddff"
        speed={9.4}
        phase={2.8}
      />

      <PiBondPair sign={1} colorA="#9dd8ff" colorB="#c5ebff" speed={11.9} phase={0} />
      <PiBondPair sign={-1} colorA="#6fbfff" colorB="#9ed9ff" speed={11.1} phase={Math.PI * 0.7} />
    </group>
  )
}

function CaffeineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.58
  const atomDefs = [
    // PubChem CID 2519, 3D conformer heavy-atom coordinates.
    { key: 'a1', element: 'O', scale: ATOM_SCALES.O, position: [0.4700 * scale, 2.5688 * scale, 0.0006 * scale] },
    { key: 'a2', element: 'O', scale: ATOM_SCALES.O, position: [-3.1271 * scale, -0.4436 * scale, -0.0003 * scale] },
    { key: 'a3', element: 'N', scale: ATOM_SCALES.N, position: [-0.9686 * scale, -1.3125 * scale, 0] },
    { key: 'a4', element: 'N', scale: ATOM_SCALES.N, position: [2.2182 * scale, 0.1412 * scale, -0.0003 * scale] },
    { key: 'a5', element: 'N', scale: ATOM_SCALES.N, position: [-1.3477 * scale, 1.0797 * scale, -0.0001 * scale] },
    { key: 'a6', element: 'N', scale: ATOM_SCALES.N, position: [1.4119 * scale, -1.9372 * scale, 0.0002 * scale] },
    { key: 'a7', element: 'C', scale: ATOM_SCALES.C, position: [0.8579 * scale, 0.2592 * scale, -0.0008 * scale] },
    { key: 'a8', element: 'C', scale: ATOM_SCALES.C, position: [0.3897 * scale, -1.0264 * scale, -0.0004 * scale] },
    { key: 'a9', element: 'C', scale: ATOM_SCALES.C, position: [0.0307 * scale, 1.4220 * scale, -0.0006 * scale] },
    { key: 'a10', element: 'C', scale: ATOM_SCALES.C, position: [-1.9061 * scale, -0.2495 * scale, -0.0004 * scale] },
    { key: 'a11', element: 'C', scale: ATOM_SCALES.C, position: [2.5032 * scale, -1.1998 * scale, 0.0003 * scale] },
    { key: 'a12', element: 'C', scale: ATOM_SCALES.C, position: [-1.4276 * scale, -2.6960 * scale, 0.0008 * scale] },
    { key: 'a13', element: 'C', scale: ATOM_SCALES.C, position: [3.1926 * scale, 1.2061 * scale, 0.0003 * scale] },
    { key: 'a14', element: 'C', scale: ATOM_SCALES.C, position: [-2.2969 * scale, 2.1881 * scale, 0.0007 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['a1', 'a9'],
    ['a2', 'a10'],
    ['a3', 'a8'],
    ['a3', 'a10'],
    ['a3', 'a12'],
    ['a4', 'a7'],
    ['a4', 'a11'],
    ['a4', 'a13'],
    ['a5', 'a9'],
    ['a5', 'a10'],
    ['a5', 'a14'],
    ['a6', 'a8'],
    ['a6', 'a11'],
    ['a7', 'a8'],
    ['a7', 'a9'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.09
    moleculeRef.current.rotation.x = Math.sin(t * 0.18) * 0.04
    moleculeRef.current.position.y = Math.sin(t * 0.38) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {atomDefs.map(({ key, element, scale }) => (
        <Nucleus
          key={key}
          position={atoms[key]}
          scale={scale}
          color={atomStyle[element].color}
          emissive={atomStyle[element].emissive}
          emissiveIntensity={atomStyle[element].emissiveIntensity}
        />
      ))}

      {bondDefs.map(([startKey, endKey]) => (
        <StructuralBond
          key={`structure-${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
        />
      ))}

      {bondDefs.map(([startKey, endKey], index) => (
        <BondElectronPair
          key={`${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          colorA={index < 12 ? '#9edbff' : '#7fc3ff'}
          colorB={index < 12 ? '#d1f0ff' : '#b7e6ff'}
          speed={8.6 + (index % 5) * 0.45}
          phase={index * 0.41}
          spread={index < 12 ? 0.09 : 0.07}
          lineScale={index < 12 ? 0.3 : 0.26}
        />
      ))}
    </group>
  )
}

function GlucoseMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.7
  const atomDefs = [
    // Approximate beta-D-glucopyranose chair conformation in ring form.
    { key: 'o5', element: 'O', scale: ATOM_SCALES.O, position: [-0.72 * scale, 0.92 * scale, 0.1 * scale] },
    { key: 'c1', element: 'C', scale: ATOM_SCALES.C, position: [0.34 * scale, 1.2 * scale, 0.42 * scale] },
    { key: 'c2', element: 'C', scale: ATOM_SCALES.C, position: [1.28 * scale, 0.42 * scale, 0.04 * scale] },
    { key: 'c3', element: 'C', scale: ATOM_SCALES.C, position: [1.02 * scale, -0.82 * scale, -0.38 * scale] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-0.14 * scale, -1.18 * scale, -0.06 * scale] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-1.02 * scale, -0.22 * scale, 0.34 * scale] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [-2.16 * scale, 0.18 * scale, 1.14 * scale] },
    { key: 'o1', element: 'O', scale: ATOM_SCALES.O, position: [0.56 * scale, 2.28 * scale, 1.2 * scale] },
    { key: 'o2', element: 'O', scale: ATOM_SCALES.O, position: [2.46 * scale, 0.78 * scale, 0.42 * scale] },
    { key: 'o3', element: 'O', scale: ATOM_SCALES.O, position: [1.82 * scale, -1.7 * scale, -0.78 * scale] },
    { key: 'o4', element: 'O', scale: ATOM_SCALES.O, position: [-0.4 * scale, -2.32 * scale, -0.86 * scale] },
    { key: 'o6', element: 'O', scale: ATOM_SCALES.O, position: [-3.1 * scale, -0.34 * scale, 1.78 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['o5', 'c1'],
    ['c1', 'c2'],
    ['c2', 'c3'],
    ['c3', 'c4'],
    ['c4', 'c5'],
    ['c5', 'o5'],
    ['c5', 'c6'],
    ['c1', 'o1'],
    ['c2', 'o2'],
    ['c3', 'o3'],
    ['c4', 'o4'],
    ['c6', 'o6'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = t * 0.095
    moleculeRef.current.rotation.x = Math.sin(t * 0.2) * 0.045
    moleculeRef.current.rotation.z = Math.sin(t * 0.11) * 0.025
    moleculeRef.current.position.y = Math.sin(t * 0.4) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {atomDefs.map(({ key, element, scale }) => (
        <Nucleus
          key={key}
          position={atoms[key]}
          scale={scale}
          color={atomStyle[element].color}
          emissive={atomStyle[element].emissive}
          emissiveIntensity={atomStyle[element].emissiveIntensity}
        />
      ))}

      {bondDefs.map(([startKey, endKey]) => (
        <StructuralBond
          key={`structure-${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
        />
      ))}

      {bondDefs.map(([startKey, endKey], index) => (
        <BondElectronPair
          key={`${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          colorA={index < 7 ? '#8fd4ff' : '#9edbff'}
          colorB={index < 7 ? '#bfe7ff' : '#d4f1ff'}
          speed={8.4 + (index % 4) * 0.55}
          phase={index * 0.46}
          spread={index < 7 ? 0.085 : 0.07}
          lineScale={index < 7 ? 0.28 : 0.24}
        />
      ))}
    </group>
  )
}

function EpinephrineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.78
  const atomDefs = [
    // Approximate heavy-atom layout for epinephrine highlighting the catechol ring.
    { key: 'c1', element: 'C', scale: ATOM_SCALES.C, position: [1.12 * scale, 0.04 * scale, 0.02 * scale] },
    { key: 'c2', element: 'C', scale: ATOM_SCALES.C, position: [0.54 * scale, 0.98 * scale, 0.01 * scale] },
    { key: 'c3', element: 'C', scale: ATOM_SCALES.C, position: [-0.56 * scale, 0.96 * scale, -0.02 * scale] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-1.12 * scale, -0.02 * scale, -0.01 * scale] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-0.54 * scale, -0.98 * scale, 0.02 * scale] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [0.56 * scale, -0.96 * scale, 0.01 * scale] },
    { key: 'o3', element: 'O', scale: ATOM_SCALES.O, position: [-1.1 * scale, 1.78 * scale, -0.12 * scale] },
    { key: 'o4', element: 'O', scale: ATOM_SCALES.O, position: [-2.26 * scale, -0.02 * scale, -0.16 * scale] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [2.28 * scale, 0.06 * scale, 0.2 * scale] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [3.18 * scale, -0.84 * scale, 0.66 * scale] },
    { key: 'o8', element: 'O', scale: ATOM_SCALES.O, position: [3.42 * scale, -1.92 * scale, -0.12 * scale] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [4.26 * scale, -0.06 * scale, 0.92 * scale] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [5.34 * scale, -0.58 * scale, 1.58 * scale] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const ringKeys = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
  const ringPoints = ringKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['c1', 'c2'],
    ['c2', 'c3'],
    ['c3', 'c4'],
    ['c4', 'c5'],
    ['c5', 'c6'],
    ['c6', 'c1'],
    ['c3', 'o3'],
    ['c4', 'o4'],
    ['c1', 'c7'],
    ['c7', 'c8'],
    ['c8', 'o8'],
    ['c8', 'n1'],
    ['n1', 'c9'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.22 + t * 0.085
    moleculeRef.current.rotation.x = Math.sin(t * 0.18) * 0.05
    moleculeRef.current.rotation.z = 0.34 + Math.sin(t * 0.13) * 0.028
    moleculeRef.current.position.y = Math.sin(t * 0.38) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {atomDefs.map(({ key, element, scale }) => (
        <Nucleus
          key={key}
          position={atoms[key]}
          scale={scale}
          color={atomStyle[element].color}
          emissive={atomStyle[element].emissive}
          emissiveIntensity={atomStyle[element].emissiveIntensity}
        />
      ))}

      {bondDefs.map(([startKey, endKey]) => (
        <StructuralBond
          key={`structure-${startKey}-${endKey}`}
          start={atoms[startKey]}
          end={atoms[endKey]}
          color="#77b4df"
          opacity={0.42}
        />
      ))}

      {bondDefs
        .filter(([startKey, endKey]) => !ringKeys.includes(startKey) || !ringKeys.includes(endKey))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 3 ? '#8fd4ff' : '#9edbff'}
            colorB={index < 3 ? '#bde7ff' : '#d4f1ff'}
            speed={8.6 + (index % 4) * 0.5}
            phase={index * 0.44}
            spread={0.075}
            lineScale={0.25}
          />
        ))}

      <AromaticRingPair ringPoints={ringPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.8} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#7fc3ff" colorB="#bfe7ff" speed={11.1} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#9edbff" colorB="#e6f7ff" speed={10.6} />
    </group>
  )
}

function AtomCloud() {
  const atomRef = useRef(null)

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    atomRef.current.rotation.y = t * 0.1
    atomRef.current.rotation.x = Math.sin(t * 0.24) * 0.05
    atomRef.current.position.y = Math.sin(t * 0.5) * 0.08
  })

  return (
    <group ref={atomRef}>
      <Nucleus />
      <OrbitalCloud />
    </group>
  )
}

function AtomScene({ visualization }) {
  return (
    <>
      <fog attach="fog" args={['#040913', 10, 20]} />
      <ambientLight intensity={0.36} />
      <hemisphereLight args={['#d2ecff', '#071018', 0.92]} />
      <directionalLight position={[4, 4, 6]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-4, -2, 3]} intensity={0.5} color="#4da3ff" />
      <pointLight position={[0, 0, -5]} intensity={10} distance={18} color="#13304f" />
      {visualization === 1 ? (
        <Atom />
      ) : visualization === 2 ? (
        <OxygenMolecule />
      ) : visualization === 5 ? (
        <EpinephrineMolecule />
      ) : visualization === 4 ? (
        <CaffeineMolecule />
      ) : (
        <EthyleneMolecule />
      )}
      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={1.25}
          luminanceThreshold={0.16}
          luminanceSmoothing={0.38}
          radius={0.72}
        />
      </EffectComposer>
    </>
  )
}

export default function App() {
  const [visualization, setVisualization] = useState(1)
  const label =
    visualization === 3
      ? 'ethylene'
      : visualization === 4
        ? 'caffeine'
        : visualization === 5
          ? 'epinephrine'
        : ''

  return (
    <main className="app-shell">
      <Canvas camera={{ position: [0, 0.2, 8.5], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={['#040913']} />
        <AtomScene visualization={visualization} />
      </Canvas>

      {label ? <div className="visualization-label">{label}</div> : null}

      <div className="visualization-nav">
        <button
          type="button"
          className={`visualization-button ${visualization === 1 ? 'is-active' : ''}`}
          onClick={() => setVisualization(1)}
        >
          1
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 2 ? 'is-active' : ''}`}
          onClick={() => setVisualization(2)}
        >
          2
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 3 ? 'is-active' : ''}`}
          onClick={() => setVisualization(3)}
        >
          3
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 4 ? 'is-active' : ''}`}
          onClick={() => setVisualization(4)}
        >
          4
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 5 ? 'is-active' : ''}`}
          onClick={() => setVisualization(5)}
        >
          5
        </button>
      </div>
    </main>
  )
}
