import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  (process.env.SENTRY_FRONTEND_PROJECT || process.env.SENTRY_PROJECT)
)
const sentryRelease = process.env.SENTRY_RELEASE || process.env.VITE_SENTRY_RELEASE

export default defineConfig({
  plugins: [
    react(),
    ...(sentryUploadEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_FRONTEND_PROJECT || process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: sentryRelease ? { name: sentryRelease } : undefined,
            sourcemaps: { assets: './dist/**' },
            telemetry: false,
          }),
        ]
      : []),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    sourcemap: sentryUploadEnabled,
    crossorigin: '',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['lucide-react', 'recharts', 'axios'],
        },
      },
    },
  },
})
