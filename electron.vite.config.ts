import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode ?? 'development', '.', '');
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: {
            index: path.resolve(__dirname, 'electron/main.ts'),
          },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: {
            index: path.resolve(__dirname, 'electron/preload.ts'),
          },
        },
      },
    },
    renderer: {
      root: '.',
      build: {
        rollupOptions: {
          input: {
            index: path.resolve(__dirname, 'index.html'),
            'chat-popup': path.resolve(__dirname, 'chat-popup.html'),
          },
        },
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        },
      },
      server: {
        watch: {
          ignored: ['**/.meka-flow/**', '**/.worktrees/**', '**/worktrees/**', '**/.superpowers/**'],
        },
      },
    },
  };
});
