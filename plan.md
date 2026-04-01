# TF2 Heightmapper

## Product goal

Create an app that a 13-year-old can use to make good-looking Transport Fever 2 heightmaps without needing to understand grayscale terrain authoring, GIS tooling, or game import edge cases.

The core idea is:

- the user paints simple landscape intent
- the app turns that into a believable terrain surface
- the app exports a TF2-ready heightmap

## Phase structure

### Phase 1: Sketch to terrain

Status: in active prototype and already working.

Goal:

- paint broad landscape areas using a small number of terrain classes
- generate a natural-looking terrain result automatically
- preview it live as grayscale and in 3D
- export a TF2-compatible heightmap

Current delivered scope:

- paint canvas with `Water`, `Low`, `Medium`, `High`
- brush size control
- undo / redo / reset
- live grayscale preview
- live 3D terrain preview
- TF2 preset map size selection
- project save/load
- 16-bit grayscale PNG export
- worker preview generation with main-thread fallback
- optional `Minecraft mode` terracing switch

### Phase 2: Real-world map import

Planned.

Goal:

- choose a real-world area
- align it to TF2 map sizes
- generate a correct TF2 heightmap from real terrain data

Likely needs:

- map selection UI
- coordinate reprojection
- clipping and scale tools
- terrain import validation

### Phase 3: Hybrid editing

Planned.

Goal:

- start from real-world terrain
- modify it with the same simple landscape painting workflow from phase 1

## Phase 1 product model

### User workflow

1. Choose a TF2 preset.
2. Paint landscape intent.
3. Watch the heightmap and 3D terrain update.
4. Adjust smoothing and natural undulation if needed.
5. Export PNG and use the suggested TF2 import settings.

### Terrain classes

- `Water`
- `Low`
- `Medium`
- `High`

These are semantic classes, not direct grayscale values.

### Height model

The editor now uses relative heights:

- `Low`, `Medium`, and `High` are percentages of full terrain height
- `Water` is fixed at `0`

This keeps the preview visually stable and makes the band labels intuitive.

## Terrain generation model

### What we learned

Simple blur was the wrong model.

What worked better was a region-aware approach:

- treat each contiguous painted blob as its own region
- smooth only across shared boundaries
- preserve painted plateaus and peaks
- treat shorelines differently from land-to-land transitions

### Current smoothing behaviour

The current terrain generator in [src/lib/terrain.ts](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/src/lib/terrain.ts) now works like this:

1. Build connected regions from the painted sketch.
2. Compute direct target heights for each region.
3. Run land-to-land smoothing first.
4. Only lower regions are lifted toward adjacent higher regions.
5. Higher painted regions remain pinned, which avoids hollowed peaks.
6. Apply water shaping afterward as a shoreline-specific pass.
7. Shoreline smoothing starts at the water edge and extends inland.

This is the main breakthrough so far in getting believable slopes.

### Natural variation

Natural undulation is enabled by default and uses multi-octave noise, with controls for:

- amplitude
- scale
- octaves

## UX decisions already made

- The app header is compact and app-like, not a marketing hero.
- Paint controls live with the paint canvas.
- UI copy has been stripped back to plain, non-technical wording.
- Mobile layout switches between views with tabs.
- The main workflow stays visible without forcing the user through modal steps.

## TF2 export requirements

Current implementation targets:

- exact TF2 preset dimensions
- `16-bit` grayscale PNG
- water at `0`
- no hidden scaling metadata in the exported file

## Known issues

- TF2 import testing for the latest true 16-bit export path is still pending.
- Older saved project files are auto-migrated into the current percentage-based terrain model when loaded.

## Next priorities

1. Test the latest export path in TF2 and confirm the contour issue is gone.
2. Tighten export guidance and documentation for the TF2 import workflow.
3. Gather real usage feedback before changing the terrain model further.

## Future ideas

- Additional stylized export modes beyond `Minecraft mode`.
