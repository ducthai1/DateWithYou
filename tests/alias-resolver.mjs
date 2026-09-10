/*
 * Lets `node --test` resolve the app's own import style.
 *
 * The source uses the `@/…` alias that tsconfig defines and a bundler honours,
 * imports TypeScript files without an extension, and imports JSON with no
 * import attribute. Node does none of those on its own, so a module written
 * for Next could not be loaded by a plain test process — which is why the
 * first tests could only cover the handful of files that import nothing.
 *
 * This teaches the loader those three habits and nothing else. It is not a
 * transpiler: Node 22 strips the types itself, so a file with JSX in it still
 * cannot be loaded, and neither can a package that is CommonJS-only.
 */
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const isFile = (p) => existsSync(p) && statSync(p).isFile();

/** Extensionless specifier → the file the bundler would have picked. */
function pick(base) {
  for (const c of [base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx", base + ".json", base]) {
    if (isFile(c)) return c;
  }
  return null;
}

function finish(path, ctx, next) {
  const url = pathToFileURL(path).href;
  // TypeScript allows a bare JSON import; Node wants the attribute stated.
  if (path.endsWith(".json")) {
    return { url, format: "json", importAttributes: { type: "json" }, shortCircuit: true };
  }
  return next(url, ctx);
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const hit = pick(SRC + specifier.slice(2));
    if (hit) return finish(hit, context, next);
  }
  if (/^\.{1,2}\//.test(specifier) && context.parentURL?.startsWith("file:")) {
    const hit = pick(fileURLToPath(new URL(specifier, context.parentURL)));
    if (hit) return finish(hit, context, next);
  }
  return next(specifier, context);
}
