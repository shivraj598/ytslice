import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the PORT assigned by the preview harness (falls back to Vite's default).
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
