import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      navijs: resolve(__dirname, "../src/index.ts"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
