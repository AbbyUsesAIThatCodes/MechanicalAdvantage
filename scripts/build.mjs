import { build } from "esbuild";
import { rm, mkdir, cp, copyFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await cp("public", "dist", { recursive: true });
await copyFile(
  "node_modules/@fontsource/comic-neue/files/comic-neue-latin-400-normal.woff2",
  "dist/assets/comic-neue-regular.woff2",
);
await copyFile(
  "node_modules/@fontsource/comic-neue/files/comic-neue-latin-700-normal.woff2",
  "dist/assets/comic-neue-bold.woff2",
);
await build({
  entryPoints: {app: "src/metric/app.js"},
  bundle: true,
  format: "esm",
  target: ["chrome100", "firefox100", "safari16"],
  outdir: "dist/assets",
  minify: true,
  legalComments: "eof",
});
console.log("Built self-contained static site in dist/");
