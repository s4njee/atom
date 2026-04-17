# Atom — Research & Ideas

A living backlog of visualization ideas for the atom scene. Every idea here is meant to be **visually striking first**, **scientifically evocative second**. Not every idea should (or will) be implemented — this is a menu, not a roadmap.

The atom codebase already has strong primitives (GPU trails, instanced atoms, orbital cloud sampler, a shared effect stack, PubChem ingestion). Ideas below are designed to **ride existing infrastructure** wherever possible so prototyping stays cheap.

---

## How to read this doc

Each idea is tagged on two axes:

**Flavor**
- `[stylized]` — aesthetic gesture toward a real phenomenon; fake math is fine if it looks right.
- `[rigorous]` — uses real formulas or data (spherical harmonics, Rydberg, formal charges, etc.).
- `[research-required]` — needs a library, algorithm, or dataset that is not yet in the repo. Treat as exploratory.

**Difficulty**
- ◇ small — a shader tweak, one new hook, a JSON field addition. Hours.
- ◆ medium — new render mode, new post-FX, new interaction. Day or two.
- ◈ large — new data pipeline, new surface extractor, substantial new UI. Week+.

**Out of scope for this document**
- Brand-new standalone scenes (periodic-table flyby, spectra explorer, etc.). This doc only extends the existing atom scene.
- Anything requiring auth'd APIs or server-side compute.
- Implementing any of the ideas — those are follow-up tasks.

---

## Reusable building blocks

Reference table so each sketch below can stay terse. Paths are relative to the `visualizations/atom/` root of this submodule.

