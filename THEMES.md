# Atom Visualization Themes

Visual mode ideas in the spirit of **Blueprint mode** (hotkey `8`).
Each theme covers two layers: the CSS shell (background, overlays, UI chrome) and the
**3-D nucleus display** inside `Nucleus` in `core.jsx`.

Blueprint is the reference implementation for both layers.

---

## Existing

### Blueprint (`8`)
**Shell:** Light linen background (`#edf2e9`), teal-ink text, paper-texture overlay at
`mix-blend-mode: multiply`, compass rose bottom-right, stamp bottom-left.

**Nucleus:** `SphereGeometry` with `meshBasicMaterial wireframe` — renders as a cage of thin ink lines.
Electrons and aromatic ring pairs are hidden.

---

## Ideas

### Chalkboard
**Shell:** Dark green-black background (`#1a2a1a`), white chalk-noise texture overlay,
bonds drawn in off-white, atom labels in chalk-style font.

**Nucleus:** `IcosahedronGeometry(r, 0)` (flat-faceted, zero subdivisions) with a
`MeshStandardMaterial` in matte chalk-white (`roughness: 1, metalness: 0`).
The hard angular faces make each atom look like a hand-drawn polyhedral diagram.
Electrons hidden (they don't read on a dark matte surface).

---

### Hologram
**Shell:** Near-black background, slow scanline drift overlay, "DISPLAY ACTIVE" corner readout.

**Nucleus:** Keep `SphereGeometry` but swap to a custom `ShaderMaterial` that renders only
the silhouette rim (`pow(1 - dot(normal, viewDir), 3.0)`) in emissive cyan-green.
The interior is fully transparent, so each atom looks like a glowing hollow bubble.
Electrons tinted cyan; bond lines thickened slightly.

---

### Sepia / Scientific Journal
**Shell:** Aged parchment background (`#f5e6c8`), ruled-line grid texture, dark-brown bond lines,
corner stamp "Fig. 1 — [compound name]".

**Nucleus:** `CircleGeometry` facing the camera (via `billboarding` / `<sprite>` trick or a
locked-rotation flat plane) with a hand-drawn circle stroke material — flat dark brown
(`meshBasicMaterial`, no sheen). Looks exactly like a structural-formula diagram from a 1900s textbook.
Bonds drawn as plain dark lines; all electron trails hidden.

---

### Circuit Board
**Shell:** Dark PCB green (`#0d1f0d`) background, bright trace-green (`#00ff41`) bond lines,
fine PCB trace grid texture.

**Nucleus:** `CylinderGeometry(r, r, h, 32)` — a flat solder-pad disc — with a
`MeshStandardMaterial` in gold (`#d4a843`, `metalness: 0.9, roughness: 0.25`).
Bond endpoints sit on the pad rim. Electrons hidden; structural bond lines styled as PCB traces.

---

### Thermal / Heat Map
**Shell:** Dark background, vertical color-key legend on the right edge.

**Nucleus:** Keep `SphereGeometry` but color each atom by atomic number mapped through a
hot → cold palette (`blue → yellow → red`). The color is passed as a `uniform vec3 uAtomColor`
into a small fragment shader that lerps between the heatmap colors.
Electrons kept but recolored to match the atom's heat color so the whole sphere pulses.

---

### Neon Wireframe
**Shell:** Pure black background, no overlay needed.

**Nucleus:** `SphereGeometry` with `MeshBasicMaterial wireframe` — same geometry as blueprint —
but the color is a vivid per-element neon (`#ff4dff` for oxygen, `#4dffff` for carbon, etc.)
and a second transparent `MeshBasicMaterial` non-wireframe pass at very low opacity gives
each sphere a faint inner glow. Bond lines match the element color.

---

## Nucleus Render Styles — Quick Reference

| Theme | Geometry | Material | Electrons |
|---|---|---|---|
| Blueprint (existing) | `SphereGeometry` | `meshBasicMaterial` wireframe, ink teal | hidden |
| Chalkboard | `IcosahedronGeometry(r, 0)` | `MeshStandardMaterial` chalk-white, flat | hidden |
| Hologram | `SphereGeometry` | rim-only `ShaderMaterial`, transparent interior | kept, cyan |
| Sepia | `CircleGeometry` (billboard) | `meshBasicMaterial` dark brown | hidden |
| Circuit Board | `CylinderGeometry` (flat disc) | `MeshStandardMaterial` gold, metallic | hidden |
| Thermal | `SphereGeometry` | `ShaderMaterial` heatmap by atomic number | kept, recolored |
| Neon Wireframe | `SphereGeometry` | `meshBasicMaterial` wireframe + faint solid layer | kept, neon |

---

## Implementation Notes

### Shell layer (CSS)
1. A boolean state flag (e.g. `chalboardMode`) in `App.jsx`.
2. A CSS class (e.g. `is-chalkboard`) on `.app-shell`.
3. An overlay `<div>` (texture, scanlines, etc.) at `z-index: 1` with appropriate `mix-blend-mode`.
4. Optional corner decoration as fixed-position HTML.
5. A hotkey in `APP_HOTKEYS` in `config.js`.
6. A GUI toggle in `gui.jsx` under the Effects folder.

### 3-D layer (nucleus)
Add a `nucleusStyle` string (e.g. `'chalk' | 'hologram' | 'sepia' | ...`) to
`AtomRenderModeContext` in `render-mode.js`. Then branch on it inside `Nucleus` in `core.jsx` —
exactly as the existing `blueprintEnabled` branch does, but returning the new geometry/material
instead of the wireframe sphere.

Geometry swaps are cheap. Material swaps that introduce a new `ShaderMaterial` (Hologram,
Thermal) need a `customProgramCacheKey` to avoid shader recompilation on every render.
