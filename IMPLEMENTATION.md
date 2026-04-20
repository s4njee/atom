# Theme Nucleus Visualizations — Implementation Chain

This document traces the exact code path for adding a new visual theme to the Atom
visualization. Blueprint is the only theme with a working nucleus override today.
The remaining five themes (Chalkboard, Hologram, Sepia, Circuit Board, Thermal) have
their **shell layer** (CSS + overlay HTML) fully wired but still render the default
`MeshPhysicalMaterial` sphere for the nucleus. This file describes every touch-point
so each nucleus style can be implemented one at a time without missing a step.

See [THEMES.md](THEMES.md) for the visual design spec of each theme.

---

## Current State

| Layer | Blueprint | Chalkboard | Hologram | Sepia | Circuit | Thermal |
|-------|-----------|------------|----------|-------|---------|---------|
| CSS shell class | ✅ `is-blueprint` | ✅ `is-chalkboard` | ✅ `is-hologram` | ✅ `is-sepia` | ✅ `is-circuit` | ✅ `is-thermal` |
| Overlay HTML | ✅ compass + stamp | ✅ eraser | ✅ readout | ✅ stamp | ✅ readout | ✅ legend bar |
| Scene overrides (bg/fog) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Theme cycling (`0` key) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GUI dropdown | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Nucleus geometry/material** | ✅ wireframe sphere | ❌ default | ❌ default | ❌ default | ❌ default | ❌ default |
| **Electron visibility** | ✅ hidden | ❌ still shown | ❌ still shown | ❌ still shown | ❌ still shown | ❌ still shown |

---

## File-by-File Implementation Chain

### 1. `src/atom/render-mode.js` — add `nucleusStyle` to context

The render-mode context is the single source of truth that every 3-D component reads.

**Current shape:**
```js
{
  blueprintEnabled: false,
  bondLightIntensityScale: 1,
  cinematicEnabled: false,
  pharmacophoreMap: null,
}
```

**Target shape — add one field:**
```js
{
  blueprintEnabled: false,
  bondLightIntensityScale: 1,
  cinematicEnabled: false,
  nucleusStyle: null,          // null | 'chalk' | 'hologram' | 'sepia' | 'circuit' | 'thermal'
  pharmacophoreMap: null,
}
```

`blueprintEnabled` stays as-is for backward compat — it's checked in many places.
`nucleusStyle` is the new discriminator for the five remaining themes.

---

### 2. `src/atom/scene.jsx` — compute `nucleusStyle` from `themeMode`

The `renderMode` memo in `AtomScene` currently derives `blueprintEnabled` from
`themeMode === 'blueprint'`. Extend it to also set `nucleusStyle`:

```js
const THEME_TO_NUCLEUS_STYLE = {
  chalkboard: 'chalk',
  hologram:   'hologram',
  sepia:      'sepia',
  circuit:    'circuit',
  thermal:    'thermal',
}
```

Inside the `renderMode` useMemo (≈ line 120):
```js
const nucleusStyle = THEME_TO_NUCLEUS_STYLE[themeMode] ?? null

const renderMode = useMemo(() => {
  if (!blueprintMode && !cinematicEnabled && !pharmacophoreMap && !nucleusStyle)
    return DEFAULT_ATOM_RENDER_MODE

  return {
    blueprintEnabled: blueprintMode,
    bondLightIntensityScale: 1,
    cinematicEnabled,
    nucleusStyle,
    pharmacophoreMap,
  }
}, [blueprintMode, cinematicEnabled, nucleusStyle, pharmacophoreMap])
```

No other changes in scene.jsx.

---

### 3. `src/atom/core.jsx` — branch inside `Nucleus`

This is the main work. The `Nucleus` component (≈ line 1000) currently has two paths:
`blueprintEnabled → wireframe sphere` and `default → MeshPhysicalMaterial sphere`.

Add a third path that reads `nucleusStyle` and returns the themed geometry + material.

