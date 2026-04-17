import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { isEditableTarget } from '../../../../src/shared/special-effects/index.ts'
import { XRAY_DEFAULTS } from './config'
import { ATOM_SCALES } from './elements'
import { useAtomRenderMode } from './render-mode'
import { useStandingWave } from './standing-wave'

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
const LOCAL_BOND_AXIS = new THREE.Vector3(1, 0, 0)
const NUCLEUS_GEOMETRY = new THREE.SphereGeometry(1, 16, 16)
const NUCLEUS_MATERIAL_CACHE = new Map()
const GPU_TRAIL_VERTEX_SHADER = `
  attribute float trailProgress;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uPhase;
  uniform float uTrailLag;
  uniform float uPointSize;
  uniform float uOpacity;
  uniform float uMotionProfile;
  uniform float uSign;

  uniform vec3 uMidpoint;
  uniform vec3 uAxis;
  uniform vec3 uNormalA;
  uniform vec3 uNormalB;
  uniform float uLength;
  uniform float uLineScale;
  uniform float uSpread;

  uniform float uStandingN;
  uniform float uStandingOmega;
  uniform float uStandingAmplitude;

  varying float vAlpha;

  vec3 computeBondTrailPosition(float t) {
    float along = sin(t * 1.7) * uLength * uLineScale;
    float offsetA = sin(t * 3.1) * uSpread;
    float offsetB = cos(t * 2.6) * uSpread * 0.65;

    return uMidpoint
      + (uAxis * along)
      + (uNormalA * offsetA)
      + (uNormalB * offsetB);
  }

  vec3 computeLocalTrailPosition(float t) {
    if (uMotionProfile < 0.5) {
      return vec3(
        sin(t * 1.8) * 0.86 + sin(t * 3.1) * 0.12,
        sin(t * 2.4) * 0.14 + cos(t * 4.2) * 0.03,
        cos(t * 2.1) * 0.12 + sin(t * 3.6) * 0.03
      );
    }

    return vec3(
      sin(t * 1.9) * 0.92 + sin(t * 3.2) * 0.14,
      uSign * (0.58 + abs(sin(t * 1.4)) * 0.28),
      cos(t * 2.3) * 0.16 + sin(t * 4.1) * 0.04
    );
  }

  void main() {
    float t = (uTime * uSpeed) + uPhase - (trailProgress * uTrailLag);
    vec3 position = uMotionProfile < 2.0
      ? computeLocalTrailPosition(t)
      : computeBondTrailPosition(t);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = mix(uPointSize * 1.2, uPointSize * 0.28, trailProgress);
    vAlpha = pow(1.0 - trailProgress, 1.35) * uOpacity;

    if (uStandingN > 0.5 && uMotionProfile >= 2.0) {
      float along = sin(t * 1.7) * uLength * uLineScale;
      float bondParam = clamp(along / (uLength * uLineScale) * 0.5 + 0.5, 0.0, 1.0);
      float envelope = sin(uStandingN * 3.14159265 * bondParam);
      float breath = 0.5 + 0.5 * sin(uTime * uStandingOmega);
      vAlpha *= 1.0 - uStandingAmplitude * envelope * envelope * breath;
    }
  }
`
const GPU_TRAIL_FRAGMENT_SHADER = `
  uniform vec3 uColor;

  varying float vAlpha;

  void main() {
    vec2 centered = gl_PointCoord - vec2(0.5);
    float distanceFromCenter = length(centered);
    float falloff = smoothstep(0.5, 0.0, distanceFromCenter);
    float core = smoothstep(0.18, 0.0, distanceFromCenter);
    float alpha = vAlpha * (falloff * 0.65 + core * 0.35);

    if (alpha <= 0.001) discard;

    gl_FragColor = vec4(uColor, alpha);
  }
`

function getNucleusMaterialKey({
  color,
  emissive,
  emissiveIntensity,
  roughness,
  metalness,
  clearcoat,
  clearcoatRoughness,
  reflectivity,
  sheen,
}) {
  return [
    color,
    emissive,
    emissiveIntensity,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    reflectivity,
    sheen,
  ].join('|')
}

function createNucleusMaterial({
  color,
  emissive,
  emissiveIntensity,
  roughness,
  metalness,
  clearcoat,
  clearcoatRoughness,
  reflectivity,
  sheen,
}) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    reflectivity,
    sheen,
    sheenColor: '#d9f3ff',
    specularIntensity: 1,
    specularColor: '#f4fbff',
  })

  material.toneMapped = false
  return material
}

