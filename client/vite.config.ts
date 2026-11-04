import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, '..');

/**
 * The static build bundles the real server modules so the game can run in
 * the page. Two of them touch Node APIs (crypto, fs); this swaps them for
 * browser versions with the same exports.
 */
const serverSrc = path.resolve(repoRoot, 'server', 'src');
const browserShims: Record<string, string> = {
  [path.join(serverSrc, 'util')]: path.resolve(dir, 'src/net/local/util.ts'),
  [path.join(serverSrc, 'store')]: path.resolve(dir, 'src/net/local/store.ts'),
};

function serverBrowserShims(): Plugin {
  return {
    name: 'skyline-server-browser-shims',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null;
      const from = path.dirname(importer.split('?')[0]);
      const target = path.resolve(from, source).replace(/\.ts$/, '');
      return browserShims[target] ?? null;
    },
  };
}

export default defineConfig(({ mode }) => {
  // One .env at the repo root configures both the client and the server.
  const env = loadEnv(mode, repoRoot, '');
  const serverPort = Number(env.PORT ?? 4000);
  const target = `http://localhost:${serverPort}`;

  return {
    plugins: [serverBrowserShims(), react()],
    envDir: repoRoot,
    resolve: {
      alias: {
        '@shared': path.resolve(dir, '../shared/src'),
        '@': path.resolve(dir, 'src'),
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      // Proxying keeps the browser on one origin in development, so the game
      // works with no configuration and production behaves the same way.
      proxy: {
        '/socket.io': { target, ws: true, changeOrigin: true },
        '/api': { target, changeOrigin: true },
      },
    },
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 1400,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            r3f: ['@react-three/fiber', '@react-three/drei'],
            motion: ['motion'],
          },
        },
      },
    },
  };
});