#### 3a. New module-level geometry constants

```js
const CHALK_GEOMETRY    = new THREE.IcosahedronGeometry(1, 0)
const CIRCUIT_GEOMETRY  = new THREE.CylinderGeometry(1, 1, 0.18, 32)
const SEPIA_GEOMETRY    = new THREE.CircleGeometry(1, 32)
// SphereGeometry reused for hologram and thermal (already NUCLEUS_GEOMETRY)
```

#### 3b. Hologram rim shader (ShaderMaterial)

```glsl
// vertex
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}

// fragment
uniform vec3 uRimColor;
void main() {
  float rim = pow(1.0 - abs(dot(vNormal, vViewDir)), 3.0);
  gl_FragColor = vec4(uRimColor, rim * 0.9);
}
```

Must set `customProgramCacheKey: () => 'atom-hologram-rim'` to avoid recompilation.

#### 3c. Thermal heatmap shader (ShaderMaterial)

Receives `uniform vec3 uAtomColor` derived from atomic number → heatmap LUT.
The heatmap palette maps low atomic numbers to blue, mid to yellow, high to red.

The atomic number is not currently passed to `Nucleus`. It will need to be threaded
through from the molecule definition (each atom def already carries an element symbol;
use `getElementInfo(symbol).atomicNumber` from `elements.js`).

Must set `customProgramCacheKey: () => 'atom-thermal-heatmap'`.

#### 3d. Nucleus component branching

```jsx
function Nucleus({ position, scale, nucleusProps..., atomicNumber }) {
  const { blueprintEnabled, nucleusStyle } = useAtomRenderMode()

  // Blueprint — existing path
  if (blueprintEnabled) { /* wireframe sphere */ }

  // Themed nucleus
  if (nucleusStyle) {
    switch (nucleusStyle) {
      case 'chalk':    return <ChalkNucleus position={position} scale={scale} />
      case 'hologram': return <HologramNucleus position={position} scale={scale} />
      case 'sepia':    return <SepiaNucleus position={position} scale={scale} />
      case 'circuit':  return <CircuitNucleus position={position} scale={scale} />
      case 'thermal':  return <ThermalNucleus position={position} scale={scale} atomicNumber={atomicNumber} />
      default:         break
    }
  }

  // Default — existing MeshPhysicalMaterial path
  return <mesh ... />
}
```

Each sub-component is small — geometry + material + done. Keep them in core.jsx or
split into a `nucleus-styles.jsx` if the file gets unwieldy.

#### Per-theme nucleus specs

| Style | Geometry | Material | Notes |
|-------|----------|----------|-------|
| `chalk` | `IcosahedronGeometry(1, 0)` | `MeshStandardMaterial` white, `roughness: 1, metalness: 0` | Flat-faceted, no shading tricks |
| `hologram` | `SphereGeometry` (reuse `NUCLEUS_GEOMETRY`) | Custom `ShaderMaterial` — rim-only, transparent interior, emissive cyan-green | Needs `customProgramCacheKey` |
| `sepia` | `CircleGeometry(1, 32)` | `meshBasicMaterial` dark brown `#3b2a1a` | Billboard: attach `<Billboard>` from drei or lock rotation manually |
| `circuit` | `CylinderGeometry(1, 1, 0.18, 32)` | `MeshStandardMaterial` gold `#d4a843`, `metalness: 0.9, roughness: 0.25` | Flat disc, oriented toward camera or bond plane |
| `thermal` | `SphereGeometry` (reuse `NUCLEUS_GEOMETRY`) | Custom `ShaderMaterial` — color from atomic-number heatmap | Needs `customProgramCacheKey`, needs `atomicNumber` prop |

---

### 4. `src/atom/core.jsx` — electron visibility

Three components currently check `blueprintEnabled` to hide electrons:

