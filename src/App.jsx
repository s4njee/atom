import { Line } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const ORBITAL_SCALE = 0.82
const ATOM_SCALES = {
  H: 0.09,
  C: 0.22,
  N: 0.205,
  O: 0.19,
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
const CHROMATIC_ABERRATION_OFFSET = 0.004
const CHROMATIC_OSCILLATION_SPEED = 3.2
const XRAY_RIM_STRENGTH = 1.35
const XRAY_RIM_POWER = 2.4
const XRAY_RIM_COLOR = new THREE.Color(0xe8fbff)

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function createXrayMaterialController() {
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
      shader.uniforms.xrayRimColor = { value: XRAY_RIM_COLOR.clone() }
      shader.uniforms.xrayRimStrength = { value: XRAY_RIM_STRENGTH }
      shader.uniforms.xrayRimPower = { value: XRAY_RIM_POWER }
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

  return { apply, restore, update }
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

function CapsaicinMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.72
  const atomDefs = [
    // Approximate heavy-atom layout for capsaicin emphasizing the vanillyl ring and amide tail.
    { key: 'c1', element: 'C', scale: ATOM_SCALES.C, position: [1.12 * scale, 0.02 * scale, 0.02 * scale] },
    { key: 'c2', element: 'C', scale: ATOM_SCALES.C, position: [0.56 * scale, 0.96 * scale, 0.01 * scale] },
    { key: 'c3', element: 'C', scale: ATOM_SCALES.C, position: [-0.56 * scale, 0.98 * scale, -0.03 * scale] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-1.16 * scale, 0.02 * scale, -0.02 * scale] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-0.58 * scale, -0.96 * scale, 0.03 * scale] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [0.56 * scale, -0.94 * scale, 0.01 * scale] },
    { key: 'o3', element: 'O', scale: ATOM_SCALES.O, position: [-1.08 * scale, 1.9 * scale, -0.18 * scale] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [-2.08 * scale, 2.56 * scale, -0.34 * scale] },
    { key: 'o4', element: 'O', scale: ATOM_SCALES.O, position: [-2.34 * scale, -0.04 * scale, -0.16 * scale] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [2.3 * scale, 0.08 * scale, 0.18 * scale] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [3.34 * scale, -0.44 * scale, 0.48 * scale] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [4.48 * scale, 0.02 * scale, 0.68 * scale] },
    { key: 'o9', element: 'O', scale: ATOM_SCALES.O, position: [4.88 * scale, 1.08 * scale, 0.22 * scale] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [5.42 * scale, -0.92 * scale, 1.24 * scale] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [6.68 * scale, -0.58 * scale, 1.54 * scale] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [7.76 * scale, -1.34 * scale, 2.02 * scale] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [9.04 * scale, -1.02 * scale, 2.28 * scale] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [10.12 * scale, -1.76 * scale, 2.72 * scale] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [11.28 * scale, -1.42 * scale, 2.96 * scale] },
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
    ['o3', 'c7'],
    ['c4', 'o4'],
    ['c1', 'c8'],
    ['c8', 'n1'],
    ['n1', 'c9'],
    ['c9', 'o9'],
    ['c9', 'c10'],
    ['c10', 'c11'],
    ['c11', 'c12'],
    ['c12', 'c13'],
    ['c13', 'c14'],
    ['c14', 'c15'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.32 + t * 0.082
    moleculeRef.current.rotation.x = Math.sin(t * 0.18) * 0.05
    moleculeRef.current.rotation.z = 0.24 + Math.sin(t * 0.12) * 0.024
    moleculeRef.current.position.y = Math.sin(t * 0.36) * 0.05
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
            colorA={index < 5 ? '#8fd4ff' : '#9edbff'}
            colorB={index < 5 ? '#c9edff' : '#dff5ff'}
            speed={8.2 + (index % 5) * 0.46}
            phase={index * 0.39}
            spread={index < 4 ? 0.08 : 0.07}
            lineScale={index < 4 ? 0.26 : 0.23}
          />
        ))}

      <AromaticRingPair ringPoints={ringPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.9} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#7fc3ff" colorB="#bfe7ff" speed={11.2} />
      <AromaticRingPair ringPoints={ringPoints} colorA="#9edbff" colorB="#eefbff" speed={10.5} />
    </group>
  )
}

function MirtazapineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.82
  const atomDefs = [
    // PubChem CID 4205, 2D heavy-atom coordinates centered from the compound record.
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [-0.1696 * scale, -0.7951 * scale, 0] },
    { key: 'n2', element: 'N', scale: ATOM_SCALES.N, position: [-1.8703 * scale, -1.974 * scale, 0] },
    { key: 'n3', element: 'N', scale: ATOM_SCALES.N, position: [1.4839 * scale, -1.0814 * scale, 0] },
    { key: 'c4', element: 'C', scale: ATOM_SCALES.C, position: [-1.0706 * scale, -0.3612 * scale, 0] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [-1.9402 * scale, -0.9347 * scale, 0] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [-0.0758 * scale, -1.8325 * scale, 0] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [-0.9319 * scale, -2.4259 * scale, 0] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [-1.2931 * scale, 0.6137 * scale, 0] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [0.7313 * scale, -0.3612 * scale, 0] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [-0.6696 * scale, 1.3955 * scale, 0] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [0.3304 * scale, 1.3955 * scale, 0] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [0.9539 * scale, 0.6137 * scale, 0] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [-2.6987 * scale, -2.5341 * scale, 0] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [-2.3254 * scale, 0.753 * scale, 0] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [-1.0352 * scale, 2.3709 * scale, 0] },
    { key: 'c16', element: 'C', scale: ATOM_SCALES.C, position: [1.9444 * scale, 0.936 * scale, 0] },
    { key: 'c17', element: 'C', scale: ATOM_SCALES.C, position: [-2.7134 * scale, 1.7197 * scale, 0] },
    { key: 'c18', element: 'C', scale: ATOM_SCALES.C, position: [-2.0639 * scale, 2.5341 * scale, 0] },
    { key: 'c19', element: 'C', scale: ATOM_SCALES.C, position: [2.7134 * scale, 0.2334 * scale, 0] },
    { key: 'c20', element: 'C', scale: ATOM_SCALES.C, position: [2.4816 * scale, -0.7821 * scale, 0] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const leftRingKeys = ['c8', 'c10', 'c15', 'c18', 'c17', 'c14']
  const rightRingKeys = ['c9', 'c12', 'c16', 'c19', 'c20', 'n3']
  const leftRingPoints = leftRingKeys.map((key) => atoms[key])
  const rightRingPoints = rightRingKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
  }

  const bondDefs = [
    ['n1', 'c4'],
    ['n1', 'c6'],
    ['n1', 'c9'],
    ['n2', 'c5'],
    ['n2', 'c7'],
    ['n2', 'c13'],
    ['n3', 'c9'],
    ['n3', 'c20'],
    ['c4', 'c5'],
    ['c4', 'c8'],
    ['c6', 'c7'],
    ['c8', 'c10'],
    ['c8', 'c14'],
    ['c9', 'c12'],
    ['c10', 'c11'],
    ['c10', 'c15'],
    ['c11', 'c12'],
    ['c12', 'c16'],
    ['c14', 'c17'],
    ['c15', 'c18'],
    ['c16', 'c19'],
    ['c17', 'c18'],
    ['c19', 'c20'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.2 + t * 0.078
    moleculeRef.current.rotation.x = 0.22 + Math.sin(t * 0.17) * 0.04
    moleculeRef.current.rotation.z = -0.14 + Math.sin(t * 0.12) * 0.02
    moleculeRef.current.position.y = Math.sin(t * 0.34) * 0.05
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
        .filter(([startKey, endKey]) => (
          !leftRingKeys.includes(startKey) || !leftRingKeys.includes(endKey)
        ) && (
          !rightRingKeys.includes(startKey) || !rightRingKeys.includes(endKey)
        ))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 6 ? '#8fd4ff' : '#a7ddff'}
            colorB={index < 6 ? '#c9edff' : '#e6f7ff'}
            speed={8.3 + (index % 5) * 0.42}
            phase={index * 0.4}
            spread={index < 4 ? 0.08 : 0.07}
            lineScale={index < 4 ? 0.27 : 0.23}
          />
        ))}

      <AromaticRingPair ringPoints={leftRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.8} />
      <AromaticRingPair ringPoints={leftRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={11} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#9edbff" colorB="#e6f7ff" speed={11.3} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.5} />
    </group>
  )
}

function QuetiapineMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.58
  const atomDefs = [
    // PubChem CID 5002, 2D heavy-atom coordinates centered from the compound record.
    { key: 's1', element: 'S', scale: ATOM_SCALES.S, position: [0 * scale, -4.8944 * scale, 0] },
    { key: 'o1', element: 'O', scale: ATOM_SCALES.O, position: [-2.106 * scale, 2.6274 * scale, 0] },
    { key: 'o2', element: 'O', scale: ATOM_SCALES.O, position: [-1.4133 * scale, 5.1808 * scale, 0] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [-1.8016 * scale, -0.0009 * scale, 0] },
    { key: 'n2', element: 'N', scale: ATOM_SCALES.N, position: [-0.9339 * scale, -1.8028 * scale, 0] },
    { key: 'n3', element: 'N', scale: ATOM_SCALES.N, position: [0.5 * scale, -2.7038 * scale, 0] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [-2.3649 * scale, -0.8271 * scale, 0] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [-0.8044 * scale, -0.0756 * scale, 0] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [-1.9311 * scale, -1.728 * scale, 0] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [-0.3705 * scale, -0.9766 * scale, 0] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [-2.2355 * scale, 0.9001 * scale, 0] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [-0.5 * scale, -2.7038 * scale, 0] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [-1.6722 * scale, 1.7264 * scale, 0] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [-1.1235 * scale, -3.4855 * scale, 0] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [-0.901 * scale, -4.4605 * scale, 0] },
    { key: 'c16', element: 'C', scale: ATOM_SCALES.C, position: [-2.114 * scale, -3.1632 * scale, 0] },
    { key: 'c17', element: 'C', scale: ATOM_SCALES.C, position: [1.1235 * scale, -3.4855 * scale, 0] },
    { key: 'c18', element: 'C', scale: ATOM_SCALES.C, position: [0.901 * scale, -4.4605 * scale, 0] },
    { key: 'c19', element: 'C', scale: ATOM_SCALES.C, position: [-1.6535 * scale, -5.1807 * scale, 0] },
    { key: 'c20', element: 'C', scale: ATOM_SCALES.C, position: [-1.5427 * scale, 3.4536 * scale, 0] },
    { key: 'c21', element: 'C', scale: ATOM_SCALES.C, position: [-2.883 * scale, -3.8659 * scale, 0] },
    { key: 'c22', element: 'C', scale: ATOM_SCALES.C, position: [-2.6512 * scale, -4.8814 * scale, 0] },
    { key: 'c23', element: 'C', scale: ATOM_SCALES.C, position: [2.114 * scale, -3.1632 * scale, 0] },
    { key: 'c24', element: 'C', scale: ATOM_SCALES.C, position: [1.6535 * scale, -5.1807 * scale, 0] },
    { key: 'c25', element: 'C', scale: ATOM_SCALES.C, position: [-1.9766 * scale, 4.3546 * scale, 0] },
    { key: 'c26', element: 'C', scale: ATOM_SCALES.C, position: [2.883 * scale, -3.8659 * scale, 0] },
    { key: 'c27', element: 'C', scale: ATOM_SCALES.C, position: [2.6512 * scale, -4.8814 * scale, 0] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const leftRingKeys = ['c14', 'c15', 'c19', 'c22', 'c21', 'c16']
  const rightRingKeys = ['c17', 'c18', 'c24', 'c27', 'c26', 'c23']
  const leftRingPoints = leftRingKeys.map((key) => atoms[key])
  const rightRingPoints = rightRingKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
    S: { color: '#c8a24f', emissive: '#7e5f1d', emissiveIntensity: 1.3 },
  }

  const bondDefs = [
    ['s1', 'c15'],
    ['s1', 'c18'],
    ['o1', 'c13'],
    ['o1', 'c20'],
    ['o2', 'c25'],
    ['n1', 'c7'],
    ['n1', 'c8'],
    ['n1', 'c11'],
    ['n2', 'c9'],
    ['n2', 'c10'],
    ['n2', 'c12'],
    ['n3', 'c12'],
    ['n3', 'c17'],
    ['c7', 'c9'],
    ['c8', 'c10'],
    ['c11', 'c13'],
    ['c12', 'c14'],
    ['c14', 'c15'],
    ['c14', 'c16'],
    ['c15', 'c19'],
    ['c16', 'c21'],
    ['c17', 'c18'],
    ['c17', 'c23'],
    ['c18', 'c24'],
    ['c19', 'c22'],
    ['c20', 'c25'],
    ['c21', 'c22'],
    ['c23', 'c26'],
    ['c24', 'c27'],
    ['c26', 'c27'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = -0.12 + t * 0.074
    moleculeRef.current.rotation.x = 0.26 + Math.sin(t * 0.16) * 0.04
    moleculeRef.current.rotation.z = 0.18 + Math.sin(t * 0.12) * 0.02
    moleculeRef.current.position.y = Math.sin(t * 0.34) * 0.05
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
        .filter(([startKey, endKey]) => (
          !leftRingKeys.includes(startKey) || !leftRingKeys.includes(endKey)
        ) && (
          !rightRingKeys.includes(startKey) || !rightRingKeys.includes(endKey)
        ))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 8 ? '#8fd4ff' : '#a7ddff'}
            colorB={index < 8 ? '#c9edff' : '#e1f6ff'}
            speed={8.2 + (index % 5) * 0.44}
            phase={index * 0.37}
            spread={index < 5 ? 0.08 : 0.07}
            lineScale={index < 5 ? 0.27 : 0.23}
          />
        ))}

      <AromaticRingPair ringPoints={leftRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.7} />
      <AromaticRingPair ringPoints={leftRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.9} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#8fd4ff" colorB="#d4f1ff" speed={11.4} />
      <AromaticRingPair ringPoints={rightRingPoints} colorA="#7fc3ff" colorB="#c7ebff" speed={10.6} />
    </group>
  )
}

