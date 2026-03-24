# Changelog

All notable changes to the Atom visualization project are documented in this file.

This changelog currently summarizes the five Atom commits ahead of `origin/main` as of March 19, 2026, including the Claude-assisted feature and architecture work.

## 2026-03-19

### Added

- PubChem search with debounced autocomplete, direct CID lookup support, dynamic molecule loading, and a reusable dynamic molecule renderer.
- A periodic-table-style atom tooltip with hover and click interaction details.
- A performance-safe molecule schema layer under `src/atom/schema/` for serializable molecule data plus one-time compiled render views.
- Orbit camera interaction for the Atom scene.
- A declarative `Bond` component and a generic `PresetMolecule` renderer for schema-driven preset molecules.
- JSON data files for preset molecules under `src/atom/molecules/data/`.
- Effect presets in the GUI for quickly applying named lighting and post-processing looks.
- Glucose as a selectable visualization in the preset navigation.
- `CHANGELOG.md` to track Atom-specific project history.

### Changed

- Refactored Atom rendering to share pooled nucleus materials and centralized element render styles.
- Split shared molecule helpers into `helpers.jsx` and moved the renderer toward reusable instanced atom batches.
- Reworked Atom dev-server base handling so local Vite uses `/` while production builds continue to target `/atom/`.
- Reorganized the app around more modular scene, molecule, schema, and preset boundaries.
- Renamed `visualizations.js` to `visualizations.jsx` after moving JSX-based visualization wiring there.

### Performance

- Added material and geometry pooling for atom rendering.
- Switched major molecule renderers to shared instanced atom rendering to reduce draw-call overhead.
- Replaced higher-allocation trail updates with lower-allocation buffered trail handling.
- Introduced a lighter default lighting profile inspired by Empagliflozin, with richer reflective/bloom-heavy treatment reserved for cinematic mode.

### Fixed

- Improved standalone Atom Vite behavior when running locally from the repo root.
- Reduced React/R3F integration issues by aligning Atom’s render structure with the shared effect stack and modular scene flow.
- Improved tooltip layout handling to avoid clipping in the periodic-table detail card.

### Commit Timeline

- `14953a1` `Pool atom materials and styles`
- `268a448` `Use root base for Atom dev`
- `3cf42ef` `Improve Atom rendering performance`
- `622fb90` `Add interactivity, PubChem search, and periodic table tooltip`
- `856a765` `Modularity & architecture refactors`

### Notes

- Git metadata explicitly marks the last two commits as co-authored with Claude Sonnet 4.6.
- The changelog groups related work by outcome so readers can scan the Atom project history without reading each individual commit diff.
