# #14 · Pharmacophore Highlight Mode — Implementation Plan

> Hotkey `p` toggles a mode where functional groups glow in signature colors.
> Everything else dims. The molecule becomes legible as chemistry.

---

## Overview

Three pieces:

1. A **graph pattern matcher** that classifies atoms into functional groups
2. A **color override** in `AtomInstances` that swaps emissive colors per group
3. **Mode toggle plumbing** (hotkey, state, context, GUI, legend)

---

## 1. Functional group classifier — `src/atom/pharmacophore.js` (new)

Pure function. Takes the same `atomDefs` + `bondDefs` shape that both presets and
PubChem molecules use. Returns a `Map<atomKey, { group, color, emissive }>`.

### Algorithm

1. Build an adjacency map from `bondDefs`:
   ```
   adjacency[atomKey] = [{ neighbor, order }]
   ```
2. Build an element lookup from `atomDefs`:
   ```
   elementOf[atomKey] = 'C' | 'N' | 'O' | ...
   ```
3. Classify each atom by element + neighborhood:

| Group | Pattern | Color | Emissive |
|---|---|---|---|
| Amine | N bonded only to C and/or H | `#4a9eff` | `#2a6ecc` |
| Hydroxyl | O bonded to exactly 1 heavy atom (no double bond) | `#3dd6c8` | `#28a89e` |
| Carbonyl | O in a C=O double bond (O has no other heavy-atom bonds) | `#f0a030` | `#c07820` |
| Ether / Ester O | O bonded to 2 C atoms | `#7cb8a0` | `#5a9480` |
| Aromatic ring | Atoms in `aromaticRings[].keys` or bonded via `order: 4` | `#b07aff` | `#8855cc` |
| Halogen | F, Cl, Br, I bonded to exactly 1 atom | `#ff6b8a` | `#cc4466` |
| Unclassified | Everything else | dimmed | dimmed |

4. For the carbonyl C atom: also tag it as carbonyl so the C=O pair glows together.

### Aromatic detection

- **Presets**: use the explicit `aromaticRings[].keys` array.
- **PubChem**: bonds with `order === 4` are aromatic. Walk those to find ring membership.
- **Fallback**: if neither source provides aromatic info, skip aromatic highlighting
  (amines, hydroxyls, carbonyls, halogens still work).

### Signature

```js
/**
 * @param {Array<{ key, element }>} atomDefs
 * @param {Array<{ from, to, order? }>} bondDefs
 * @param {Array<{ keys: string[] }>} [aromaticRings]
 * @returns {Map<string, { group: string, color: string, emissive: string }>}
 */
export function classifyPharmacophore(atomDefs, bondDefs, aromaticRings)
```

~80–100 lines. No external deps.

---

## 2. Color override in `AtomInstances` — modify `helpers.jsx`

`AtomInstances` currently batches atoms by `element|color|emissive|emissiveIntensity`.
In pharmacophore mode the batch key includes the group, so atoms in different groups
get different `meshPhysicalMaterial` instances.

### Changes

Inside the `batches` useMemo:

```js
const pharmacophoreMap = useAtomRenderMode().pharmacophoreMap

atomDefs.forEach(({ key, element, position, scale }) => {
  const pharma = pharmacophoreMap?.get(key)
  const style = pharma
    ? { color: pharma.color, emissive: pharma.emissive, emissiveIntensity: 2.2 }
    : pharmacophoreMap
      ? DIMMED_STYLE   // mode is on but atom is unclassified → dim
      : getAtomRenderStyle(element)  // mode is off → normal

  const batchKey = `${element}|${style.color}|${style.emissive}|${style.emissiveIntensity}`
  // ... rest of batching unchanged
})
```

`DIMMED_STYLE` is a frozen object:
```js
const DIMMED_STYLE = Object.freeze({
  color: '#1a2a3a',
  emissive: '#0a1520',
  emissiveIntensity: 0.4,
})
```

~20 lines of changes inside the existing useMemo.

---

## 3. Legend overlay — `src/atom/pharmacophore-legend.jsx` (new)

Small `drei/Html` overlay showing colored dots + group names. Only mounted when
pharmacophore mode is active. Positioned in screen-space.

```jsx
function PharmacophoreLabel({ groups }) {
  // groups = deduplicated list of { group, color } from the pharmacophore map
  return (
    <Html center distanceFactor={0} zIndexRange={[100, 0]}>
      <div className="pharmacophore-legend">
        {groups.map(({ group, color }) => (
          <div key={group} className="pharmacophore-legend__item">
            <span style={{ background: color }} className="pharmacophore-legend__dot" />
            <span>{group}</span>
          </div>
        ))}
      </div>
    </Html>
  )
}
```

~30 lines + a few CSS rules in `styles.css`.

---

## 4. Mode toggle plumbing

### config.js

```js
export const APP_HOTKEYS = {
  bloom: '4',
  chromaticAberration: 'c',
  xrayMode: 'x',
  gui: 'g',
  pharmacophore: 'p',   // ← add
}
```

### render-mode.js

Extend the default mode object:

```js
const DEFAULT_ATOM_RENDER_MODE = Object.freeze({
  bondLightIntensityScale: 1,
  cinematicEnabled: false,
  pharmacophoreMap: null,   // ← add
})
```

This lets `AtomInstances` read the map via `useAtomRenderMode()` without prop
drilling through every molecule component.

### App.jsx

```js
const [pharmacophoreMode, setPharmacophoreModeEnabled] = useState(false)
```

Compute the map when mode is active:

