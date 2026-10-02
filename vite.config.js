import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so assets need that prefix.
// The deploy workflow sets BASE_PATH; local dev and preview use '/'.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
