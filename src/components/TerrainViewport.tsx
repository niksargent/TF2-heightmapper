import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type TerrainViewportProps = {
  heights: Uint16Array | null
  width: number
  height: number
  rangeMax: number
}

type SceneBundle = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  terrainMesh: THREE.Mesh | null
  waterMesh: THREE.Mesh
  frameId: number
  resizeObserver: ResizeObserver
}

export function TerrainViewport({ heights, width, height, rangeMax }: TerrainViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const bundleRef = useRef<SceneBundle | null>(null)
  const noticeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) {
      return
    }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch {
      mount.dataset.state = 'fallback'
      return
    }

    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0xe6dfd2, 1)
    mount.appendChild(renderer.domElement)
    mount.dataset.state = 'ready'

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xcbd4d1, 120, 300)

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 1000)
    camera.position.set(60, 56, 70)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, 10, 0)
    controls.maxPolarAngle = Math.PI / 2.05

    scene.add(new THREE.AmbientLight(0xf4f0e7, 1.7))
    const sun = new THREE.DirectionalLight(0xfff1d1, 1.6)
    sun.position.set(80, 110, 40)
    scene.add(sun)

    const fill = new THREE.DirectionalLight(0x8fb0bf, 0.45)
    fill.position.set(-80, 20, -60)
    scene.add(fill)

    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshPhysicalMaterial({
        color: 0x3a6f8d,
        roughness: 0.15,
        metalness: 0.08,
        transparent: true,
        opacity: 0.78,
        clearcoat: 0.85,
      }),
    )
    waterMesh.rotation.x = -Math.PI / 2
    waterMesh.position.y = 0
    scene.add(waterMesh)

    const resize = () => {
      const bounds = mount.getBoundingClientRect()
      renderer.setSize(bounds.width, bounds.height, false)
      camera.aspect = bounds.width / Math.max(1, bounds.height)
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      if (bundleRef.current) {
        bundleRef.current.frameId = window.requestAnimationFrame(animate)
      }
    }

    bundleRef.current = {
      renderer,
      scene,
      camera,
      controls,
      terrainMesh: null,
      waterMesh,
      frameId: window.requestAnimationFrame(animate),
      resizeObserver,
    }

    return () => {
      const bundle = bundleRef.current
      if (!bundle) {
        return
      }
      window.cancelAnimationFrame(bundle.frameId)
      bundle.resizeObserver.disconnect()
      bundle.controls.dispose()
      bundle.renderer.dispose()
      bundle.terrainMesh?.geometry.dispose()
      ;(bundle.terrainMesh?.material as THREE.Material | undefined)?.dispose()
      ;(bundle.waterMesh.material as THREE.Material).dispose()
      bundle.waterMesh.geometry.dispose()
      mount.removeChild(bundle.renderer.domElement)
      bundleRef.current = null
    }
  }, [])

  useEffect(() => {
    const bundle = bundleRef.current
    if (!bundle || !heights || width <= 1 || height <= 1) {
      return
    }

    if (bundle.terrainMesh) {
      bundle.scene.remove(bundle.terrainMesh)
      bundle.terrainMesh.geometry.dispose()
      ;(bundle.terrainMesh.material as THREE.Material).dispose()
    }

    const planeWidth = 160 * (width / Math.max(width, height))
    const planeHeight = 160 * (height / Math.max(width, height))
    const segmentWidth = Math.max(24, Math.min(120, Math.floor(width / 2)))
    const segmentHeight = Math.max(24, Math.min(120, Math.floor(height / 2)))
    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, segmentWidth, segmentHeight)
    const positions = geometry.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array((segmentWidth + 1) * (segmentHeight + 1) * 3)
    const color = new THREE.Color()
    const heightScale = 34

    for (let vertexY = 0; vertexY <= segmentHeight; vertexY += 1) {
      const sampleY = Math.round((vertexY / segmentHeight) * (height - 1))
      for (let vertexX = 0; vertexX <= segmentWidth; vertexX += 1) {
        const sampleX = Math.round((vertexX / segmentWidth) * (width - 1))
        const heightIndex = sampleY * width + sampleX
        const vertexIndex = vertexY * (segmentWidth + 1) + vertexX
        const normalized = heights[heightIndex] / Math.max(1, rangeMax)
        positions.setZ(vertexIndex, normalized * heightScale)

        if (heights[heightIndex] === 0) {
          color.set('#4b7f97')
        } else if (normalized < 0.18) {
          color.set('#82986e')
        } else if (normalized < 0.45) {
          color.set('#98785f')
        } else {
          color.set('#d7d2c6')
        }
        colors[vertexIndex * 3] = color.r
        colors[vertexIndex * 3 + 1] = color.g
        colors[vertexIndex * 3 + 2] = color.b
      }
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    geometry.rotateX(-Math.PI / 2)

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.92,
      metalness: 0.06,
    })
    const terrainMesh = new THREE.Mesh(geometry, material)
    bundle.scene.add(terrainMesh)
    bundle.terrainMesh = terrainMesh
  }, [heights, width, height, rangeMax])

  return (
    <div className="surface viewport-surface">
      <div className="surface-header compact">
        <div>
          <p className="eyebrow">3D interpretation</p>
          <h2>Orbit, pan, and zoom the terrain as it forms.</h2>
        </div>
      </div>
      <div ref={mountRef} className="viewport-canvas" data-state="loading">
        <div ref={noticeRef} className="viewport-fallback">
          3D preview unavailable in this browser context.
        </div>
      </div>
    </div>
  )
}