function acquireNucleusMaterial(materialOptions) {
  const key = getNucleusMaterialKey(materialOptions)
  const cached = NUCLEUS_MATERIAL_CACHE.get(key)

  if (cached) {
    cached.refCount += 1
    return cached.material
  }

  const material = createNucleusMaterial(materialOptions)
  NUCLEUS_MATERIAL_CACHE.set(key, { material, refCount: 1 })
  return material
}

function releaseNucleusMaterial(materialOptions) {
  const key = getNucleusMaterialKey(materialOptions)
  const cached = NUCLEUS_MATERIAL_CACHE.get(key)

  if (!cached) return

  cached.refCount -= 1

  if (cached.refCount > 0) return

  cached.material.dispose()
  NUCLEUS_MATERIAL_CACHE.delete(key)
}

function normalizeXrayConfig(config = {}) {
  return {
    rimColor: config.rimColor ?? XRAY_DEFAULTS.rimColor,
    rimStrength: config.rimStrength ?? XRAY_DEFAULTS.rimStrength,
    rimPower: config.rimPower ?? XRAY_DEFAULTS.rimPower,
  }
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

function samplePOrbitalInto(positions, stride, scale = ORBITAL_SCALE) {
  let x = 0
  let y = 0
  let z = 0
  let len = 0

  do {
    x = Math.random() * 2 - 1
    y = Math.random() * 2 - 1
    z = Math.random() * 2 - 1
    len = Math.sqrt(x * x + y * y + z * z)
  } while (len === 0 || len > 1)

  x /= len
  y /= len
  z /= len

  while (Math.random() > y * y) {
    do {
      x = Math.random() * 2 - 1
      y = Math.random() * 2 - 1
      z = Math.random() * 2 - 1
      len = Math.sqrt(x * x + y * y + z * z)
    } while (len === 0 || len > 1)

    x /= len
    y /= len
    z /= len
  }

  const radius = sampleGamma5(scale)
  positions[stride] = x * radius
  positions[stride + 1] = y * radius
  positions[stride + 2] = z * radius
}

function createCloudPositions(count = 1200) {
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i += 1) {
    samplePOrbitalInto(positions, i * 3)
  }

  return positions
}

function createTrailBuffer(sampleCount, initialX = 0, initialY = 0, initialZ = 0) {
  const positions = new Float32Array(sampleCount * 3)

  for (let i = 0; i < sampleCount; i += 1) {
    const stride = i * 3
    positions[stride] = initialX
    positions[stride + 1] = initialY
    positions[stride + 2] = initialZ
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return { geometry, positions }
}

function createGpuTrailGeometry(sampleCount) {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(sampleCount * 3)
  const trailProgress = new Float32Array(sampleCount)

  for (let i = 0; i < sampleCount; i += 1) {
    trailProgress[i] = sampleCount <= 1 ? 0 : i / (sampleCount - 1)
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('trailProgress', new THREE.BufferAttribute(trailProgress, 1))
  return geometry
}

function advanceTrailBuffer(trailBuffer, x, y, z) {
  const { geometry, positions } = trailBuffer

  positions.copyWithin(3, 0, positions.length - 3)
  positions[0] = x
  positions[1] = y
  positions[2] = z
  geometry.attributes.position.needsUpdate = true
}

function useTrailBuffer(sampleCount, initialX = 0, initialY = 0, initialZ = 0) {
  const trailBuffer = useMemo(
    () => createTrailBuffer(sampleCount, initialX, initialY, initialZ),
    [sampleCount, initialX, initialY, initialZ],
  )

  useEffect(() => () => {
    trailBuffer.geometry.dispose()
  }, [trailBuffer])

  return trailBuffer
}

function createGpuTrailMaterial({
  color,
  opacity,
  pointSize,
  speed,
  phase,
  trailLag,
  motionProfile,
  sign = 1,
  midpoint = new THREE.Vector3(),
  axis = new THREE.Vector3(1, 0, 0),
  normalA = new THREE.Vector3(0, 1, 0),
  normalB = new THREE.Vector3(0, 0, 1),
  length = 1,
  lineScale = 0.34,
  spread = 0.12,
}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPointSize: { value: pointSize },
      uSpeed: { value: speed },
      uPhase: { value: phase },
      uTrailLag: { value: trailLag },
      uMotionProfile: { value: motionProfile },
      uSign: { value: sign },
      uMidpoint: { value: midpoint.clone() },
      uAxis: { value: axis.clone() },
      uNormalA: { value: normalA.clone() },
      uNormalB: { value: normalB.clone() },
      uLength: { value: length },
      uLineScale: { value: lineScale },
      uSpread: { value: spread },
      uStandingN: { value: 0 },
      uStandingOmega: { value: 0.5 },
      uStandingAmplitude: { value: 0.7 },
    },
    vertexShader: GPU_TRAIL_VERTEX_SHADER,
    fragmentShader: GPU_TRAIL_FRAGMENT_SHADER,
  })
}

