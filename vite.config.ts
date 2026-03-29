import path from 'node:path'

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const localAppData = process.env.LOCALAPPDATA ?? process.cwd()
const viteCacheDir = path.join(localAppData, 'tf2-heightmapper', 'vite-cache')

export default defineConfig({
  plugins: [react()],
  cacheDir: viteCacheDir,
  test: {
    environment: 'node',
  },
})
