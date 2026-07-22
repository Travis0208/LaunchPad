import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Raise the warning threshold since we intentionally split per route.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — changes least often, maximises cache hit.
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // Data fetching — Supabase + React Query share a chunk.
          'vendor-data': ['@supabase/supabase-js', '@tanstack/react-query'],

          // Icon library is large; isolate so icon updates don't bust other caches.
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