function useGpuTrail({
  sampleCount,
  color,
  opacity,
  pointSize,
  speed,
  phase,
  trailLag,
  motionProfile,
  sign = 1,
  midpoint,
  axis,
  normalA,
  normalB,
  length,
  lineScale,
  spread,
}) {
  const standingWave = useStandingWave()
  const geometry = useMemo(
    () => createGpuTrailGeometry(sampleCount),
    [sampleCount],
  )
  const material = useMemo(
    () => createGpuTrailMaterial({
      color,
      opacity,
      pointSize,
      speed,
      phase,
      trailLag,
      motionProfile,
      sign,
      midpoint,
      axis,
      normalA,
      normalB,
      length,
      lineScale,
      spread,
    }),
    [
      axis,
      color,
      length,
      lineScale,
      midpoint,
      motionProfile,
      normalA,
      normalB,
      opacity,
      phase,
      pointSize,
      sampleCount,
      sign,
      speed,
      spread,
      trailLag,
    ],
  )

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime()
    material.uniforms.uStandingN.value = standingWave.standingWaveN
    material.uniforms.uStandingOmega.value = standingWave.standingWaveOmega
    material.uniforms.uStandingAmplitude.value = standingWave.standingWaveAmplitude
  })

  return { geometry, material }
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
  const trailBuffer = useTrailBuffer(28)

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

    advanceTrailBuffer(trailBuffer, px, py, pz)
  })

  return (
    <>
      <line geometry={trailBuffer.geometry}>
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
  const trailBuffer = useTrailBuffer(24)

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
    advanceTrailBuffer(trailBuffer, px, py, pz)
  })

  return (
    <>
      <line geometry={trailBuffer.geometry}>
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

function GpuTrailPoints({ geometry, material }) {
  return <points geometry={geometry} material={material} />
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
      const stride = ((start + i) % 1200) * 3
      samplePOrbitalInto(positions, stride)
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
  const materialOptions = {
    color,
    emissive,
    emissiveIntensity,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness,
    reflectivity,
    sheen,
  }
  const materialKey = getNucleusMaterialKey(materialOptions)
  const material = useMemo(
    () => acquireNucleusMaterial(materialOptions),
    [materialKey],
  )

  useEffect(() => () => releaseNucleusMaterial(materialOptions), [materialKey])

  return (
    <mesh
      dispose={null}
      position={position}
      scale={scale}
      geometry={NUCLEUS_GEOMETRY}
      material={material}
    />
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
  const trail = useGpuTrail({
    sampleCount: 24,
    color,
    opacity: 0.16,
    pointSize: 11,
    speed,
    phase,
    trailLag: 1.9,
    motionProfile: 2,
    midpoint,
    axis,
    normalA,
    normalB,
    length,
    lineScale,
    spread,
  })

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
  })

  return (
    <>
      <GpuTrailPoints geometry={trail.geometry} material={trail.material} />

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
  const { bondLightIntensityScale } = useAtomRenderMode()
  const scaledLightIntensity = lightIntensity * bondLightIntensityScale

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
        lightIntensity={scaledLightIntensity}
      />
      <BondElectron
        start={start}
        end={end}
        color={colorB}
        speed={speed * 0.96}
        phase={phase + Math.PI * 0.78}
        lineScale={lineScale}
        spread={spread * 0.92}
        lightIntensity={scaledLightIntensity}
      />
    </>
  )
}

const AROMATIC_LUT_SIZE = 128

