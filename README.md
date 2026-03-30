# TF2 Heightmapper

Browser-based terrain sketch tool for creating Transport Fever 2 heightmaps from simple painted landscape intent.

## Current state

Phase 1 is in active prototype form and already supports:

- painting `Water`, `Low`, `Medium`, and `High` terrain on a sketch canvas
- live grayscale heightmap preview
- live 3D terrain preview with orbit controls and water plane
- TF2 preset map sizes
- 16-bit grayscale PNG export
- save/load of local project files
- undo/redo
- noise-based natural undulation controls
- region-aware smoothing between painted land areas
- shoreline-specific smoothing that starts at the water edge

The terrain model is now based on relative height bands, not direct metres:

- `Low`, `Medium`, and `High` are percentages of the full grayscale range
- `TF2 max elevation` is a separate import guidance value for the game

## Tech stack

- React
- TypeScript
- Vite
- Canvas 2D for painting and grayscale preview
- Three.js for 3D terrain preview
- Web Worker terrain generation with main-thread fallback

## Getting started

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` starts the local app
- `npm run build` creates a production build
- `npm run preview` previews the production build locally
- `npm run lint` runs ESLint
- `npm run test` runs Vitest

## Export model

The app exports:

- `16-bit` grayscale PNG
- exact TF2 preset resolution
- water at `0`
- full grayscale range reserved for the terrain model

The TF2 import dialog still controls the real-world metre scale. The app surfaces that as:

- `TF2 max elevation`
- `Water level`
- recommended import range in the export panel

## Deployment

GitHub Pages deployment is configured in:

- [.github/workflows/deploy-pages.yml](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/.github/workflows/deploy-pages.yml)

To publish:

1. Push the repository to GitHub.
2. In GitHub repository settings, enable `Pages` with source set to `GitHub Actions`.
3. Push to `main` to trigger the workflow.

## Important repo files

- [src/App.tsx](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/src/App.tsx)
- [src/components/SketchCanvas.tsx](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/src/components/SketchCanvas.tsx)
- [src/components/HeightPreview.tsx](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/src/components/HeightPreview.tsx)
- [src/components/TerrainViewport.tsx](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/src/components/TerrainViewport.tsx)
- [src/lib/terrain.ts](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/src/lib/terrain.ts)
- [src/lib/png16.ts](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/src/lib/png16.ts)
- [plan.md](C:/Users/nik_sargent/OneDrive/Code/TF2-heightmapper/plan.md)

## Known issues

- There is still a paint-to-preview alignment bug near the outer edges of the canvas.
- The smoothing model is now much better, but still needs more real-world playtesting.
- Preview performance is improved, but weaker browser environments can still struggle.
