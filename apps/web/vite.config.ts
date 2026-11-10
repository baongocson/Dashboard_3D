import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const proxy = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: false,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
};
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'offline-shell',
      apply: 'build',
      closeBundle() {
        const root = resolve(import.meta.dirname, 'dist');
        const files = readdirSync(root, { recursive: true, withFileTypes: true })
          .filter((f) => f.isFile() && f.name !== 'sw.js')
          .map((f) => `/${relative(root, resolve(f.parentPath, f.name)).replaceAll('\\', '/')}`);
        const hash = createHash('sha256');
        for (const file of files) {
          hash.update(file);
          hash.update(readFileSync(resolve(root, file.slice(1))));
        }
        const version = hash.digest('hex').slice(0, 16);
        writeFileSync(
          resolve(root, 'sw.js'),
          `
const CACHE = 'dashboard-shell-${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('dashboard-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
 const url = new URL(event.request.url);
 if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
 if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.match('/index.html', { ignoreVary: true }))); return; }
 if (FILES.includes(url.pathname)) event.respondWith(caches.match(url.pathname, { ignoreVary: true }).then(cached => cached || fetch(event.request)));
});
`,
        );
      },
    },
  ],
  server: { proxy },
  preview: { proxy },
});
