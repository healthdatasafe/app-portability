import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'node:url';
import backloop from 'vite-plugin-backloop.dev';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plan 88 / fence 9 — no client-side (browser) monitoring agent in a public app.
// The New Relic browser snippet injection was removed here; third-party code in a
// patient's browser cannot be allow-listed, so it is removed, not configured.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const config: any = {
    base: './',
    envPrefix: ['VITE_'],
    server: {
      host: '::',
      port: 8092
    },
    plugins: [
      react(),
      tailwindcss()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Node built-ins that pryv / pryv-account-backup import at module
        // evaluation but never call from browser code paths. Mirrors the
        // upstream pryv-account-backup-webapp esbuild stub. Without these,
        // Vite/Rollup fails to resolve the imports and the bundle dies.
        fs: path.resolve(__dirname, './src/lib/node-stub.ts'),
        path: path.resolve(__dirname, './src/lib/node-stub.ts'),
        https: path.resolve(__dirname, './src/lib/node-stub.ts'),
        http: path.resolve(__dirname, './src/lib/node-stub.ts'),
        crypto: path.resolve(__dirname, './src/lib/node-stub.ts'),
        stream: path.resolve(__dirname, './src/lib/node-stub.ts')
      },
      preserveSymlinks: true,
      dedupe: ['hds-lib', 'react', 'react-dom']
    },
    optimizeDeps: {
      include: ['hds-lib', 'pryv', 'pryv-account-backup', 'fflate']
    }
  };
  if (mode !== 'raw') {
    config.plugins.push(backloop('app-portability'));
  }
  return {
    ...config,
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './vitest-setup.ts'
    }
  };
});
