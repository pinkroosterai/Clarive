import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { execSync } from 'child_process';

function getAppVersion(): string {
  // Prefer APP_VERSION env var (set by Docker build-arg)
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  // Fall back to git describe for local dev
  try {
    return execSync('git describe --tags --always', { encoding: 'utf-8' }).trim();
  } catch {
    return 'dev';
  }
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    server: {
      host: '::',
      port: 8080,
      allowedHosts: ['dev.clarive.app'],
      hmr: {
        overlay: false,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
    },
    define: {
      __APP_VERSION__: JSON.stringify(getAppVersion()),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['diff', '@dnd-kit/core'],
    },
  };
});
