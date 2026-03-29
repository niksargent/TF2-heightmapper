import pako from 'pako'

function writeUint32(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let current = i
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
    }
    table[i] = current >>> 0
  }
  return table
})()

function crc32(chunks: Uint8Array[]): number {
  let crc = 0xffffffff
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      crc = CRC_TABLE[(crc ^ chunk[index]) & 255] ^ (crc >>> 8)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const target = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    target.set(part, offset)
    offset += part.length
  }
  return target
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  return concatBytes([
    writeUint32(data.length),
    typeBytes,
    data,
    writeUint32(crc32([typeBytes, data])),
  ])
}

export function encodeGrayscale16Png(
  heights: Uint16Array,
  width: number,
  height: number,
  rangeMax: number,
): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 2))
  let offset = 0
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0
    offset += 1
    for (let x = 0; x < width; x += 1) {
      const scaled = Math.round((heights[y * width + x] / Math.max(1, rangeMax)) * 65535)
      raw[offset] = (scaled >>> 8) & 255
      raw[offset + 1] = scaled & 255
      offset += 2
    }
  }

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = new Uint8Array([
    ...writeUint32(width),
    ...writeUint32(height),
    16,
    0,
    0,
    0,
    0,
  ])
  const compressed = pako.deflate(raw, { level: 9 })

  return concatBytes([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', new Uint8Array()),
  ])
}
