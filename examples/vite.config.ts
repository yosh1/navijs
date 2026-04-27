import { defineConfig } from "vite";
import { resolve } from "node:path";

const repoBase = process.env.PAGES_BASE ?? "/";

export default defineConfig({
  root: __dirname,
  base: repoBase,
  resolve: {
    alias: {
      navijs: resolve(__dirname, "../src/index.ts"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, "../dist-demo"),
    emptyOutDir: true,
    target: "es2020",
  },
});
