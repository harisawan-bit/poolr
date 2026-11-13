import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Tauri expects a fixed dev port and no cleartext warnings in the webview.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: process.env.TAURI_ENV_PLATFORM ? { protocol: 'ws', host: 'localhost', port: 1421 } : undefined,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: 'es2021',
    minify: 'esbuild',
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-motion', test: /node_modules[\\/]motion/ },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react/ },
            { name: 'vendor-charts', test: /node_modules[\\/](@visx|d3-)/ },
            { name: 'vendor-ui', test: /node_modules[\\/](@radix-ui|vaul)/ },
          ],
        },
      },
    },
  },
})
