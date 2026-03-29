# Phase 1 Plan: TF2 Heightmapper Sketch-to-Terrain Studio

## Summary
- Build phase 1 as a browser-first app with a child-simple default flow and collapsible advanced terrain controls.
- The core product idea is strong: the differentiator is a semantic sketch layer, not raw grayscale painting. Users paint terrain intent with `Water / Low / Medium / High`, and the app generates believable terrain from that intent.
- Confirmed Transport Fever 2 constraints from the official wiki: heightmaps should be `16-bit grayscale PNG`, each pixel corresponds to a `4x4m` game square corner, and valid dimensions are tied to TF2 preset map sizes rather than arbitrary sizing.
- Important product improvement: export should include the recommended TF2 import values alongside the PNG, because TF2 also asks for terrain `Range` and `Water level` during import.

## Product and UX
- Primary workflow: choose a TF2 map preset, sketch terrain intent, inspect the generated heightmap and 3D terrain live, tune advanced settings if needed, export PNG.
- Workspace layout: large central sketch canvas, compact live grayscale preview, larger 3D terrain preview, right-side inspector for map preset and terrain settings. On small screens, previews become tabs instead of a 3-panel squeeze.
- Visual thesis: a calm cartographic studio, not a toy and not a dashboard-card grid. Strong typography, restrained chrome, one accent color, map-like textures and lighting, minimal clutter.
- Interaction thesis: instant terrain regeneration while drawing, smooth preview transitions, and a tactile brush/eraser experience with obvious undo/redo.
- Default beginner model:
  - `Water` is fixed at `0m`.
  - Non-water terrain is clamped to a minimum of `5m`.
  - `Low / Medium / High` map to editable target elevations, with safe defaults such as `20m / 80m / 200m`.
  - Naturalistic undulation is on by default.
- Phase 1 input scope: sketch only. No text prompting yet. Optional terrain “stamps” can be deferred to phase 1.1 if desired.

## Implementation Changes
- Use a non-destructive pipeline with separate layers:
  - `Sketch layer`: semantic terrain classes painted by the user.
  - `Generation settings`: elevations, smoothing/falloff, noise controls.
  - `Derived terrain`: computed elevation grid at the chosen TF2 output resolution.
- Core terrain generation:
  - Convert class masks into smooth influence fields using distance-based interpolation rather than hard boundaries.
  - Blend target elevations through soft weighting so transitions are continuous by default.
  - Enforce water exactly at `0m` and land at `>= 5m`.
  - Add land-only multi-octave noise/fractal variation, with controls for strength and scale, and a toggle to disable it.
- 3D preview:
  - Terrain mesh generated from the same elevation grid as the export path.
  - Default controls should be orbit/pan/zoom for simplicity; defer free-fly mode unless it becomes necessary.
  - Include a flat water plane at `0m` so coastlines and sea level are obvious.
- Export and persistence:
  - Export exact TF2-compatible `16-bit grayscale PNG`.
  - Show the chosen preset resolution and recommended TF2 import settings: `range min`, `range max`, `water level`.
  - Save/load a local project file containing sketch data, preset, and terrain settings.
- Recommended technical shape:
  - React + TypeScript + Vite for UI.
  - Canvas-based sketching surface.
  - Three.js / React Three Fiber for 3D preview.
  - Terrain generation and PNG encoding in a Web Worker; use a true 16-bit grayscale-capable encoder, with WASM fallback if browser-only libraries are insufficient.

## Important Interfaces / Types
- `MapPreset`: TF2 preset id, label, aspect ratio, pixel width/height, approximate km size, experimental flag.
- `TerrainSettings`: band target elevations, smoothing/falloff strength, noise enabled, noise amplitude, noise scale, octave count.
- `ProjectFileV1`: preset, sketch raster/vector data, terrain settings, export metadata version.
- `ExportProfile`: output resolution, grayscale bit depth, recommended TF2 import range, recommended water level.

## Test Plan
- Validate every supported phase-1 preset exports the exact official pixel dimensions.
- Verify exported PNGs are true grayscale and true 16-bit, not 8-bit RGBA disguised as grayscale.
- Confirm water pixels stay at `0m`, land never drops below `5m`, and transitions between bands are smooth with no stair-step edges in default mode.
- Confirm noise toggle is deterministic when off and predictably adjustable when on.
- Confirm sketch canvas, grayscale preview, 3D preview, and exported file all derive from the same terrain state.
- Test save/load round trips for project files without drift.
- Usability test with a beginner flow: create map, understand presets, paint coastline and hills, preview terrain, export successfully without reading technical docs.

## Assumptions and Defaults
- Phase 1 will support TF2 preset sizes only, not arbitrary custom dimensions.
- Phase 1 will be browser-first, with architecture that can later be wrapped as desktop if needed.
- Phase 1 will prioritize semantic sketch control over prompt-based generation.
- Rounded km labels in TF2 docs are less authoritative than the official heightmap resolution table; the app should enforce the resolution table directly.
- Later phases can add real-world terrain import, map-area selection, reprojection/scaling tools, and hybrid edit workflows on top of this same semantic-terrain pipeline.
