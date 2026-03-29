import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import { HeightPreview } from './components/HeightPreview'
import { SketchCanvas } from './components/SketchCanvas'
import { TerrainViewport } from './components/TerrainViewport'
import { DEFAULT_TERRAIN_SETTINGS, TERRAIN_CLASS_ORDER, TERRAIN_VISUALS } from './lib/defaults'
import { DEFAULT_PRESET_ID, MAP_PRESETS, describePreset, getPresetById } from './lib/mapPresets'
import { encodeGrayscale16Png } from './lib/png16'
import { inflateProjectSketch, parseProjectFile, serializeProject } from './lib/projectFile'
import { buildExportProfile, computePreviewResolution, createInitialSketch, generateTerrain } from './lib/terrain'
import { createWorkerClient } from './lib/workerClient'
import {
  SKETCH_HEIGHT,
  SKETCH_WIDTH,
  TerrainClass,
  type PreviewTerrain,
  type TerrainClassId,
  type TerrainSettings,
  type WorkerExportResponse,
  type WorkerPreviewResponse,
} from './lib/types'

type TabKey = 'sketch' | 'height' | 'terrain'
const PREVIEW_DEBOUNCE_MS = 140

function buffersEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

function App() {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [settings, setSettings] = useState<TerrainSettings>(DEFAULT_TERRAIN_SETTINGS)
  const [sketch, setSketch] = useState<Uint8Array>(() => createInitialSketch(SKETCH_WIDTH, SKETCH_HEIGHT))
  const [activeClass, setActiveClass] = useState<TerrainClassId>(TerrainClass.Water)
  const [brushSize, setBrushSize] = useState(18)
  const [preview, setPreview] = useState<PreviewTerrain | null>(null)
  const [previewSketch, setPreviewSketch] = useState<Uint8Array>(() => createInitialSketch(SKETCH_WIDTH, SKETCH_HEIGHT))
  const [status, setStatus] = useState('Generating terrain preview...')
  const [isBusy, setIsBusy] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [workerFailed, setWorkerFailed] = useState(false)
  const [mobileTab, setMobileTab] = useState<TabKey>('sketch')
  const [past, setPast] = useState<Uint8Array[]>([])
  const [future, setFuture] = useState<Uint8Array[]>([])

  const loadInputRef = useRef<HTMLInputElement | null>(null)
  const workerClientRef = useRef<ReturnType<typeof createWorkerClient> | null>(null)
  const previewRequestRef = useRef(0)
  const exportRequestRef = useRef(10000)

  useEffect(() => {
    try {
      workerClientRef.current = createWorkerClient()
    } catch {
      setWorkerFailed(true)
    }
  }, [])

  const preset = useMemo(() => getPresetById(presetId), [presetId])
  const deferredSketch = useDeferredValue(previewSketch)
  const deferredSettings = useDeferredValue(settings)
  const [previewWidth, previewHeight] = useMemo(
    () => computePreviewResolution(preset.width, preset.height, 224),
    [preset.height, preset.width],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPreviewSketch(sketch)
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [sketch])

  useEffect(() => {
    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    setIsBusy(true)
    setStatus(workerFailed ? 'Rendering preview in app thread...' : 'Regenerating terrain preview...')

    const input = {
      sketch: deferredSketch,
      sketchWidth: SKETCH_WIDTH,
      sketchHeight: SKETCH_HEIGHT,
      outputWidth: previewWidth,
      outputHeight: previewHeight,
      settings: deferredSettings,
    }

    if (!workerFailed && workerClientRef.current) {
      workerClientRef.current
        .request<WorkerPreviewResponse>({
          type: 'preview',
          requestId,
          input,
        })
        .then((response) => {
          if (response.requestId !== previewRequestRef.current) {
            return
          }
          startTransition(() => {
            setPreview(response.preview)
            setStatus('Preview ready.')
            setIsBusy(false)
          })
        })
        .catch(() => {
          setWorkerFailed(true)
          const fallbackPreview = generateTerrain(input)
          if (requestId !== previewRequestRef.current) {
            return
          }
          startTransition(() => {
            setPreview(fallbackPreview)
            setStatus('Preview ready. Worker unavailable, using app thread.')
            setIsBusy(false)
          })
        })
      return
    }

    const fallbackPreview = generateTerrain(input)
    if (requestId !== previewRequestRef.current) {
      return
    }
    startTransition(() => {
      setPreview(fallbackPreview)
      setStatus('Preview ready. Worker unavailable, using app thread.')
      setIsBusy(false)
    })
  }, [deferredSettings, deferredSketch, previewHeight, previewWidth])

  useEffect(() => {
    const workerClient = workerClientRef.current
    return () => {
      workerClient?.terminate()
    }
  }, [])

  function updateSetting<K extends keyof TerrainSettings>(key: K, value: TerrainSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function pushHistory(origin: Uint8Array) {
    setPast((current) => [...current.slice(-29), origin])
    setFuture([])
  }

  function handleCommit(origin: Uint8Array, next: Uint8Array) {
    setSketch(next)
    if (!buffersEqual(origin, next)) {
      pushHistory(origin)
    }
  }

  function handleUndo() {
    setPast((current) => {
      const previous = current.at(-1)
      if (!previous) {
        return current
      }
      setFuture((futureState) => [sketch.slice(), ...futureState.slice(0, 29)])
      setSketch(previous.slice())
      return current.slice(0, -1)
    })
  }

  function handleRedo() {
    setFuture((current) => {
      const next = current[0]
      if (!next) {
        return current
      }
      setPast((pastState) => [...pastState.slice(-29), sketch.slice()])
      setSketch(next.slice())
      return current.slice(1)
    })
  }

  function resetSketch() {
    pushHistory(sketch.slice())
    setSketch(createInitialSketch(SKETCH_WIDTH, SKETCH_HEIGHT))
  }

  async function exportPng() {
    setIsExporting(true)
    setStatus(workerFailed ? 'Encoding PNG in app thread...' : 'Encoding 16-bit grayscale PNG...')
    const requestId = ++exportRequestRef.current
    try {
      const input = {
        sketch,
        sketchWidth: SKETCH_WIDTH,
        sketchHeight: SKETCH_HEIGHT,
        outputWidth: preset.width,
        outputHeight: preset.height,
        settings,
      }

      let pngBytes: Uint8Array

      if (!workerFailed && workerClientRef.current) {
        try {
          const response = await workerClientRef.current.request<WorkerExportResponse>({
            type: 'export',
            requestId,
            input,
          })
          pngBytes = new Uint8Array(response.png as ArrayBuffer)
        } catch {
          setWorkerFailed(true)
          const generated = generateTerrain(input)
          const profile = buildExportProfile(preset.width, preset.height, generated.maxHeight)
          pngBytes = encodeGrayscale16Png(generated.heights, preset.width, preset.height, profile.rangeMax)
        }
      } else {
        const generated = generateTerrain(input)
        const profile = buildExportProfile(preset.width, preset.height, generated.maxHeight)
        pngBytes = encodeGrayscale16Png(generated.heights, preset.width, preset.height, profile.rangeMax)
      }

      const blob = new Blob([Uint8Array.from(pngBytes)], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `tf2-heightmap-${preset.id}.png`
      anchor.click()
      URL.revokeObjectURL(url)
      setStatus('PNG exported.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  function saveProject() {
    const blob = new Blob([serializeProject(preset.id, sketch, settings)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `tf2-heightmapper-${preset.id}.tf2hm.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleProjectLoad(event: import('react').ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const raw = await file.text()
    const project = parseProjectFile(raw)
    setPresetId(project.presetId)
    setSettings(project.settings)
    setSketch(inflateProjectSketch(project))
    setPast([])
    setFuture([])
    setStatus(`Loaded project from ${new Date(project.createdAt).toLocaleString()}.`)
    event.target.value = ''
  }

  const exportProfile = preview
    ? {
        width: preset.width,
        height: preset.height,
        bitDepth: 16 as const,
        rangeMin: 0,
        rangeMax: preview.rangeMax,
        waterLevel: 0,
      }
    : {
        width: preset.width,
        height: preset.height,
        bitDepth: 16 as const,
        rangeMin: 0,
        rangeMax: settings.highElevation,
        waterLevel: 0,
      }

  return (
    <main className="app-shell">
      <input
        ref={loadInputRef}
        type="file"
        accept=".json,.tf2hm.json,application/json"
        hidden
        onChange={handleProjectLoad}
      />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">App workspace</p>
          <h1>TF2 Heightmapper</h1>
        </div>
        <div className="hero-meta">
          <div>
            <span>Preset</span>
            <strong>{preset.label}</strong>
          </div>
          <div>
            <span>Output</span>
            <strong>{describePreset(preset)}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{workerFailed ? 'Main-thread preview' : 'Live preview'}</strong>
          </div>
        </div>
      </section>

      <section className="studio-topbar">
        <div className="studio-actions">
          <button type="button" onClick={handleUndo} disabled={past.length === 0}>
            Undo
          </button>
          <button type="button" onClick={handleRedo} disabled={future.length === 0}>
            Redo
          </button>
          <button type="button" onClick={resetSketch}>
            Reset lowland
          </button>
        </div>

        <div className="studio-actions strong">
          <button type="button" onClick={saveProject}>
            Save project
          </button>
          <button type="button" onClick={() => loadInputRef.current?.click()}>
            Load project
          </button>
          <button type="button" className="primary" onClick={exportPng} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export PNG'}
          </button>
        </div>
      </section>

      <section className="workspace">
        <div className="mobile-tabs">
          <button type="button" data-active={mobileTab === 'sketch'} onClick={() => setMobileTab('sketch')}>
            Sketch
          </button>
          <button type="button" data-active={mobileTab === 'height'} onClick={() => setMobileTab('height')}>
            Heightmap
          </button>
          <button type="button" data-active={mobileTab === 'terrain'} onClick={() => setMobileTab('terrain')}>
            3D
          </button>
        </div>

        <div className={`workspace-main workspace-main-${mobileTab}`}>
          <SketchCanvas
            sketch={sketch}
            width={SKETCH_WIDTH}
            height={SKETCH_HEIGHT}
            brushSize={brushSize}
            activeClass={activeClass}
            onPreviewChange={setPreviewSketch}
            onCommit={handleCommit}
          />

          <HeightPreview
            title="Heightmap preview"
            caption="Live grayscale aligned to the current terrain range."
            rgba={preview?.rgba ?? null}
            width={preview?.width ?? previewWidth}
            height={preview?.height ?? previewHeight}
          />

          <TerrainViewport
            heights={preview?.heights ?? null}
            width={preview?.width ?? previewWidth}
            height={preview?.height ?? previewHeight}
            rangeMax={preview?.rangeMax ?? settings.highElevation}
          />
        </div>

        <aside className="inspector">
          <section className="surface inspector-section">
            <div className="surface-header compact">
              <div>
                <p className="eyebrow">Map preset</p>
                <h2>Use exact TF2 dimensions from the start.</h2>
              </div>
            </div>

            <label className="field">
              <span>Map size and ratio</span>
              <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                {MAP_PRESETS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label} · {entry.width} × {entry.height}
                    {entry.experimental ? ' · experimental' : ''}
                  </option>
                ))}
              </select>
            </label>

            <p className="support-copy">
              1 pixel = 4 meters in TF2. Experimental presets match the game&apos;s larger optional map sizes.
            </p>
          </section>

          <section className="surface inspector-section">
            <div className="surface-header compact">
              <div>
                <p className="eyebrow">Brush</p>
                <h2>Keep the paint language simple and broad.</h2>
              </div>
            </div>

            <div className="palette">
              {TERRAIN_CLASS_ORDER.map((terrainClass) => (
                <button
                  key={terrainClass}
                  type="button"
                  className="palette-chip"
                  data-active={activeClass === terrainClass}
                  onClick={() => setActiveClass(terrainClass)}
                >
                  <i style={{ background: TERRAIN_VISUALS[terrainClass].swatch }} />
                  {TERRAIN_VISUALS[terrainClass].label}
                </button>
              ))}
            </div>

            <label className="field">
              <span>Brush size</span>
              <input
                type="range"
                min="6"
                max="56"
                step="1"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
              />
              <strong>{brushSize}px</strong>
            </label>
          </section>

          <section className="surface inspector-section">
            <div className="surface-header compact">
              <div>
                <p className="eyebrow">Terrain generation</p>
                <h2>Opinionated by default. Adjustable when needed.</h2>
              </div>
            </div>

            <label className="field">
              <span>Low land elevation</span>
              <input
                type="range"
                min="5"
                max="80"
                step="1"
                value={settings.lowElevation}
                onChange={(event) => updateSetting('lowElevation', Number(event.target.value))}
              />
              <strong>{settings.lowElevation}m</strong>
            </label>

            <label className="field">
              <span>Medium land elevation</span>
              <input
                type="range"
                min="20"
                max="180"
                step="1"
                value={settings.mediumElevation}
                onChange={(event) => updateSetting('mediumElevation', Number(event.target.value))}
              />
              <strong>{settings.mediumElevation}m</strong>
            </label>

            <label className="field">
              <span>High land elevation</span>
              <input
                type="range"
                min="60"
                max="400"
                step="1"
                value={settings.highElevation}
                onChange={(event) => updateSetting('highElevation', Number(event.target.value))}
              />
              <strong>{settings.highElevation}m</strong>
            </label>

            <label className="field">
              <span>Smoothing</span>
              <input
                type="range"
                min="6"
                max="72"
                step="1"
                value={settings.smoothing}
                onChange={(event) => updateSetting('smoothing', Number(event.target.value))}
              />
              <strong>{settings.smoothing}</strong>
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.noiseEnabled}
                onChange={(event) => updateSetting('noiseEnabled', event.target.checked)}
              />
              <span>Natural undulation</span>
            </label>

            <label className="field">
              <span>Noise amplitude</span>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={settings.noiseAmplitude}
                onChange={(event) => updateSetting('noiseAmplitude', Number(event.target.value))}
                disabled={!settings.noiseEnabled}
              />
              <strong>{settings.noiseAmplitude}m</strong>
            </label>

            <label className="field">
              <span>Noise scale</span>
              <input
                type="range"
                min="6"
                max="48"
                step="1"
                value={settings.noiseScale}
                onChange={(event) => updateSetting('noiseScale', Number(event.target.value))}
                disabled={!settings.noiseEnabled}
              />
              <strong>{settings.noiseScale}</strong>
            </label>

            <label className="field">
              <span>Noise octaves</span>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={settings.noiseOctaves}
                onChange={(event) => updateSetting('noiseOctaves', Number(event.target.value))}
                disabled={!settings.noiseEnabled}
              />
              <strong>{settings.noiseOctaves}</strong>
            </label>
          </section>

          <section className="surface inspector-section export-profile">
            <div className="surface-header compact">
              <div>
                <p className="eyebrow">Export profile</p>
                <h2>Ready for the TF2 import dialog.</h2>
              </div>
            </div>
            <dl>
              <div>
                <dt>PNG</dt>
                <dd>{exportProfile.width} × {exportProfile.height}</dd>
              </div>
              <div>
                <dt>Bit depth</dt>
                <dd>{exportProfile.bitDepth}-bit grayscale</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>{exportProfile.rangeMin}m to {exportProfile.rangeMax}m</dd>
              </div>
              <div>
                <dt>Water level</dt>
                <dd>{exportProfile.waterLevel}m</dd>
              </div>
            </dl>

            <p className="support-copy">
              The exported PNG is grayscale only. Water is pinned to 0m, and all land remains at least 5m above sea level.
            </p>
          </section>
        </aside>
      </section>

      <div className="status-ribbon" data-visible={isBusy}>
        {isBusy ? 'Refreshing preview...' : status}
      </div>
    </main>
  )
}

export default App



