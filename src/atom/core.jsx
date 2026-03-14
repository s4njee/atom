import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { XRAY_DEFAULTS } from './config'

const ORBITAL_SCALE = 0.82
const ATOM_SCALES = {
  H: 0.09,
  C: 0.22,
  N: 0.205,
  O: 0.19,
  Cl: 0.245,
  S: 0.24,
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
const LOCAL_BOND_AXIS = new THREE.Vector3(1, 0, 0)

function normalizeXrayConfig(config = {}) {
  return {
    rimColor: config.rimColor ?? XRAY_DEFAULTS.rimColor,
    rimStrength: config.rimStrength ?? XRAY_DEFAULTS.rimStrength,
    rimPower: config.rimPower ?? XRAY_DEFAULTS.rimPower,
  }
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function createXrayMaterialController(initialConfig) {
  let config = normalizeXrayConfig(initialConfig)
  const originalMaterialState = new WeakMap()
  const xrayAnimatedMaterials = new Set()

  const forEachMaterial = (root, callback) => {
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach(callback)
    })
  }

  const captureOriginalMaterialState = (material) => {
    if (originalMaterialState.has(material)) return

    originalMaterialState.set(material, {
      color: material.color?.clone() ?? null,
      emissive: material.emissive?.clone() ?? null,
      emissiveIntensity: material.emissiveIntensity,
      metalness: material.metalness,
      roughness: material.roughness,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
      side: material.side,
      alphaTest: material.alphaTest,
      alphaHash: material.alphaHash,
      onBeforeCompile: material.onBeforeCompile,
      customProgramCacheKey: material.customProgramCacheKey,
    })
  }

  const restoreOriginalMaterialState = (material) => {
    const original = originalMaterialState.get(material)
    if (!original) return

    if (original.color && material.color) material.color.copy(original.color)
    if (original.emissive && material.emissive) material.emissive.copy(original.emissive)
    if (material.emissiveIntensity !== undefined) material.emissiveIntensity = original.emissiveIntensity ?? 1
    if (material.metalness !== undefined) material.metalness = original.metalness ?? material.metalness
    if (material.roughness !== undefined) material.roughness = original.roughness ?? material.roughness
    material.transparent = original.transparent
    material.opacity = original.opacity
    material.depthWrite = original.depthWrite
    material.side = original.side
    material.alphaTest = original.alphaTest
    material.alphaHash = original.alphaHash
    material.onBeforeCompile = original.onBeforeCompile
    material.customProgramCacheKey = original.customProgramCacheKey
    delete material.userData.xrayShader
    delete material.userData.xrayShaderApplied
    xrayAnimatedMaterials.delete(material)
    material.needsUpdate = true
  }

  const syncShaderUniforms = (material) => {
    const shader = material.userData.xrayShader
    if (!shader) return

    shader.uniforms.xrayRimColor.value.set(config.rimColor)
    shader.uniforms.xrayRimStrength.value = config.rimStrength
    shader.uniforms.xrayRimPower.value = config.rimPower
  }

  const applyXrayShader = (material) => {
    if (
      !material.isMeshStandardMaterial &&
      !material.isMeshPhysicalMaterial &&
      !material.isMeshPhongMaterial &&
      !material.isMeshLambertMaterial
    ) {
      return
    }

    if (!('onBeforeCompile' in material) || material.userData.xrayShaderApplied) return

    material.onBeforeCompile = (shader) => {
      shader.uniforms.xrayRimColor = { value: new THREE.Color(config.rimColor) }
      shader.uniforms.xrayRimStrength = { value: config.rimStrength }
      shader.uniforms.xrayRimPower = { value: config.rimPower }
      shader.uniforms.xrayTime = { value: 0 }
      shader.uniforms.xrayPulse = { value: 0 }
      shader.uniforms.xrayPhase = { value: 0 }

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform vec3 xrayRimColor;
        uniform float xrayRimStrength;
        uniform float xrayRimPower;
        uniform float xrayTime;
        uniform float xrayPulse;
        uniform float xrayPhase;`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        `float xrayViewDot = abs(dot(normalize(vNormal), normalize(vViewPosition)));
        float xrayRim = pow(1.0 - clamp(xrayViewDot, 0.0, 1.0), xrayRimPower);
        float xrayScan = 0.55 + 0.45 * sin((gl_FragCoord.y * 0.18) - (xrayTime * 14.0));
        float xrayNoise = sin(xrayTime * 24.0 + gl_FragCoord.y * 0.09)
          + 0.65 * sin(xrayTime * 41.0 + gl_FragCoord.x * 0.05)
          + 0.35 * sin(xrayTime * 67.0 + (gl_FragCoord.x + gl_FragCoord.y) * 0.025);
        float xrayGate = smoothstep(0.2, 1.55, xrayNoise);
        float xrayFlash = smoothstep(1.2, 1.9, xrayNoise);
        float xrayLocalPulse = max(xrayGate * xrayScan, xrayFlash * 1.35);
        float xraySyncPulse = max(xrayPulse, xrayLocalPulse * 0.45);
        float scanlineWave = sin((gl_FragCoord.y * 1.25) - (xrayTime * 22.0) + (xrayPhase * 9.0));
        float scanlineMask = 1.0 - (0.12 * (0.5 + 0.5 * scanlineWave) * (0.3 + 0.7 * xraySyncPulse));
        outgoingLight *= scanlineMask;
        outgoingLight *= 0.28 + (0.95 * xrayLocalPulse);
        outgoingLight += xrayRimColor * (xrayRim * xrayRimStrength * (0.35 + 1.9 * xraySyncPulse));
        diffuseColor.a *= (0.84 + (0.16 * scanlineMask)) * (0.08 + (0.92 * xraySyncPulse));
        #include <output_fragment>`,
      )

      material.userData.xrayShader = shader
      syncShaderUniforms(material)
    }

    material.customProgramCacheKey = () => 'atom-xray-rim'
    material.userData.xrayShaderApplied = true
    material.needsUpdate = true
  }

  const apply = (root) => {
    forEachMaterial(root, (material) => {
      captureOriginalMaterialState(material)
      applyXrayShader(material)
      xrayAnimatedMaterials.add(material)
      syncShaderUniforms(material)

      if (material.color) material.color.lerp(new THREE.Color(0xf5fbff), 0.42)
      if (material.emissive) material.emissive.set(0xbfefff)
      if (material.emissiveIntensity !== undefined) material.emissiveIntensity = 0.2
      if (material.metalness !== undefined) material.metalness = 0
      if (material.roughness !== undefined) material.roughness = Math.min(Math.max(material.roughness, 0.45), 0.8)
      material.transparent = true
      material.opacity = 0.3
      material.depthWrite = false
      material.alphaHash = false
      material.side = THREE.DoubleSide
      material.needsUpdate = true
    })
  }

  const restore = (root) => {
    forEachMaterial(root, restoreOriginalMaterialState)
  }

  const update = (time) => {
    for (const material of xrayAnimatedMaterials) {
      const shader = material.userData.xrayShader
      const phase = (material.id % 7) * 0.37
      const scan = 0.72 + 0.28 * Math.sin((time * 18) + phase)
      const breakup = Math.sin((time * 28) + phase) + (0.22 * Math.sin((time * 47) + (phase * 2.3)))
      const visibleGate = THREE.MathUtils.smoothstep(breakup, -0.35, 0.9)
      const flash = THREE.MathUtils.smoothstep(breakup, 1.28, 1.5)
      const pulse = Math.max(visibleGate * (0.78 + 0.22 * scan), flash * 0.45)

      if (shader) {
        syncShaderUniforms(material)
        shader.uniforms.xrayTime.value = time
        shader.uniforms.xrayPulse.value = pulse
        shader.uniforms.xrayPhase.value = phase
      }

      material.opacity = 0.2 + (0.12 * pulse)
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.18 + (0.2 * pulse)
      }
    }
  }

  const setConfig = (nextConfig) => {
    config = normalizeXrayConfig(nextConfig)

    for (const material of xrayAnimatedMaterials) {
      syncShaderUniforms(material)
    }
  }

  return { apply, restore, setConfig, update }
}

