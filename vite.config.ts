import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is overridable so GitHub Pages project sites work: BASE_PATH=/cleankit/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
})
