import { useEffect, useRef } from 'react'

type HeightPreviewProps = {
  title: string
  caption: string
  rgba: Uint8ClampedArray | null
  width: number
  height: number
}

export function HeightPreview({ title, caption, rgba, width, height }: HeightPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    rasterCanvasRef.current ??= document.createElement('canvas')
  }, [])

  useEffect(() => {
    drawRef.current = () => {
      const canvas = canvasRef.current
      const raster = rasterCanvasRef.current
      if (!canvas || !raster || !rgba) {
        return
      }

      raster.width = width
      raster.height = height
      const rasterContext = raster.getContext('2d')
      const context = canvas.getContext('2d')
      if (!rasterContext || !context) {
        return
      }

      const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height)
      rasterContext.putImageData(imageData, 0, 0)

      const bounds = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(bounds.width * dpr))
      canvas.height = Math.max(1, Math.round(bounds.height * dpr))
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.scale(dpr, dpr)
      context.clearRect(0, 0, bounds.width, bounds.height)
      context.imageSmoothingEnabled = true
      context.drawImage(raster, 0, 0, bounds.width, bounds.height)
    }

    drawRef.current()
  }, [rgba, width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const observer = new ResizeObserver(() => {
      drawRef.current?.()
    })
    observer.observe(canvas)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className="surface preview-surface">
      <div className="surface-header compact">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{caption}</h2>
        </div>
      </div>
      <canvas ref={canvasRef} className="heightmap-canvas" />
    </div>
  )
}