function createBuckminsterfullereneData() {
  const phi = (1 + Math.sqrt(5)) / 2
  const rawVertices = [
    [-1, phi, 0],
    [1, phi, 0],
    [-1, -phi, 0],
    [1, -phi, 0],
    [0, -1, phi],
    [0, 1, phi],
    [0, -1, -phi],
    [0, 1, -phi],
    [phi, 0, -1],
    [phi, 0, 1],
    [-phi, 0, -1],
    [-phi, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const vertices = rawVertices.map((vertex) => vertex.clone().normalize())
  const edgePairs = []
  const neighbors = Array.from({ length: vertices.length }, () => [])
  const edgeLength = vertices[0].distanceTo(vertices[11])
  const edgeTolerance = 0.05

  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      const distance = vertices[i].distanceTo(vertices[j])

      if (Math.abs(distance - edgeLength) < edgeTolerance) {
        edgePairs.push([i, j])
        neighbors[i].push(j)
        neighbors[j].push(i)
      }
    }
  }

  const directedKey = (from, to) => `${from}-${to}`
  const truncatedVertices = []
  const directedIndex = new Map()

  edgePairs.forEach(([from, to]) => {
    const nearFrom = vertices[from].clone().lerp(vertices[to], 1 / 3).normalize()
    const nearTo = vertices[to].clone().lerp(vertices[from], 1 / 3).normalize()
    directedIndex.set(directedKey(from, to), truncatedVertices.length)
    truncatedVertices.push(nearFrom)
    directedIndex.set(directedKey(to, from), truncatedVertices.length)
    truncatedVertices.push(nearTo)
  })

  const bondSet = new Set()
  const addBond = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    bondSet.add(key)
  }

  neighbors.forEach((adjacent, centerIndex) => {
    const center = vertices[centerIndex]
    const normal = center.clone().normalize()
    const reference = Math.abs(normal.y) < 0.95
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    const tangentA = new THREE.Vector3().crossVectors(normal, reference).normalize()
    const tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize()

    const ordered = adjacent
      .map((neighborIndex) => {
        const direction = vertices[neighborIndex].clone().sub(center)
        const angle = Math.atan2(direction.dot(tangentB), direction.dot(tangentA))
        return { neighborIndex, angle }
      })
      .sort((left, right) => left.angle - right.angle)

    for (let i = 0; i < ordered.length; i += 1) {
      const current = directedIndex.get(directedKey(centerIndex, ordered[i].neighborIndex))
      const next = directedIndex.get(
        directedKey(centerIndex, ordered[(i + 1) % ordered.length].neighborIndex),
      )
      addBond(current, next)
    }
  })

  edgePairs.forEach(([from, to]) => {
    addBond(directedIndex.get(directedKey(from, to)), directedIndex.get(directedKey(to, from)))
  })

  const scale = 2.35
  const atomPositions = truncatedVertices.map((vertex) => vertex.toArray().map((value) => value * scale))
  const bonds = Array.from(bondSet, (key) => key.split('-').map(Number))

  return { atomPositions, bonds }
}

