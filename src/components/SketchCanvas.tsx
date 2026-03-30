import { useEffect, useMemo, useRef } from 'react'

import { TERRAIN_VISUALS } from '../lib/defaults'
import { TerrainClass, type TerrainClassId } from '../lib/types'

type SketchCanvasProps = {
  sketch: Uint8Array
  width: number
  height: number
  brushSize: number
  activeClass: TerrainClassId
  debugEdges: boolean
  onBrushSizeChange: (value: number) => void
  onActiveClassChange: (value: TerrainClassId) => void
  onPreviewChange: (next: Uint8Array) => void
  onCommit: (origin: Uint8Array, next: Uint8Array) => void
}

type Point = {
  x: number
  y: number
}

function paintCircle(buffer: Uint8Array, width: number, height: number, center: Point, radius: number, value: TerrainClassId) {
  const xMin = Math.max(0, Math.floor(center.x - radius))
  const xMax = Math.min(width - 1, Math.ceil(center.x + radius))
  const yMin = Math.max(0, Math.floor(center.y - radius))
  const yMax = Math.min(height - 1, Math.ceil(center.y + radius))
  const radiusSquared = radius * radius

  for (let y = yMin; y <= yMax; y += 1) {
    for (let x = xMin; x <= xMax; x += 1) {
      const dx = x - center.x
      const dy = y - center.y
      if (dx * dx + dy * dy <= radiusSquared) {
        buffer[y * width + x] = value
      }
    }
  }
}

function paintStroke(
  buffer: Uint8Array,
  width: number,
  height: number,
  from: Point,
  to: Point,
  radius: number,
  value: TerrainClassId,
) {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  const steps = Math.max(1, Math.ceil(Math.hypot(deltaX, deltaY)))
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    paintCircle(
      buffer,
      width,
      height,
      { x: from.x + deltaX * t, y: from.y + deltaY * t },
      radius,
      value,
    )
  }
}

function clampPoint(value: number, size: number): number {
  return Math.max(0, Math.min(size - 1, value))
}

function getCanvasContentBox(canvas: HTMLCanvasElement) {
  const bounds = canvas.getBoundingClientRect()
  const styles = window.getComputedStyle(canvas)
  const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0
  const borderTop = Number.parseFloat(styles.borderTopWidth) || 0
  const borderRight = Number.parseFloat(styles.borderRightWidth) || 0
  const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0

  return {
    left: bounds.left + borderLeft,
    top: bounds.top + borderTop,
    width: Math.max(1, bounds.width - borderLeft - borderRight),
    height: Math.max(1, bounds.height - borderTop - borderBottom),
  }
}

