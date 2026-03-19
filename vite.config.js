import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/atom/',
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@react-three/drei',
      '@react-three/fiber',
      '@react-three/postprocessing',
      'postprocessing',
      'three',
    ],
  },
  plugins: [react()],
}))