const BUCKMINSTERFULLERENE = createBuckminsterfullereneData()
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
  lightIntensity = 0,
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
        {lightIntensity > 0 ? (
          <pointLight color={color} intensity={lightIntensity} distance={3.8} decay={2} />
        ) : null}
      </group>
    </>
  )
}

function SigmaBondElectron({ color = '#a8e0ff', speed = 11.5, phase = 0, lightIntensity = 0 }) {
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
        {lightIntensity > 0 ? (
          <pointLight color={color} intensity={lightIntensity} distance={2.6} decay={2} />
        ) : null}
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

// Compatibility stub: earlier molecule drafts had a separate volumetric cloud pass layered on
// top of the sigma bond electrons. The current look gets enough motion from the animated
// sprites/trails alone, so we keep the component surface but intentionally render nothing.
// If we ever bring the cloud layer back, this is the hook point and existing call sites can
// stay unchanged.
function SigmaBondCloud() {
  return null
}

// Same stub contract as SigmaBondCloud. `offset` stays in the signature so older call sites
// still document where the pi lobe would sit if we reintroduce a visible cloud pass.
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
  roughness = 0.2,
  metalness = 0.18,
  clearcoat = 0.9,
  clearcoatRoughness = 0.16,
  reflectivity = 1,
  sheen = 0.2,
}) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshPhysicalMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={roughness}
        metalness={metalness}
        clearcoat={clearcoat}
        clearcoatRoughness={clearcoatRoughness}
        reflectivity={reflectivity}
        sheen={sheen}
        sheenColor="#d9f3ff"
        specularIntensity={1}
        specularColor="#f4fbff"
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
  lightIntensity = 0,
}) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 24 }, () => new THREE.Vector3()),
  )
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
  const positionRef = useRef(new THREE.Vector3())

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase
    const along = Math.sin(t * 1.7) * length * lineScale
    const offsetA = Math.sin(t * 3.1) * spread
    const offsetB = Math.cos(t * 2.6) * spread * 0.65

    const position = positionRef.current
    position
      .copy(midpoint)
      .addScaledVector(axis, along)
      .addScaledVector(normalA, offsetA)
      .addScaledVector(normalB, offsetB)

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
        {lightIntensity > 0 ? (
          <pointLight color={color} intensity={lightIntensity} distance={2.4} decay={2} />
        ) : null}
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
  lightIntensity = 10,
}) {
  // Per-electron point lights are the main GPU-cost lever in the bond system. Treat
  // Atropine as the high-GPU lighting reference when a richer, more luminous bond pass is
  // acceptable. Treat Empagliflozin as the low-GPU reference/preset: prefer dimmer or
  // disabled bond lights there when we need a lighter-weight lighting profile.
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
        lightIntensity={lightIntensity}
      />
      <BondElectron
        start={start}
        end={end}
        color={colorB}
        speed={speed * 0.96}
        phase={phase + Math.PI * 0.78}
        lineScale={lineScale}
        spread={spread * 0.92}
        lightIntensity={lightIntensity}
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
  lightIntensity = 0,
}) {
  const electronRef = useRef(null)
  const trailRef = useRef(null)
  const historyRef = useRef(
    Array.from({ length: 36 }, () => new THREE.Vector3()),
  )
  const curve = new THREE.CatmullRomCurve3(
    ringPoints.map((point) => new THREE.Vector3(...point)),
    true,
    'catmullrom',
    0.12,
  )
  const center = ringPoints.reduce(
    (sum, point) => sum.add(new THREE.Vector3(...point)),
    new THREE.Vector3(),
  ).multiplyScalar(1 / ringPoints.length)
  const ringNormal = new THREE.Vector3()
    .subVectors(new THREE.Vector3(...ringPoints[1]), new THREE.Vector3(...ringPoints[0]))
    .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...ringPoints[2]), new THREE.Vector3(...ringPoints[1])))
    .normalize()
  const basePointRef = useRef(new THREE.Vector3())
  const tangentRef = useRef(new THREE.Vector3())
  const radialRef = useRef(new THREE.Vector3())
  const hoverRef = useRef(new THREE.Vector3())
  const positionRef = useRef(new THREE.Vector3())

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const progress = ((t * speed) / 8 + phase) % 1
    const basePoint = curve.getPointAt(progress, basePointRef.current)
    const tangent = curve.getTangentAt(progress, tangentRef.current).normalize()
    const radial = radialRef.current.copy(basePoint).sub(center).normalize()
    const hover = hoverRef.current.copy(ringNormal).multiplyScalar(
      side * (lift + Math.sin(t * 4.2 + phase * Math.PI * 2) * lift * 0.18),
    )
    const position = positionRef.current
      .copy(basePoint)
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
        {lightIntensity > 0 ? (
          <pointLight color={color} intensity={lightIntensity} distance={2.4} decay={2} />
        ) : null}
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

