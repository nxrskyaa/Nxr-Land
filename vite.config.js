import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-three',
              test: /node_modules[\\/]three[\\/]/,
            },
          ],
        },
      },
    },
  },
});