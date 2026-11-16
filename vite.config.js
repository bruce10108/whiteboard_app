import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site at https://bruce10108.github.io/whiteboard_app/
  base: '/whiteboard_app/',
  plugins: [react()],
})