function LSDMolecule() {
  const moleculeRef = useRef(null)
  const scale = 0.74
  const atomDefs = [
    // PubChem CID 5761, 2D heavy-atom coordinates centered from the compound record.
    { key: 'o1', element: 'O', scale: ATOM_SCALES.O, position: [-2.4942 * scale, 0.8021 * scale, 0] },
    { key: 'n1', element: 'N', scale: ATOM_SCALES.N, position: [1.0379 * scale, 0.8019 * scale, 0] },
    { key: 'n2', element: 'N', scale: ATOM_SCALES.N, position: [2.0259 * scale, -3.3883 * scale, 0] },
    { key: 'n3', element: 'N', scale: ATOM_SCALES.N, position: [-1.634 * scale, 2.3055 * scale, 0] },
    { key: 'c5', element: 'C', scale: ATOM_SCALES.C, position: [1.0219 * scale, -0.2396 * scale, 0] },
    { key: 'c6', element: 'C', scale: ATOM_SCALES.C, position: [0.1558 * scale, -0.7395 * scale, 0] },
    { key: 'c7', element: 'C', scale: ATOM_SCALES.C, position: [1.8879 * scale, -0.7395 * scale, 0] },
    { key: 'c8', element: 'C', scale: ATOM_SCALES.C, position: [-0.7622 * scale, 0.8089 * scale, 0] },
    { key: 'c9', element: 'C', scale: ATOM_SCALES.C, position: [0.1399 * scale, 1.3297 * scale, 0] },
    { key: 'c10', element: 'C', scale: ATOM_SCALES.C, position: [1.8879 * scale, -1.7396 * scale, 0] },
    { key: 'c11', element: 'C', scale: ATOM_SCALES.C, position: [0.1558 * scale, -1.7396 * scale, 0] },
    { key: 'c12', element: 'C', scale: ATOM_SCALES.C, position: [1.0219 * scale, -2.2395 * scale, 0] },
    { key: 'c13', element: 'C', scale: ATOM_SCALES.C, position: [-0.7542 * scale, -0.2327 * scale, 0] },
    { key: 'c14', element: 'C', scale: ATOM_SCALES.C, position: [1.0379 * scale, -3.2811 * scale, 0] },
    { key: 'c15', element: 'C', scale: ATOM_SCALES.C, position: [1.9097 * scale, 1.2919 * scale, 0] },
    { key: 'c16', element: 'C', scale: ATOM_SCALES.C, position: [-1.6301 * scale, 1.3056 * scale, 0] },
    { key: 'c17', element: 'C', scale: ATOM_SCALES.C, position: [2.5058 * scale, -2.5179 * scale, 0] },
    { key: 'c18', element: 'C', scale: ATOM_SCALES.C, position: [-0.7542 * scale, -2.2464 * scale, 0] },
    { key: 'c19', element: 'C', scale: ATOM_SCALES.C, position: [0.1399 * scale, -3.8089 * scale, 0] },
    { key: 'c20', element: 'C', scale: ATOM_SCALES.C, position: [-0.7622 * scale, -3.288 * scale, 0] },
    { key: 'c21', element: 'C', scale: ATOM_SCALES.C, position: [-2.5019 * scale, 2.8021 * scale, 0] },
    { key: 'c22', element: 'C', scale: ATOM_SCALES.C, position: [-0.7699 * scale, 2.8089 * scale, 0] },
    { key: 'c23', element: 'C', scale: ATOM_SCALES.C, position: [-2.5058 * scale, 3.8021 * scale, 0] },
    { key: 'c24', element: 'C', scale: ATOM_SCALES.C, position: [-0.7738 * scale, 3.8089 * scale, 0] },
  ]
  const atoms = Object.fromEntries(atomDefs.map(({ key, position }) => [key, position]))
  const benzeneRingKeys = ['c11', 'c12', 'c14', 'c19', 'c20', 'c18']
  const indoleRingKeys = ['c10', 'c12', 'c14', 'n2', 'c17']
  const benzeneRingPoints = benzeneRingKeys.map((key) => atoms[key])
  const indoleRingPoints = indoleRingKeys.map((key) => atoms[key])

  const atomStyle = {
    C: { color: '#294866', emissive: '#1d3550', emissiveIntensity: 1.55 },
    N: { color: '#c06aa6', emissive: '#7c3d67', emissiveIntensity: 1.4 },
    O: { color: '#b44646', emissive: '#7a1f1f', emissiveIntensity: 1.25 },
  }

  const bondDefs = [
    ['o1', 'c16'],
    ['n1', 'c5'],
    ['n1', 'c9'],
    ['n1', 'c15'],
    ['n2', 'c14'],
    ['n2', 'c17'],
    ['n3', 'c16'],
    ['n3', 'c21'],
    ['n3', 'c22'],
    ['c5', 'c6'],
    ['c5', 'c7'],
    ['c6', 'c11'],
    ['c6', 'c13'],
    ['c7', 'c10'],
    ['c8', 'c9'],
    ['c8', 'c13'],
    ['c8', 'c16'],
    ['c10', 'c12'],
    ['c10', 'c17'],
    ['c11', 'c12'],
    ['c11', 'c18'],
    ['c12', 'c14'],
    ['c14', 'c19'],
    ['c18', 'c20'],
    ['c19', 'c20'],
    ['c21', 'c23'],
    ['c22', 'c24'],
  ]

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = 0.16 + t * 0.078
    moleculeRef.current.rotation.x = 0.28 + Math.sin(t * 0.16) * 0.04
    moleculeRef.current.rotation.z = -0.18 + Math.sin(t * 0.12) * 0.022
    moleculeRef.current.position.y = Math.sin(t * 0.36) * 0.05
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
        .filter(([startKey, endKey]) => (
          !benzeneRingKeys.includes(startKey) || !benzeneRingKeys.includes(endKey)
        ) && (
          !indoleRingKeys.includes(startKey) || !indoleRingKeys.includes(endKey)
        ))
        .map(([startKey, endKey], index) => (
          <BondElectronPair
            key={`${startKey}-${endKey}`}
            start={atoms[startKey]}
            end={atoms[endKey]}
            colorA={index < 8 ? '#8fd4ff' : '#a7ddff'}
            colorB={index < 8 ? '#c9edff' : '#e1f6ff'}
            speed={8.1 + (index % 5) * 0.42}
            phase={index * 0.36}
            spread={index < 6 ? 0.078 : 0.068}
            lineScale={index < 6 ? 0.26 : 0.22}
          />
        ))}

      <AromaticRingPair
        ringPoints={benzeneRingPoints}
        colorA="#8fd4ff"
        colorB="#d4f1ff"
        speed={11.6}
      />
      <AromaticRingPair
        ringPoints={benzeneRingPoints}
        colorA="#7fc3ff"
        colorB="#c7ebff"
        speed={10.8}
      />
      <AromaticRingPair
        ringPoints={indoleRingPoints}
        colorA="#9edbff"
        colorB="#e6f7ff"
        speed={10.9}
      />
    </group>
  )
}

