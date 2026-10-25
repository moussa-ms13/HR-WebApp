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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Core React runtime & routing
            if (
              id.includes('/react/') ||
              id.includes('\\react\\') ||
              id.includes('/react-dom/') ||
              id.includes('\\react-dom\\') ||
              id.includes('react-router') ||
              id.includes('scheduler')
            ) {
              return 'vendor-react';
            }
            // UI Icons and styling utilities
            if (
              id.includes('lucide-react') ||
              id.includes('clsx') ||
              id.includes('tailwind-merge')
            ) {
              return 'vendor-ui';
            }
            // Data fetching & date utilities
            if (
              id.includes('date-fns') ||
              id.includes('swr')
            ) {
              return 'vendor-utils';
            }
            // Charting engine (isolated to dashboard)
            if (
              id.includes('recharts') ||
              id.includes('d3-') ||
              id.includes('victory-vendor')
            ) {
              return 'vendor-recharts';
            }
            // Heavy spreadsheet engine (isolated to export views)
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            // QR engine (isolated to print views)
            if (id.includes('qrcode.react')) {
              return 'vendor-qrcode';
            }
          }
        },
      },
    },
  },
})