| Component | Location | Current check |
|-----------|----------|---------------|
| `ElectronPair` | ≈ line 870 | `if (blueprintEnabled) return null` |
| `AromaticRingPair` | ≈ line 1310 | `if (blueprintEnabled) return null` |
| `SingleBond` / `DoubleBond` | ≈ line 1440+ | `!blueprintEnabled` guards around `<BondElectronPair>` and `<PiBondPair>` |

For themes that hide electrons (chalk, sepia, circuit), extend the guard:

```js
const { blueprintEnabled, nucleusStyle } = useAtomRenderMode()
const hideElectrons = blueprintEnabled
  || nucleusStyle === 'chalk'
  || nucleusStyle === 'sepia'
  || nucleusStyle === 'circuit'
```

For themes that keep electrons but restyle them (hologram → cyan tint, thermal →
heatmap-matched color), the electron color props would need to be overridden. This
can be done by reading `nucleusStyle` and passing different `color` values down, or
by adding a `themeElectronColor` field to the render-mode context.

---

### 5. `src/atom/core.jsx` — bond line styling (optional)

`StructuralBond` already branches on `blueprintEnabled` to change bond color/opacity.
For themed bonds (e.g. circuit → bright green traces, sepia → dark brown lines),
add a similar branch on `nucleusStyle`:

```js
const bondColor = nucleusStyle === 'circuit' ? '#00ff41'
  : nucleusStyle === 'sepia' ? '#3b2a1a'
  : nucleusStyle === 'chalk' ? '#e8e8e0'
  : blueprintEnabled ? BLUEPRINT_LINE
  : color
```

---

### 6. Prop threading for `atomicNumber` (thermal only)

The thermal nucleus needs the atomic number to pick a heatmap color. The call chain is:

```
molecule definition (atomDefs[])
  → molecule component (e.g. Empagliflozin.jsx)
    → <Nucleus position={...} scale={...} color={...} ... />
```

Each molecule component already knows the element symbol per atom. Add an
`atomicNumber` prop to `<Nucleus>`:

```jsx
<Nucleus
  position={pos}
  scale={scale}
  atomicNumber={getElementInfo(symbol).atomicNumber}
  {...renderStyle}
/>
```

For the `DynamicMolecule` path, `atomDefs` already carry the element symbol, so the
same lookup applies.

When `nucleusStyle !== 'thermal'`, the prop is simply ignored.

---

## Implementation Order

Recommended order, easiest to hardest:

1. **Chalkboard** — geometry swap only, no shader, electrons hidden. Good first pass
   to validate the full `nucleusStyle` plumbing end-to-end.
2. **Circuit Board** — similar to chalkboard (geometry + standard material), just a
   different shape and metallic look.
3. **Sepia** — needs billboarding for the flat circle, but no custom shader.
4. **Hologram** — first custom `ShaderMaterial`, but the rim shader is simple.
5. **Thermal** — custom shader + needs `atomicNumber` prop threading through every
   molecule component and `DynamicMolecule`.

---

## Checklist per theme

- [x] Add `nucleusStyle` to `DEFAULT_ATOM_RENDER_MODE` in `render-mode.js`
- [x] Compute `nucleusStyle` from `themeMode` in `scene.jsx` renderMode memo
- [x] Add geometry constant(s) to top of `core.jsx`
- [x] Add themed nucleus sub-component in `core.jsx`
- [ ] Branch on `nucleusStyle` inside `Nucleus`
- [ ] Update electron visibility guards in `ElectronPair`, `AromaticRingPair`,
      `SingleBond`, `DoubleBond`
- [ ] (If applicable) update bond line color in `StructuralBond`
- [ ] (Thermal only) thread `atomicNumber` prop through molecule components
- [ ] (Shader themes) set `customProgramCacheKey` on any new `ShaderMaterial`
- [ ] Verify with `npm run build` at repo root
- [ ] Visual check: cycle themes with `0` key, confirm nucleus + electrons match spec