function getBondTransform(start = [0, 0, 0], end = [1, 0, 0]) {
  const startVec = new THREE.Vector3(...start)
  const endVec = new THREE.Vector3(...end)
  const axis = endVec.clone().sub(startVec)
  const length = axis.length()
  const midpoint = startVec.clone().add(endVec).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion()

  if (length > 0) {
    quaternion.setFromUnitVectors(LOCAL_BOND_AXIS, axis.normalize())
  }

  return { midpoint, quaternion, length }
}

function SingleBond({
  start,
  end,
  color = '#77b4df',
  opacity = 0.42,
  showStructure = true,
  electronProps = {},
}) {
  return (
    <>
      {showStructure ? (
        <StructuralBond
          start={start}
          end={end}
          color={color}
          opacity={opacity}
        />
      ) : null}
      <BondElectronPair
        start={start}
        end={end}
        {...electronProps}
      />
    </>
  )
}

function PiBondElectron({ sign = 1, color = '#8fd0ff', speed = 12, phase = 0, lightIntensity = 0 }) {
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
        {lightIntensity > 0 ? (
          <pointLight color={color} intensity={lightIntensity} distance={2.5} decay={2} />
        ) : null}
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

function DoubleBond({
  start,
  end,
  color = '#77b4df',
  opacity = 0.42,
  showStructure = true,
  sigmaProps = {},
  piPairs = [
    { sign: 1, colorA: '#9dd8ff', colorB: '#c5ebff', speed: 11.9, phase: 0 },
    { sign: -1, colorA: '#6fbfff', colorB: '#9ed9ff', speed: 11.1, phase: Math.PI * 0.7 },
  ],
}) {
  // PiBondPair is authored in a local left-to-right bond space, so the helper computes the
  // world-space midpoint/orientation once and reuses that transform for any arbitrary bond.
  const { midpoint, quaternion, length } = getBondTransform(start, end)
  const orbitalScale = length / 2

  return (
    <>
      {showStructure ? (
        <StructuralBond
          start={start}
          end={end}
          color={color}
          opacity={opacity}
        />
      ) : null}
      <BondElectronPair
        start={start}
        end={end}
        {...sigmaProps}
      />
      <group
        position={midpoint.toArray()}
        quaternion={quaternion.toArray()}
        scale={orbitalScale}
      >
        {piPairs.map(({ sign = 1, ...pairProps }, index) => (
          <PiBondPair
            // Sign and index keep the key stable when both lobes share the same phase.
            key={`pi-${sign}-${index}`}
            sign={sign}
            {...pairProps}
          />
        ))}
      </group>
    </>
  )
}

export {
  ATOM_SCALES,
  BUCKMINSTERFULLERENE,
  ElectronPair,
  Nucleus,
  SigmaBondCloud,
  PiBondCloud,
  SigmaBondPair,
  BondElectronPair,
  SingleBond,
  DoubleBond,
  AromaticRingPair,
  StructuralBond,
  PiBondPair,
  OrbitalCloud,
  isEditableTarget,
  createXrayMaterialController,
}
