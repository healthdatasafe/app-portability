import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import backloop from 'vite-plugin-backloop.dev';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Inject the New Relic Browser agent snippet at build time (skipped in dev).
// Picks `newrelic-snippet.prod.html` when VITE_HDS_ENV=prod (set by deploy-prod.sh),
// otherwise `newrelic-snippet.html` (dev entity hds-dev-portability).
function newrelicBrowser (): Plugin {
  return {
    name: 'newrelic-browser',
    transformIndexHtml: {
      order: 'post',
      handler (html, ctx) {
        if (ctx.server) return html;
        const env = process.env.VITE_HDS_ENV;
        const fname = env === 'prod' ? 'newrelic-snippet.prod.html' : 'newrelic-snippet.html';
        const snippetPath = path.resolve(__dirname, fname);
        if (!fs.existsSync(snippetPath)) {
          console.warn(`[newrelic-browser] ${fname} not found — skipping injection`);
          return html;
        }
        const snippet = fs.readFileSync(snippetPath, 'utf-8').trim();
        return html.replace('</head>', snippet + '\n  </head>');
      }
    }
  };
}

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
      tailwindcss(),
      newrelicBrowser()
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