```js
const pharmacophoreMap = useMemo(() => {
  if (!pharmacophoreMode) return null
  const defs = dynamicMolecule
    ? { atomDefs: dynamicMolecule.atomDefs, bondDefs: dynamicMolecule.bondDefs }
    : getCurrentPresetDefs(visualization)  // helper to get current preset's defs
  return classifyPharmacophore(defs.atomDefs, defs.bondDefs, defs.aromaticRings)
}, [pharmacophoreMode, dynamicMolecule, visualization])
```

In the `onKeyDown` handler:

```js
if (event.key === APP_HOTKEYS.pharmacophore) {
  event.preventDefault()
  setPharmacophoreModeEnabled((prev) => !prev)
  return
}
```

Pass `pharmacophoreMap` to `AtomScene`.

### scene.jsx

Include `pharmacophoreMap` in the render mode context value:

```js
const renderMode = useMemo(() => ({
  bondLightIntensityScale: 1,
  cinematicEnabled,
  pharmacophoreMap,
}), [cinematicEnabled, pharmacophoreMap])
```

### gui.jsx

Add a toggle in the Effects folder:

```js
effectsFolder
  .add(params, 'pharmacophoreMode')
  .name('Pharmacophore')
  .onChange((value) => setPharmacophoreModeEnabled(value))
```

---

## 5. Getting preset atom/bond defs into App.jsx

Currently preset molecules (Caffeine, LSD, etc.) define their `atomDefs` and `bondDefs`
inline inside their component files. The classifier needs access to this data at the
`App.jsx` level.

**Option A (preferred)**: Import the preset JSON files directly in App.jsx and compile
them on demand. The JSON files (`src/atom/molecules/data/*.json`) already contain
`atoms`, `bonds`, and `aromaticRings`. Add a small lookup:

```js
import caffeineData from './atom/molecules/data/caffeine.json'
import lsdData from './atom/molecules/data/lsd.json'
// ...

const PRESET_DATA = { caffeine: caffeineData, lsd: lsdData, ... }

function getPresetDefs(visualization) {
  const data = PRESET_DATA[visualization]
  if (!data) return null
  return {
    atomDefs: data.atoms,
    bondDefs: data.bonds,
    aromaticRings: data.aromaticRings,
  }
}
```

**Option B**: Move the classifier call into `AtomInstances` itself, passing
`bondDefs` as a prop. This avoids the JSON import dance but requires threading
`bondDefs` through the render mode context or as a prop.

Option A is cleaner because it keeps the classifier at the top level and the
render mode context stays a simple data bag.

---

## 6. File change summary

| File | Change |
|---|---|
| `src/atom/pharmacophore.js` | **New** — `classifyPharmacophore()` + group color constants |
| `src/atom/pharmacophore-legend.jsx` | **New** — legend overlay component |
| `src/atom/config.js` | Add `pharmacophore: 'p'` to `APP_HOTKEYS` |
| `src/atom/render-mode.js` | Add `pharmacophoreMap: null` to default mode |
| `src/App.jsx` | Add state, hotkey, compute map, pass to scene |
| `src/atom/scene.jsx` | Thread `pharmacophoreMap` into render mode context |
| `src/atom/molecules/helpers.jsx` | Read `pharmacophoreMap` from context, override batch styles |
| `src/atom/gui.jsx` | Add pharmacophore toggle |
| `src/atom/pharmacophore-legend.jsx` | Legend overlay |
| `src/styles.css` | Legend CSS |

---

## 7. Data flow

```
App.jsx
  ├─ pharmacophoreMode state (toggled by hotkey 'p')
  ├─ classifyPharmacophore(atomDefs, bondDefs, aromaticRings)
  │   → Map<atomKey, { group, color, emissive }>
  ├─ AtomScene (pharmacophoreMap prop)
  │   └─ AtomRenderModeProvider (value includes pharmacophoreMap)
  │       ├─ AtomInstances
  │       │   └─ useAtomRenderMode().pharmacophoreMap
  │       │       → override batch colors per group
  │       │       → dim unclassified atoms
  │       └─ PharmacophoreLabel (legend, only when map is non-null)
  └─ AtomGuiControls (toggle in Effects folder)
```

---

## 8. Risks & edge cases

- **PubChem 2D records**: Some have all bonds as order 1. Element-based groups
  (amines, halogens, hydroxyls) still work. Aromatic detection misses. Acceptable.
- **Presets with empty `aromaticRings`**: Caffeine has `aromaticRings: []` despite
  having aromatic character in the imidazole ring. The classifier should fall back
  to bond-order detection or skip. Start with the explicit array; add cycle
  detection later if needed.
- **Performance**: Classifier runs once per molecule change, not per frame.
  Map lookup in the batching useMemo is O(n). Negligible.
- **X-ray interaction**: Pharmacophore mode should disable when x-ray is active
  (x-ray overrides materials). Guard with `if (xrayMode) return null` in the
  map computation.

---

## 9. Implementation order

1. `pharmacophore.js` — the classifier, testable in isolation
2. `render-mode.js` + `helpers.jsx` — the rendering override
3. `App.jsx` + `scene.jsx` + `config.js` — the toggle wiring
4. `pharmacophore-legend.jsx` + `gui.jsx` + `styles.css` — UI polish

---

## 10. Best molecules to test with

| Molecule | Why |
|---|---|
| **Caffeine** | 2 carbonyls, 4 nitrogens (amines/imines), compact |
| **LSD** | Amine, aromatic rings, amide — rich pharmacophore |
| **Mirtazapine** | Multiple ring systems, nitrogen groups |
| **Empagliflozin** | Chlorine (halogen), hydroxyls, ether oxygens, 2 aromatic rings |
| **Epinephrine** | Hydroxyl, amine — classic pharmacophore example |
| **Capsaicin** | Amide, hydroxyl, ether — good functional group variety |
