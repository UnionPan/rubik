import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // three.js gets its own long-lived chunk: app changes don't bust its cache
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
    // three.js core (~500 kB, loaded lazily with the 3D viewer) cannot be split further
    chunkSizeWarningLimit: 560,
  },
})