function BuckminsterfullereneMolecule() {
  const moleculeRef = useRef(null)
  const atomPositions = BUCKMINSTERFULLERENE.atomPositions
  const bondDefs = BUCKMINSTERFULLERENE.bonds

  useFrame((state) => {
    const t = state.clock.getElapsedTime()

    moleculeRef.current.rotation.y = 0.18 + t * 0.1
    moleculeRef.current.rotation.x = 0.42 + Math.sin(t * 0.22) * 0.08
    moleculeRef.current.rotation.z = Math.sin(t * 0.17) * 0.04
    moleculeRef.current.position.y = Math.sin(t * 0.36) * 0.05
  })

  return (
    <group ref={moleculeRef}>
      {bondDefs.map(([startIndex, endIndex]) => (
        <StructuralBond
          key={`structure-${startIndex}-${endIndex}`}
          start={atomPositions[startIndex]}
          end={atomPositions[endIndex]}
          color="#87d0ff"
          opacity={0.38}
        />
      ))}

      {bondDefs
        .map(([startIndex, endIndex], index) => (
          <BondElectronPair
            key={`electron-${startIndex}-${endIndex}`}
            start={atomPositions[startIndex]}
            end={atomPositions[endIndex]}
            colorA="#8fd4ff"
            colorB="#d8f4ff"
            speed={7.8 + (index % 6) * 0.35}
            phase={index * 0.29}
            spread={0.055}
            lineScale={0.21}
            lightIntensity={0}
          />
        ))}

      {atomPositions.map((position, index) => (
        <Nucleus
          key={`c60-${index}`}
          position={position}
          scale={ATOM_SCALES.C * 0.78}
          color="#2e516f"
          emissive="#1b3550"
          emissiveIntensity={1.35}
        />
      ))}
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

function AtomXrayController({ enabled, targetRef }) {
  const controller = useMemo(() => createXrayMaterialController(), [])

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    if (enabled) {
      controller.apply(target)
      return () => controller.restore(target)
    }

    controller.restore(target)

    return undefined
  }, [controller, enabled, targetRef])

  useFrame((state) => {
    if (enabled) controller.update(state.clock.getElapsedTime())
  })

  return null
}

