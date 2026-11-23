import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the same build works on GitHub Pages (/gist-cleaning-hub/) and inside the Android app.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2000 },
})
