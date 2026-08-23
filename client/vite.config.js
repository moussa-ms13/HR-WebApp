import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    legacy({
      targets: ['defaults', 'not IE 11', 'chrome >= 49', 'firefox >= 52', 'safari >= 10'],
      // Generate polyfills for older browsers
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    }),
  ],
  css: {
    // Configure lightningcss (used by Tailwind v4) to output
    // CSS compatible with older browsers
    lightningcss: {
      targets: {
        chrome: (49 << 16),   // Chrome 49+
        firefox: (52 << 16),  // Firefox 52+
        safari: (10 << 16),   // Safari 10+
      },
    },
  },
  build: {
    // Use lightningcss for CSS minification with legacy browser targets
    cssMinify: 'lightningcss',
  },
})