function AtomSceneEffects({ chromaticAberrationEnabled, targetRef, xrayMode }) {
  const chromaticOffset = useMemo(
    () => new THREE.Vector2(CHROMATIC_ABERRATION_OFFSET, CHROMATIC_ABERRATION_OFFSET),
    [],
  )

  useFrame((state) => {
    if (!chromaticAberrationEnabled) return

    const oscillation = 0.75 + 0.25 * Math.sin(state.clock.getElapsedTime() * CHROMATIC_OSCILLATION_SPEED)
    chromaticOffset.set(
      CHROMATIC_ABERRATION_OFFSET * oscillation,
      CHROMATIC_ABERRATION_OFFSET * oscillation,
    )
  })

  return (
    <>
      <AtomXrayController enabled={xrayMode} targetRef={targetRef} />
      <EffectComposer>
        <Bloom
          mipmapBlur
          intensity={0.72}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.26}
          radius={0.46}
        />
        {chromaticAberrationEnabled ? (
          <ChromaticAberration
            offset={chromaticOffset}
            radialModulation
            modulationOffset={0.15}
          />
        ) : null}
      </EffectComposer>
    </>
  )
}

function AtomScene({ chromaticAberrationEnabled, visualization, xrayMode }) {
  const moleculeRef = useRef(null)

  return (
    <>
      <fog attach="fog" args={['#040913', 10, 20]} />
      <ambientLight intensity={0.36} />
      <hemisphereLight args={['#d2ecff', '#071018', 0.92]} />
      <directionalLight position={[4, 4, 6]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-4, -2, 3]} intensity={0.5} color="#4da3ff" />
      <pointLight position={[0, 0, -5]} intensity={10} distance={18} color="#13304f" />
      <group ref={moleculeRef}>
        {visualization === 1 ? (
          <Atom />
        ) : visualization === 2 ? (
          <OxygenMolecule />
        ) : visualization === 5 ? (
          <EpinephrineMolecule />
        ) : visualization === 6 ? (
          <BuckminsterfullereneMolecule />
        ) : visualization === 7 ? (
          <CapsaicinMolecule />
        ) : visualization === 8 ? (
          <MirtazapineMolecule />
        ) : visualization === 9 ? (
          <QuetiapineMolecule />
        ) : visualization === 10 ? (
          <LSDMolecule />
        ) : visualization === 4 ? (
          <CaffeineMolecule />
        ) : (
          <EthyleneMolecule />
        )}
      </group>
      <AtomSceneEffects
        chromaticAberrationEnabled={chromaticAberrationEnabled}
        targetRef={moleculeRef}
        xrayMode={xrayMode}
      />
    </>
  )
}

