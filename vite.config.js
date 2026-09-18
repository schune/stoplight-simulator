import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase") || id.includes("@firebase")) {
            return "firebase";
          }
        },
      },
    },
  },
});
