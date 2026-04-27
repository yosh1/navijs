import { defineConfig } from "tsup";

export default defineConfig([
  // ESM + CJS for npm consumers (core + react adapter).
  {
    entry: ["src/index.ts", "src/react.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    target: "es2020",
    treeshake: true,
    external: ["react"],
  },
  // IIFE build for direct <script> / CDN usage. Core only — React adapter
  // doesn't make sense as a UMD global. Exposes window.navijs.
  {
    entry: { "navijs.global": "src/index.ts" },
    format: "iife",
    globalName: "navijs",
    sourcemap: true,
    minify: true,
    target: "es2018",
    treeshake: true,
    outExtension: () => ({ js: ".js" }),
  },
]);