function buildAromaticLUT(ringPoints) {
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

  const positions = new Float32Array(AROMATIC_LUT_SIZE * 3)
  const tangents = new Float32Array(AROMATIC_LUT_SIZE * 3)
  const radials = new Float32Array(AROMATIC_LUT_SIZE * 3)
  const tmpPoint = new THREE.Vector3()
  const tmpTangent = new THREE.Vector3()
  const tmpRadial = new THREE.Vector3()

  for (let i = 0; i < AROMATIC_LUT_SIZE; i += 1) {
    const t = i / AROMATIC_LUT_SIZE
    curve.getPointAt(t, tmpPoint)
    curve.getTangentAt(t, tmpTangent).normalize()
    tmpRadial.copy(tmpPoint).sub(center).normalize()
    const s = i * 3
    positions[s] = tmpPoint.x
    positions[s + 1] = tmpPoint.y
    positions[s + 2] = tmpPoint.z
    tangents[s] = tmpTangent.x
    tangents[s + 1] = tmpTangent.y
    tangents[s + 2] = tmpTangent.z
    radials[s] = tmpRadial.x
    radials[s + 1] = tmpRadial.y
    radials[s + 2] = tmpRadial.z
  }

  return { positions, tangents, radials, ringNormal }
}

function lerpLUT(out, lut, progress) {
  const fIndex = progress * AROMATIC_LUT_SIZE
  const i0 = Math.floor(fIndex) % AROMATIC_LUT_SIZE
  const i1 = (i0 + 1) % AROMATIC_LUT_SIZE
  const frac = fIndex - Math.floor(fIndex)
  const s0 = i0 * 3
  const s1 = i1 * 3
  out.x = lut[s0] + (lut[s1] - lut[s0]) * frac
  out.y = lut[s0 + 1] + (lut[s1 + 1] - lut[s0 + 1]) * frac
  out.z = lut[s0 + 2] + (lut[s1 + 2] - lut[s0 + 2]) * frac
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
  const trailBuffer = useTrailBuffer(36)
  const lut = useMemo(() => buildAromaticLUT(ringPoints), [ringPoints])
  const basePointRef = useRef(new THREE.Vector3())
  const tangentRef = useRef(new THREE.Vector3())
  const radialRef = useRef(new THREE.Vector3())
  const positionRef = useRef(new THREE.Vector3())

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    const progress = ((t * speed) / 8 + phase) % 1
    lerpLUT(basePointRef.current, lut.positions, progress)
    lerpLUT(tangentRef.current, lut.tangents, progress)
    lerpLUT(radialRef.current, lut.radials, progress)

    const hoverScale = side * (lift + Math.sin(t * 4.2 + phase * Math.PI * 2) * lift * 0.18)
    const tangentScale = Math.sin(t * 3.3 + phase * Math.PI * 2) * 0.02
    const position = positionRef.current
    position.x = basePointRef.current.x + radialRef.current.x * 0.07 + lut.ringNormal.x * hoverScale + tangentRef.current.x * tangentScale
    position.y = basePointRef.current.y + radialRef.current.y * 0.07 + lut.ringNormal.y * hoverScale + tangentRef.current.y * tangentScale
    position.z = basePointRef.current.z + radialRef.current.z * 0.07 + lut.ringNormal.z * hoverScale + tangentRef.current.z * tangentScale

    electronRef.current.position.copy(position)
    advanceTrailBuffer(trailBuffer, position.x, position.y, position.z)
  })

  return (
    <>
      <line geometry={trailBuffer.geometry}>
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
  lightIntensity = 10,
}) {
  const { bondLightIntensityScale } = useAtomRenderMode()
  const scaledLightIntensity = lightIntensity * bondLightIntensityScale

  return (
    <>
      <AromaticRingElectron
        ringPoints={ringPoints}
        color={colorA}
        speed={speed}
        phase={0}
        side={1}
        lightIntensity={scaledLightIntensity}
      />
      <AromaticRingElectron
        ringPoints={ringPoints}
        color={colorB}
        speed={speed * 1.06}
        phase={0.5}
        side={-1}
        lightIntensity={scaledLightIntensity}
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
  const positionRef = useRef(new THREE.Vector3())
  const trail = useGpuTrail({
    sampleCount: 26,
    color,
    opacity: 0.18,
    pointSize: 11,
    speed,
    phase,
    trailLag: 1.85,
    motionProfile: 1,
    sign,
  })

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + phase
    const position = positionRef.current
    position.set(
      Math.sin(t * 1.9) * 0.92 + Math.sin(t * 3.2) * 0.14,
      sign * (0.58 + Math.abs(Math.sin(t * 1.4)) * 0.28),
      Math.cos(t * 2.3) * 0.16 + Math.sin(t * 4.1) * 0.04,
    )

    electronRef.current.position.copy(position)
  })

  return (
    <>
      <GpuTrailPoints geometry={trail.geometry} material={trail.material} />

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
  advanceTrailBuffer,
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
  createTrailBuffer,
  useTrailBuffer,
}
