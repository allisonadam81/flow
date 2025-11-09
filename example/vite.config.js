import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@flow/box': path.resolve(
        import.meta.dirname,
        './@flow/packages/box'
      ),
      '@flow/utils': path.resolve(
        import.meta.dirname,
        './@flow/packages/utils'
      ),
      '@flow/hooks': path.resolve(
        import.meta.dirname,
        './@flow/packages/hooks'
      ),
    },
  },
});
