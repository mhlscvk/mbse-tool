import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore — vite-plugin-monaco-editor has non-standard exports
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({ languageWorkers: ['editorWorkerService'] }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