export default function App() {
  const [visualization, setVisualization] = useState(1)
  const [chromaticAberrationEnabled, setChromaticAberrationEnabled] = useState(false)
  const [xrayMode, setXrayMode] = useState(false)
  const chromaticAberrationEnabledRef = useRef(false)
  const xrayModeRef = useRef(false)
  const restoreChromaticAfterXrayRef = useRef(false)

  useEffect(() => {
    chromaticAberrationEnabledRef.current = chromaticAberrationEnabled
  }, [chromaticAberrationEnabled])

  useEffect(() => {
    xrayModeRef.current = xrayMode
  }, [xrayMode])

  useEffect(() => {
    const toggleChromaticAberration = () => {
      setChromaticAberrationEnabled((enabled) => {
        const nextValue = !enabled
        chromaticAberrationEnabledRef.current = nextValue
        return nextValue
      })
    }

    const toggleXrayMode = () => {
      if (xrayModeRef.current) {
        xrayModeRef.current = false
        setXrayMode(false)

        if (restoreChromaticAfterXrayRef.current) {
          restoreChromaticAfterXrayRef.current = false
          chromaticAberrationEnabledRef.current = true
          setChromaticAberrationEnabled(true)
        }

        return
      }

      restoreChromaticAfterXrayRef.current = chromaticAberrationEnabledRef.current

      if (chromaticAberrationEnabledRef.current) {
        chromaticAberrationEnabledRef.current = false
        setChromaticAberrationEnabled(false)
      }

      xrayModeRef.current = true
      setXrayMode(true)
    }

    const onKeyDown = (event) => {
      if (event.repeat || isEditableTarget(event.target)) return

      if (event.key === 'c' || event.key === 'C') {
        toggleChromaticAberration()
        return
      }

      if (event.key === 'x' || event.key === 'X') {
        toggleXrayMode()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const label =
    visualization === 3
      ? 'ethylene'
      : visualization === 4
        ? 'caffeine'
        : visualization === 5
          ? 'epinephrine'
          : visualization === 6
            ? 'buckminsterfullerene'
            : visualization === 7
              ? 'capsaicin'
              : visualization === 8
                ? 'mirtazapine'
                : visualization === 9
                  ? 'quetiapine'
                  : visualization === 10
                    ? 'lsd'
                : ''

  return (
    <main className="app-shell">
      <Canvas camera={{ position: [0, 0.2, 8.5], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={['#040913']} />
        <AtomScene
          chromaticAberrationEnabled={chromaticAberrationEnabled}
          visualization={visualization}
          xrayMode={xrayMode}
        />
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
        <button
          type="button"
          className={`visualization-button ${visualization === 6 ? 'is-active' : ''}`}
          onClick={() => setVisualization(6)}
        >
          6
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 7 ? 'is-active' : ''}`}
          onClick={() => setVisualization(7)}
        >
          7
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 8 ? 'is-active' : ''}`}
          onClick={() => setVisualization(8)}
        >
          8
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 9 ? 'is-active' : ''}`}
          onClick={() => setVisualization(9)}
        >
          9
        </button>
        <button
          type="button"
          className={`visualization-button ${visualization === 10 ? 'is-active' : ''}`}
          onClick={() => setVisualization(10)}
        >
          10
        </button>
      </div>
    </main>
  )
}
