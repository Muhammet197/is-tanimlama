import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const host = process.env.TAURI_DEV_HOST;

// Inline JS + CSS into HTML — bypasses Tauri WebView2 MIME type issue on Windows
function inlineAssetsIntoHtml() {
  return {
    name: 'inline-assets-into-html',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const htmlPath = resolve(distDir, 'index.html');

      try {
        let html = readFileSync(htmlPath, 'utf-8');

        // Inline all <script type="module" src="..."> tags
        html = html.replace(/<script[^>]*\bsrc="([^"]+\.js)"[^>]*><\/script>/g, (match, src) => {
          const filePath = resolve(distDir, src.replace(/^\//, ''));
          try {
            const code = readFileSync(filePath, 'utf-8');
            return `<script type="module">${code}</script>`;
          } catch { return match; }
        });

        // Inline all <link rel="stylesheet" href="..."> tags
        html = html.replace(/<link[^>]*\bhref="([^"]+\.css)"[^>]*\/?>/g, (match, href) => {
          if (!match.includes('stylesheet')) return match;
          const filePath = resolve(distDir, href.replace(/^\//, ''));
          try {
            const code = readFileSync(filePath, 'utf-8');
            return `<style>${code}</style>`;
          } catch { return match; }
        });

        writeFileSync(htmlPath, html, 'utf-8');
        console.log('[inline-assets] JS + CSS inlined into index.html');
      } catch (e) {
        console.warn('[inline-assets] Failed:', e.message);
      }
    }
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [react(), inlineAssetsIntoHtml()],
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
    proxy: { '/api': 'http://localhost:3001' }
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Merge all chunks into single file for inline
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      }
    }
  },
});