export function SketchCanvas({
  sketch,
  width,
  height,
  brushSize,
  activeClass,
  debugEdges,
  onBrushSizeChange,
  onActiveClassChange,
  onPreviewChange,
  onCommit,
}: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const draftRef = useRef<Uint8Array | null>(null)
  const originRef = useRef<Uint8Array | null>(null)
  const previousPointRef = useRef<Point | null>(null)
  const brushPointRef = useRef<Point | null>(null)
  const previewFrameRef = useRef<number | null>(null)

  const legend = useMemo(
    () => [
      TERRAIN_VISUALS[TerrainClass.Water],
      TERRAIN_VISUALS[TerrainClass.Low],
      TERRAIN_VISUALS[TerrainClass.Medium],
      TERRAIN_VISUALS[TerrainClass.High],
    ],
    [],
  )

  useEffect(() => {
    rasterCanvasRef.current ??= document.createElement('canvas')
    rasterCanvasRef.current.width = width
    rasterCanvasRef.current.height = height
  }, [width, height])

  function renderBuffer(buffer: Uint8Array) {
    const canvas = canvasRef.current
    const rasterCanvas = rasterCanvasRef.current
    if (!canvas || !rasterCanvas) {
      return
    }

    const context = canvas.getContext('2d')
    const rasterContext = rasterCanvas.getContext('2d')
    if (!context || !rasterContext) {
      return
    }
    const image = rasterContext.createImageData(width, height)
    const renderSource = debugEdges ? addDebugEdges(buffer, width, height) : buffer
    for (let index = 0; index < renderSource.length; index += 1) {
      const swatch = TERRAIN_VISUALS[renderSource[index] as TerrainClassId]
      const pixelOffset = index * 4
      image.data[pixelOffset] = swatch.sketchRgb[0]
      image.data[pixelOffset + 1] = swatch.sketchRgb[1]
      image.data[pixelOffset + 2] = swatch.sketchRgb[2]
      image.data[pixelOffset + 3] = 255
    }
    rasterContext.putImageData(image, 0, 0)

    const contentBox = getCanvasContentBox(canvas)
    const renderWidth = contentBox.width
    const renderHeight = contentBox.height
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(renderWidth * dpr))
    canvas.height = Math.max(1, Math.round(renderHeight * dpr))

    context.setTransform(1, 0, 0, 1, 0, 0)
    context.scale(dpr, dpr)
    context.clearRect(0, 0, renderWidth, renderHeight)
    context.imageSmoothingEnabled = false
    context.drawImage(rasterCanvas, 0, 0, renderWidth, renderHeight)

    if (brushPointRef.current) {
      const radius = (brushSize / Math.max(1, width - 1)) * renderWidth
      context.lineWidth = 2
      context.strokeStyle = 'rgba(250, 246, 238, 0.95)'
      context.beginPath()
      context.arc(
        (brushPointRef.current.x / Math.max(1, width - 1)) * renderWidth,
        (brushPointRef.current.y / Math.max(1, height - 1)) * renderHeight,
        radius,
        0,
        Math.PI * 2,
      )
      context.stroke()
    }
  }

  useEffect(() => {
    if (!drawingRef.current) {
      renderBuffer(sketch)
    }
  }, [sketch, width, height, brushSize, debugEdges])

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current)
      }
    }
  }, [])

  function queuePreview(buffer: Uint8Array) {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current)
    }
    previewFrameRef.current = window.requestAnimationFrame(() => {
      onPreviewChange(buffer.slice())
      previewFrameRef.current = null
    })
  }

  function toSketchPoint(event: import('react').PointerEvent<HTMLCanvasElement>): Point {
    const target = event.currentTarget
    const contentBox = getCanvasContentBox(target)
    const localX = event.clientX - contentBox.left
    const localY = event.clientY - contentBox.top
    return {
      x: clampPoint((localX / contentBox.width) * (width - 1), width),
      y: clampPoint((localY / contentBox.height) * (height - 1), height),
    }
  }

  function handlePointerDown(event: import('react').PointerEvent<HTMLCanvasElement>) {
    event.preventDefault()
    const point = toSketchPoint(event)
    drawingRef.current = true
    originRef.current = sketch.slice()
    draftRef.current = sketch.slice()
    previousPointRef.current = point
    brushPointRef.current = point
    paintStroke(draftRef.current, width, height, point, point, brushSize / 2, activeClass)
    renderBuffer(draftRef.current)
    queuePreview(draftRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: import('react').PointerEvent<HTMLCanvasElement>) {
    const point = toSketchPoint(event)
    brushPointRef.current = point

    if (!drawingRef.current || !draftRef.current || !previousPointRef.current) {
      return
    }

    paintStroke(
      draftRef.current,
      width,
      height,
      previousPointRef.current,
      point,
      brushSize / 2,
      activeClass,
    )
    previousPointRef.current = point
    renderBuffer(draftRef.current)
    queuePreview(draftRef.current)
  }

  function finishStroke() {
    drawingRef.current = false
    previousPointRef.current = null
    const origin = originRef.current
    const draft = draftRef.current
    if (origin && draft) {
      queuePreview(draft)
      onCommit(origin, draft.slice())
    }
    originRef.current = null
    draftRef.current = null
  }

  return (
    <div className="surface surface-sketch">
      <div className="surface-header">
        <div>
          <p className="eyebrow">Paint landscape</p>
        </div>
        <div className="paint-toolbar">
          <div className="palette palette-inline">
            {legend.map((entry, index) => (
              <button
                key={entry.label}
                type="button"
                className="palette-chip"
                data-active={activeClass === index}
                onClick={() => onActiveClassChange(index as TerrainClassId)}
              >
                <i style={{ background: entry.swatch }} />
                {entry.label}
              </button>
            ))}
          </div>
          <label className="field field-inline">
            <span>Brush size</span>
            <input
              type="range"
              min="6"
              max="56"
              step="1"
              value={brushSize}
              onChange={(event) => onBrushSizeChange(Number(event.target.value))}
            />
            <strong>{brushSize}px</strong>
          </label>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="sketch-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={() => {
          brushPointRef.current = null
        }}
        onPointerCancel={finishStroke}
      />
    </div>
  )
}

function addDebugEdges(source: Uint8Array, width: number, height: number): Uint8Array {
  const withEdges = source.slice()
  for (let x = 0; x < width; x += 1) {
    withEdges[x] = TerrainClass.High
    withEdges[(height - 1) * width + x] = TerrainClass.Medium
  }
  for (let y = 0; y < height; y += 1) {
    withEdges[y * width] = TerrainClass.Water
    withEdges[y * width + width - 1] = TerrainClass.Low
  }
  return withEdges
}

