import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/lib.ts", "src/cli.ts"],
  format: ["cjs", "esm"], // Build for commonJS and ESmodules
  dts: true, // Generate declaration file (.d.ts)
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true
});