| Primitive | Location | What it does |
|---|---|---|
| `Nucleus` | [src/atom/core.jsx](src/atom/core.jsx) | Pooled sphere + emissive material per atom |
| `ElectronPair`, `OrbitalCloud` | [src/atom/core.jsx](src/atom/core.jsx) | Point-cloud orbital/electron density sampler |
| `SigmaBondPair` / `PiBondPair` / `SingleBond` / `DoubleBond` / `StructuralBond` / `AromaticRingPair` | [src/atom/core.jsx](src/atom/core.jsx) | Bond geometry + GPU electron trails |
| `useTrailBuffer` / `createTrailBuffer` | [src/atom/core.jsx](src/atom/core.jsx) | Shader-driven GPU point trail, rotation-invariant |
| `createXrayMaterialController` | [src/atom/core.jsx](src/atom/core.jsx) | Capture/restore per-mesh material state for mode switches |
| `useMoleculeAnimation` | [src/atom/molecules/helpers.jsx](src/atom/molecules/helpers.jsx) | Idle rotation/float, pauses during orbit-interaction |
| `AtomInstances` | [src/atom/molecules/helpers.jsx](src/atom/molecules/helpers.jsx) | Instanced atom renderer — reuse for any "many sprites" idea |
| Preset JSON schema | [src/atom/molecules/data/*.json](src/atom/molecules/data/) | Atoms, bonds, aromaticRings; extensible with new keys |
| Element database | [src/atom/elements.json](src/atom/elements.json) | Per-element color, emissive, radius, shells |
| `AtomRenderModeProvider` | [src/atom/render-mode.js](src/atom/render-mode.js) | Context for render modes (cinematic, etc.) |
| `AtomInteractionProvider` | [src/atom/interaction.js](src/atom/interaction.js) | Orbit/zoom active state + idle-resume delay |
| GUI pattern | [src/atom/gui.jsx](src/atom/gui.jsx) | lil-gui setup for live parameters |
| Config / presets / hotkey map | [src/atom/config.js](src/atom/config.js) | Lights, cameras, effect presets |
| Shared effect stack | [`eva/src/shared/special-effects/`](../../src/shared/special-effects/) + `SharedEffectStack` | Bloom, CA, Xray, Thermal, Databend, PixelMosaic, Glitch, Scanline, BarrelBlur |

---

## Idea catalog

Each entry:

> **#N · Title** — `[tag]` · ◆ difficulty
> _One-line aesthetic hook._
> **Science** — the real phenomenon it nods to.
> **Look** — concrete visual description.
> **Sketch** — files to touch + primitives to reuse + 2–4 bullets of algorithm.
> **Risks** — blockers and open questions (only when non-trivial).

---

### Theme A · Orbital & quantum structure

---

**#1 · Spherical-harmonic orbital gallery** — `[rigorous]` · ◆

_A lone atom blooms into the textbook s/p/d/f lobes, slowly rotating._

**Science** — Real `Y_l^m(θ,φ)` spherical harmonics sampled as a probability density cloud. Same shapes that appear in every intro quantum-chemistry book.

**Look** — Current atom dims to ghost; probability density renders as ~30k glowing points colored by sign of the wavefunction (warm = +, cool = −). Hotkey cycles `n,l,m`.

**Sketch**
- Extend [src/atom/core.jsx](src/atom/core.jsx) `OrbitalCloud` to accept an `(n,l,m)` triple. Use existing density-sampler rejection loop.
- Add `Y_l^m` closed-form expressions for l ≤ 3 (a few tens of lines).
- New hotkey `o` toggles gallery mode; arrow keys cycle quantum numbers.
- Expose in [src/atom/gui.jsx](src/atom/gui.jsx) under a new "Orbital Lab" folder.

---

**#2 · HOMO / LUMO lobes on the current molecule** — `[research-required]` · ◈

_Translucent colored lobes drape over the molecule — the shape of its reactivity._

**Science** — Highest Occupied / Lowest Unoccupied Molecular Orbitals. In real life these come from SCF calculations; here we'd approximate from bond graph + atom-centered basis.

**Look** — Two wispy volumetric isosurfaces (red for HOMO, cyan for LUMO) that breathe with a slow opacity cycle. Toggle with a hotkey; off by default to keep the default scene calm.

**Sketch**
- Precompute MO coefficients offline (Psi4 / PySCF) per preset, ship as JSON alongside each molecule.
- Evaluate ΣᵢCᵢφᵢ(r) on a sparse grid; marching cubes (from `three-stdlib`) to extract isosurface.
- Render as `MeshTransmissionMaterial` with low opacity.
- PubChem-loaded molecules simply hide the toggle (no MO data available).

**Risks** — Real MO computation is heavy; even precomputed `.cube` files are large. A cheaper stand-in: use Hückel theory on the π-system only, which is tractable in plain JS but only works for aromatic/conjugated molecules. Start there.

---

**#3 · Hybridization morph (sp → sp² → sp³)** — `[stylized]` · ◆

_A carbon atom reorganizes its orbitals in real time as you change its bond count._

**Science** — Valence-bond theory's hybridization. Real atoms don't actually morph like this — but the shapes students memorize are real.

**Look** — Click an atom; four translucent orbital lobes smoothly rotate from tetrahedral → trigonal planar → linear, over ~600 ms. Paired with a subtle bloom pulse on completion.

**Sketch**
- Add a `hybridization` field to atom JSON (optional; inferred from bond count if missing).
- New `<HybridCloud atomKey={...} />` component; four `OrbitalCloud` instances whose basis vectors are tweened.
- Drive tween via `useMoleculeAnimation` or a fresh `useSpring` from framer (already bundled indirectly? if not, hand-roll — 20 lines).

---

**#4 · Electron standing-wave shimmer on bonds** — `[stylized]` · ◇

_Bonds quietly pulse like violin strings._

**Science** — Electron wavefunction on a bond interpreted as a particle-in-a-box; nodes at endpoints; brightness ~ `sin²(nπx/L)`.

**Look** — Along each sigma trail, brightness is modulated by a standing-wave envelope that breathes at ~0.5 Hz. Mode `n` picks which harmonic; higher `n` = more nodes visible. Very subtle unless you look.

**Sketch**
- Modify the point shader in [src/atom/core.jsx](src/atom/core.jsx) used by `useTrailBuffer`: multiply alpha by `sin²(nπ * a_bondParam + u_time*ω)`.
- Plumb `n` and `ω` as uniforms; default to off for a calm baseline.
- GUI folder "Standing wave" with `n`, `ω`, `amplitude`.

---

### Theme B · Molecular surfaces & fields

---

**#5 · Electrostatic potential (ESP) shell** — `[rigorous]` · ◈

_A translucent red-and-blue aura reveals where the molecule is hungry and where it's greedy._

**Science** — ESP = Σᵢ qᵢ / |r − rᵢ|. Real ESP uses partial charges; we can start with formal charges or Gasteiger charges.

**Look** — Raymarched slab around the molecule, colored by potential (blue positive, red negative, white neutral), semi-transparent. Sits outside the atoms, so they remain readable.

**Sketch**
- Add optional `charges` array to preset JSON (per-atom partial charges).
- New full-screen raymarch pass, or a bounding-box mesh with a volumetric fragment shader evaluating ESP at each voxel.
- Could integrate with `SharedEffectStack` or render as in-scene mesh — prefer in-scene for DOF compatibility.
- For PubChem molecules: either omit, or run Gasteiger approximation on the fly (~200 lines of JS).

**Risks** — Raymarching adds ~1–3 ms/frame depending on resolution. Performance-gate behind a GUI toggle.

---

**#6 · Van der Waals "soft jelly" metaball skin** — `[stylized]` · ◆

_The molecule looks dipped in colored resin._

**Science** — Van der Waals surface — each atom contributes a soft sphere of VdW radius; union of spheres is the skin.

**Look** — `MarchingCubes` mesh wrapping the atoms, slightly larger than the atoms themselves, thin Fresnel rim, ~0.3 opacity. Color-blended from the contributing atoms' CPK colors.

**Sketch**
- Use `MarchingCubes` from `@react-three/drei` (already a dep).
- Drive `addBall` calls from atom positions, radius scaled from [src/atom/elements.json](src/atom/elements.json) Van der Waals column (add if missing — common table).
- Material: `MeshPhysicalMaterial` with transmission and thickness, low IOR.

---

**#7 · Solvent-accessible surface with wandering waters** — `[stylized]` · ◆

_Tiny water molecules drift around the molecule like fish around coral._

**Science** — Solvent-accessible surface (SAS) is the locus reachable by a 1.4 Å sphere. We don't need to compute the exact SAS — approximate with a VdW-inflated hull.

**Look** — 20–50 instanced H₂O sprites slowly drift on the hull surface, occasionally colliding and bouncing. Under cinematic mode, waters catch bloom.

**Sketch**
- Reuse `AtomInstances` to render waters cheaply (each water = 3 instances).
- Sample hull positions at init, then advect with a cheap vector field + surface-projection step each frame.
- Hide waters when x-ray is active (they'd be noise).

---

### Theme C · Dynamics & motion

---

**#8 · Normal-mode vibration viewer** — `[rigorous]` · ◈

_The molecule stretches, scissors, and wags along a real vibrational mode._

**Science** — Normal modes from vibrational analysis (same thing IR spectroscopy measures). Real modes come from diagonalizing the mass-weighted Hessian.

**Look** — Atoms oscillate sinusoidally along mode displacement vectors. Mode name floats in the HUD ("Symmetric C-H stretch · 3020 cm⁻¹"). Hotkey cycles modes.

**Sketch**
- Add optional `vibrations: [{ name, frequency, displacements: [...] }]` to preset JSON.
- Supply a small number of precomputed modes per preset (offline, from any QM package or Avogadro).
- In render loop: `atom.position = equilibrium + A * sin(ω t) * displacement`.
- HUD via `drei/Html`.

**Risks** — Precomputing modes for every preset is real work. Good first target: caffeine + glucose only.

---

**#9 · Thermal jitter slider (Maxwell–Boltzmann style)** — `[stylized]` · ◆

_A temperature knob makes the molecule restless, then frantic._

**Science** — At temperature T, each atom has kinetic energy ~kT. We stylize: atom positions perturbed by Gaussian noise with σ ~ √T, spatially correlated between bonded atoms so bonds stay plausible.

**Look** — At T=0 the molecule is perfectly still. At T=300 K (room temp), gentle quiver. At T=3000 K, chaotic shake. Bond-electron trails smear.

**Sketch**
- Single GUI knob `temperature` (0–5000 K, log-scale).
- Each frame, perturb `atom.position = equilibrium + noise(t, seed=atomKey) * σ(T)`.
- Use correlated noise (e.g. simplex) so bonded atoms move together — prevents bonds from stretching unrealistically.

---

**#10 · Bond-break reaction micro-cinematic** — `[stylized]` · ◆

_Two molecules collide; bonds dim, swap, and reignite into products._

**Science** — An elementary reaction step: e.g., H₂ + I₂ → 2 HI. Scripted, not simulated — the point is to convey the *event*, not the mechanism.

**Look** — Camera pulls back slightly. Old bonds fade to zero brightness; atoms translate to product geometry; new bonds flash in with a bloom pulse. Entire beat ~3 seconds, then loops.

**Sketch**
- Reaction defined as a timeline: keyframes of bond existence + atom positions.
- Add `reactions: [...]` to a dedicated preset (e.g., `h2_i2.json`).
- A scheduler ticks through keyframes; bonds interpolate opacity + endpoint positions.
- Cinematic bloom pulse via `SharedEffectStack` bloom intensity tween.

---

**#11 · Free-rotation torsion handle** — `[stylized]` · ◇

_Grab a single bond and spin the tail of the molecule like a dial._

**Science** — Conformational isomerism — rotation around a single bond produces different conformers (e.g., staggered vs. eclipsed ethane).

**Look** — Hover a single bond; it highlights with a subtle yellow glow and a tiny torsion icon. Drag to rotate the half of the molecule "downstream" of that bond. A small angle readout shows the torsion in degrees.

**Sketch**
- Extend [src/atom/interaction.js](src/atom/interaction.js) with a torsion-drag state.
- On drag, walk the bond graph from one end to find the downstream subgraph; rotate it around the bond axis.
- Pauses idle animation via existing `AtomInteractionProvider`.
- Aromatic and double bonds disallowed (would tear the π system).

---

### Theme D · Spectroscopy & emission

---

**#12 · Bohr emission spectrum cascade** — `[rigorous]` · ◆

_Click a shell. An electron drops. A photon of exactly the right color flies out._

**Science** — Rydberg formula: `1/λ = R (1/n₁² − 1/n₂²)`. Wavelength drives photon color through a blackbody-ish conversion.

**Look** — Only active when visualizing a single atom (hydrogen especially). Shells visible as faint rings. Click ring n; an electron animates from ring n to ring 1; a photon sprite ejects along a random direction, color-mapped to wavelength. A small spectrum bar at the bottom lights up at that wavelength.

**Sketch**
- New `EmissionCascade` component, only mounted when current preset is a lone atom.
- Rydberg constant lookup for H; fallback estimate for other atoms.
- Photon sprite uses existing `useTrailBuffer` for a fading streak.
- Spectrum bar is a simple `<canvas>` HUD.

---

**#13 · IR absorption bars HUD (pairs with #8)** — `[rigorous]` · ◆

_A spectrogram hums at the bottom of the screen; the peaks light up when you play their modes._

**Science** — IR spectrum is a plot of absorption vs frequency; peaks correspond to normal modes.

**Look** — Thin horizontal chart at screen bottom (not intrusive). Each mode appears as a bar at its frequency. Bar glows when that mode is being played. Clicking a bar selects that mode.

**Sketch**
- Requires idea #8 in place (to source modes).
- `<IRChart modes={...} activeIndex={...} />` rendered via `drei/Html` in screen-space.
- Click → sets active mode.

---

### Theme E · Interaction narratives

---

**#14 · Pharmacophore highlight mode** — `[stylized]` · ◆

_Functional groups glow in their signature colors; the molecule becomes legible as chemistry._

**Science** — Pharmacophore: the ensemble of features (H-bond donors/acceptors, aromatic rings, hydrophobic regions) responsible for a drug's activity.

**Look** — Hotkey `p`. Amines turn cool blue, hydroxyls teal, carbonyls amber, aromatic rings get a purple halo, ester/amide backbones get a thin gold line. Everything else dims. Especially striking on caffeine, LSD, mirtazapine.

**Sketch**
- Small graph-pattern matcher over the bond graph in [src/atom/molecules/](src/atom/molecules/). Match by element + neighborhood (e.g., "N bonded only to C and H = amine").
- Per group, override atom emissive colors in a new render mode.
- Legend overlay via `drei/Html`.

---

**#15 · Receptor-pocket "dock-in" cinematic** — `[stylized]` · ◈

_A wireframe cage materializes; the molecule eases into it like a key into a lock._

**Science** — Real protein-ligand docking is hard; this is pure narrative. Suggest that the molecule belongs somewhere specific.

**Look** — Procedurally generated wireframe "pocket" fades in (blob-like cage around where the molecule will rest). Camera slowly arcs. Molecule eases into position with DOF blur focusing on the binding moment and a single bloom pulse.

**Sketch**
- Cage = VdW hull (idea #6) rendered as wireframe with a slight inflation.
- Timeline scheduler similar to idea #10.
- Add a "narrative" flag to presets; only opts-in preset triggers the cinematic.

---

**#16 · Resonance-structure morph** — `[rigorous]` · ◆

_Benzene's alternating double bonds shimmer between two Kekulé forms, then settle into a ring of delocalization._

**Science** — Resonance — real molecules are superpositions of Lewis structures. Benzene's true state is neither Kekulé form but their average.

**Look** — Cycles every ~3 seconds: form A for 1 s, crossfade (0.5 s), form B for 1 s, crossfade (0.5 s). A dashed delocalized ring renders faintly at all times underneath.

**Sketch**
- Add `resonance: [{ bonds: [...] }, ...]` per preset — list of bond-order mappings.
- Tween bond-order opacity between forms using existing `DoubleBond` alpha.
- Aromatic ring pair stays constant.

---

### Theme F · Aesthetic render modes & post-FX

---

**#17 · Schrödinger blueprint** — `[stylized]` · ◆

_The whole scene switches to a technical drawing — angstrom ticks, no shading, pure lines._

**Science** — Nods to x-ray crystallography diagrams and the Schrödinger wave-mechanics papers of the late 1920s.

**Look** — Background becomes pale graph paper. Atoms become circles with thin strokes. Bonds become single lines labeled with bond length in Å. A small compass rose in the corner. No bloom, no CA — clinical.

**Sketch**
- New entry in [src/atom/render-mode.js](src/atom/render-mode.js) (e.g., `'blueprint'`).
- Swap materials: `LineBasicMaterial` for bonds, `MeshBasicMaterial` wireframe for atoms.
- Label overlays via `drei/Html`.
- Grid background via a shader quad behind everything.

---

**#18 · Volumetric nucleus god rays** — `[stylized]` · ◆

_Each nucleus is a tiny sun, casting soft light shafts through the molecule._

**Science** — None, really — nuclei don't glow. This is drama.

**Look** — Radial volumetric fog from each nucleus, softly occluded by the bonds. Beautiful when paired with cinematic mode.

**Sketch**
- New post-FX in [`eva/src/shared/special-effects/`](../../src/shared/special-effects/).
- Implement as a screen-space godray pass using depth + a per-nucleus bright-pixel source.
- Register in `SharedEffectStack` behind a flag.

**Risks** — Screen-space godrays with many sources can be expensive. Cap to the N brightest atoms in view.

---

**#19 · Caustic glass atoms** — `[stylized]` · ◆

_The atoms are marbles of colored glass; bonds shimmer with the light passing through._

**Science** — None — it's a material study.

**Look** — Swap `MeshPhysicalMaterial` for a transmissive variant with high thickness and IOR ~1.5. Colored atoms tint the bonds they flank.

**Sketch**
- New render mode toggle in [src/atom/render-mode.js](src/atom/render-mode.js).
- Material swap only; bond geometry unchanged.
- Disable bloom to keep glass legible.

**Risks** — Transmissive materials are slow on low-end GPUs. Gate with the adaptive-quality hook from [`eva/src/shared/performance/`](../../src/shared/performance/).

---

**#20 · Time-crystal strobe** — `[stylized]` · ◇

_A ghost of the scene from a moment ago hovers behind the live scene, pulsing in and out of phase._

**Science** — Loose nod to time crystals — systems with periodic structure in time. This is just a temporal echo.

**Look** — Every ~2 s, the scene's previous-frame buffer is drawn at ~30% alpha, offset slightly. Creates a rhythmic ghosting. Intense under databend mode.

**Sketch**
- Add a framebuffer echo pass to `SharedEffectStack`.
- Two ping-pong render targets; previous one drawn on top every N frames.
- GUI: period, alpha, offset.

---

## Cross-cutting implementation notes

- **New render modes** plug in via [src/atom/render-mode.js](src/atom/render-mode.js) (add to the mode enum), a branch in [src/atom/scene.jsx](src/atom/scene.jsx), a toggle in [src/atom/gui.jsx](src/atom/gui.jsx), and a hotkey in [src/App.jsx](src/App.jsx). Keep the x-ray/cinematic pattern for consistency.
- **New post-FX** go under [`eva/src/shared/special-effects/`](../../src/shared/special-effects/) and register in `SharedEffectStack`. They should be opt-in so default renders stay calm.
- **New molecule metadata** (vibrations, charges, resonance, hybridization, reactions) are optional fields in the preset JSONs under [src/atom/molecules/data/](src/atom/molecules/data/). Guard all consumers with `if (molecule.vibrations)` so PubChem-loaded and older presets still render.
- **Performance guardrails** — reuse `AtomInstances` for any multi-sprite idea; avoid per-atom meshes. Any trail-like effect must go through `useTrailBuffer` to inherit allocation pooling. Heavier ideas (ESP, metaball, volumetric FX) must be GUI-gated and default off.
- **Default look stays calm** — the homepage shows atom briefly; a user's first impression should never be frenetic. New modes are opt-in via hotkey, toggle, or preset.

---

## Verification template

When implementing any idea, verify:

1. `npm --prefix visualizations/atom run dev` — confirm the new mode renders, toggles on hotkey, and the idle animation still pauses on orbit.
2. `npm run build` at the eva repo root — confirm the homepage still compiles (the atom scene is imported into root).
3. Visual QA checklist:
   - Toggle cinematic mode (hotkey `4`). Does the new idea compose with bloom?
   - Toggle x-ray (hotkey `x`). Does material restoration still work after leaving the new mode?
   - Load a PubChem molecule by name. Does the new idea degrade gracefully when molecule metadata is missing?
   - Cycle presets with arrow keys. No leaks (material pool holds)?
4. **Suggested follow-up, not required** — add a Playwright check analogous to `npm run check:matrix-visible` that verifies the atom canvas paints real pixels. Atom does not have one today.

---

## Where to start

If I (or a future session) want to prototype the highest-payoff-per-hour ideas first:

1. **#4 · Standing-wave shimmer** — smallest possible change; immediately beautiful.
2. **#14 · Pharmacophore highlight** — reuses everything; makes the preset library (caffeine, LSD, etc.) feel narrative.
3. **#9 · Thermal jitter** — one GUI knob; broadly legible; pairs with every other mode.
4. **#17 · Schrödinger blueprint** — strong aesthetic differentiator and the closest to a "chemistry textbook" look; great for screenshots.

Anything in Theme B, D, or the `[research-required]` entries is a longer commitment — do those when there's appetite for multi-day work.
