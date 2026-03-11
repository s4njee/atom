import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useRef, useState } from 'react'
import * as THREE from 'three'

const ORBITAL_SCALE = 0.82
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

function SigmaBondCloud() {
  return null
}

function PiBondCloud({ offset = [0, 0.62, 0] }) {
  return null
}

function AntibondingElectron({ color = '#8fd0ff', speed = 12.5, phase = 0, sign = 1 }) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 32 }, () => new THREE.Vector3(0, sign * 0.9, 0)),
  )

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase
    const py =
      sign *
      (0.92 +
        Math.abs(Math.sin(t * 1.27)) * 0.42 +
        Math.abs(Math.sin(t * 2.04)) * 0.12)
    const px =
      Math.sin(t * 2.2) * 1.18 +
      Math.sin(t * 3.6) * 0.22
    const pz =
      Math.cos(t * 2.55) * 0.32 +
      Math.sin(t * 4.1) * 0.08

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
        <sprite scale={[0.22, 0.22, 0.22]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.95}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <sprite scale={[0.72, 0.72, 0.72]}>
          <spriteMaterial
            map={ELECTRON_TEXTURE}
            color={color}
            transparent
            opacity={0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight color={color} intensity={15} distance={3.2} decay={2} />
      </group>
    </>
  )
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

function Nucleus({ position = [0, 0, 0], scale = 0.24 }) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        color="#23425d"
        emissive="#18334d"
        emissiveIntensity={1.4}
        roughness={0.35}
        metalness={0.08}
        toneMapped={false}
      />
    </mesh>
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
      <Nucleus position={[-separation, 0, 0]} scale={0.2} />
      <Nucleus position={[separation, 0, 0]} scale={0.2} />
      <SigmaBondCloud />
      <PiBondCloud offset={[0, 0.64, 0]} />
      <PiBondCloud offset={[0, -0.64, 0]} />
      <SigmaBondElectron color="#c2ebff" speed={11.8} phase={0} />
      <SigmaBondElectron color="#8fd2ff" speed={10.9} phase={Math.PI * 0.75} />
      <AntibondingElectron color="#98d8ff" speed={13.6} sign={1} />
      <AntibondingElectron color="#66b8ff" speed={12.8} phase={Math.PI / 2} sign={-1} />
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
      {visualization === 1 ? <Atom /> : <OxygenMolecule />}
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

  return (
    <main className="app-shell">
      <Canvas camera={{ position: [0, 0.2, 8.5], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={['#040913']} />
        <AtomScene visualization={visualization} />
      </Canvas>

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
      </div>
    </main>
  )
}
