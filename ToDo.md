# Atom Visualization Roadmap

> Last reviewed: 2026-03-23

This file tracks the Atom visualization against the original refactor ideas, marks what has already landed, and sorts the remaining work by value and implementation cost.

## Completed

These items are already present in the current Atom codebase.

- Instanced atom rendering via `@react-three/drei` `Instances` (see `helpers.jsx` → `AtomInstances`, which groups atoms by element into batches and renders each via `<Instances>` + `<Instance>`)
- Shared material/style metadata through `src/atom/elements.json` and `src/atom/elements.js`
- GPU-driven bond and pi-bond electron trail shaders in `src/atom/core.jsx`
- Named effect presets in the GUI
- PubChem name/CID search with autocomplete, fetch, caching, and dynamic molecule rendering
- Serializable molecule schema utilities under `src/atom/schema/`
- Preset molecules stored as plain JSON under `src/atom/molecules/data/`
- Generic preset renderer via `PresetMolecule`
- Declarative bond rendering via `src/atom/molecules/Bond.jsx`
- Shared `useMoleculeAnimation()` hook for idle rotation/float behavior
- OrbitControls-enabled camera inspection
- Auto-rotation pause/resume when the user interacts with the camera
- Atom hover scaling (15% scale-up on pointer over)
- Atom click selection tooltip overlays (periodic-table-tile style via `AtomTooltip`, rendered in 3D world-space with `<Html>`)

## Partially Completed

These ideas exist in some form, but the original goal is only partly met.

### Performance / Rendering

- Material pooling is partly done:
  `AtomInstances` in `helpers.jsx` creates a `<meshPhysicalMaterial>` per batch (one per unique element/color/emissive combo). The nucleus path in `core.jsx` caches materials separately. These two caching strategies are not unified.
- Dynamic lighting optimization is partly done:
  moving bond lights are effectively disabled in the default path and reserved for cinematic mode, but the lighting model could still be simplified further.

### Chemistry / Data

- Dynamic PubChem parsing is partly done:
  PubChem JSON fetching and schema compilation are in place, but there is no SDF (Structure Data File — a standard chemical file format for 3D coordinates, bonds, and properties) import flow yet.
- Unified molecule schema is mostly done:
  JSON-backed preset molecules and the dynamic `DynamicMolecule` renderer exist, but 12 legacy per-molecule wrapper components remain (Atropine, Buckminsterfullerene, Caffeine, Capsaicin, Empagliflozin, Epinephrine, Ethylene, Glucose, LSD, Mirtazapine, Oxygen, Quetiapine). These all follow the same pattern — import `AtomInstances` + `useMoleculeAnimation` from `helpers`, define an `atomDefs` array, render bonds.

  > **📋 TODO (code):** Migrate remaining legacy molecule wrappers to `PresetMolecule` with JSON data files. Each is a mechanical conversion — extract atom/bond definitions into a `.json` file under `molecules/data/`, delete the JSX wrapper.

- Separate data layer from React is mostly done:
  structure data now lives outside most render components, but the legacy molecule wrappers above still embed atom/bond definitions inline in JSX.

### Interaction / UX

- Atom and bond selection is partly done:
  atoms can be hovered and selected (with tooltip), but bonds do not yet expose hover/select metadata.
- Dynamic label system is partly done:
  there is a bottom overlay label for presets, a search pill for dynamic molecules, and atom tooltips, but not a full in-scene label system.
- Render-mode architecture is partly done:
  there is a render-mode context (`useAtomRenderMode`) and cinematic mode shaping (switches to `CINEMATIC_ATOM_SURFACE` material params), but not fully distinct ball-and-stick / space-filling / wireframe renderers.
- Effect preset system is partly done:
  built-in presets exist, but custom preset save/load via `localStorage` does not.

