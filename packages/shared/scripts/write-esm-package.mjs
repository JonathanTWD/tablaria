import { writeFileSync } from "node:fs";

// The package root is CommonJS, so the ESM build needs its own marker.
writeFileSync(
  new URL("../dist/esm/package.json", import.meta.url),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
