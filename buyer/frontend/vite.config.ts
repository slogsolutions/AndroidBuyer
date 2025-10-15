import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://parkfinder-47kp.onrender.com',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID),
    'process.env.MAPBOX_TOKEN': JSON.stringify(process.env.MAPBOX_TOKEN),
  },
});