- ~~PubChem molecule caching does not persist across sessions~~ — **DONE** (2026-03-23):
  `pubchem.js` now has a two-tier cache: in-memory Map for instant in-session lookups + `localStorage` for persistence across sessions. Implementation details:
  - Entries keyed by `pubchem:<CID>` with a 7-day TTL
  - LRU eviction at 20 entries max to stay within the ~5 MB `localStorage` budget
  - Lookup order: memory → localStorage → network
  - Both name-based and CID-based lookups resolve to the same cached entry

## Suggested Next Order

This is the recommended implementation order from highest payoff to highest complexity.

1. **In-scene molecule name/formula label**
   Why first: low risk, visible immediately, and closes an obvious UX gap. Use `<Html>` from drei (already imported in `helpers.jsx`).

2. ~~**Cache PubChem molecule JSON in `localStorage`**~~ — **DONE** (2026-03-23)
   Implemented in `pubchem.js` with LRU eviction and 7-day TTL.

3. **Bond hover/select tooltip data**
   Why next: builds naturally on the existing atom-selection system in `AtomInstances` and unlocks measurement tools.

4. **Measurement mode for distances and angles**
   Why next: high educational value and uses the same selection primitives.

5. **Smooth molecule transitions when switching presets or search results**
   Why next: noticeable polish without needing new chemistry infrastructure.

## Remaining Work By Theme

### P1: Strong Follow-Ups

- Build true ball-and-stick rendering (extend `useAtomRenderMode` to drive atom scale from van der Waals vs. fixed radius)
- Build true space-filling rendering from van der Waals radii
- Build a lightweight wireframe / stick renderer for larger compounds
- Add algorithmic bond inference for raw coordinate inputs (needed for SDF/XYZ imports)
- Add lone pair visual overlays for common atoms like O and N
- Add a partial-charge color mode using electronegativity heuristics

### P2: Advanced / Experimental

- Add excitation and relaxation interactions with photon-emission visuals
- Add volumetric or instanced-point orbital cloud rendering
- Add reaction animation support with atom mapping between reactants and products
- Normalize imported structures to Ångström-scale coordinates so the camera, labels, and measurement tools work in real-world chemistry units instead of the current arbitrary viewport normalization
- Reduce remaining material allocations in the instanced atom path (unify the `core.jsx` nucleus cache with the `AtomInstances` batch materials)

## Fresh Ideas

These are not from the original list, but they fit the current architecture well.

### UX / Teaching

- Guided molecule tour mode:
  step through notable atoms, bonds, rings, and functional groups with short captions.
- Functional-group highlighting:
  detect rings, hydroxyls, amines, carbonyls, and aromatics from schema data and let users toggle them.
- Compare mode:
  show two molecules side by side with synchronized camera controls and shared preset/effect settings.
- Screenshot / poster mode:
  one-click high-resolution still export with clean labels and effect presets.

### Data / Platform

- Import local `.mol`, `.sdf`, or `.xyz` files through the browser (SDF = Structure Data File, XYZ = simple Cartesian coordinate format — both are standard chemistry interchange formats)
- Add a schema validation test suite so imported molecules fail loudly and predictably
- Add a small molecule metadata panel:
  formula, PubChem CID, atom count, bond count, ring count, estimated mass
- ~~Cache recent PubChem molecules in `localStorage`~~ — promoted to Suggested Next Order #2 above

### Visual Direction

- Functional-group-specific glow accents instead of only element-based coloring
- Camera bookmark presets:
  top, side, ring-normal, and detail views for quick composition changes
- Environment-light presets matched to chemistry themes:
  clinical, neon lab, amber spectroscopy, deep vacuum

## Notes

- The old todo described several pre-refactor pain points that are no longer true. Keep this file focused on current gaps rather than historical architecture.
- Favor small, composable additions that reuse the current schema, `PresetMolecule`, interaction hooks, and shared special-effects stack.
- When a roadmap item changes architecture, update `docs/atom.md` in the same pass.
