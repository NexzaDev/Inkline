import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "editor", "vendor", "drawio");
const target = join(here, "..", "public", "editor");

await rm(target, { recursive: true, force: true });

try {
  await cp(source, target, { recursive: true });
} catch (error) {
  throw new Error(
    "the vendored editor is missing; run scripts/vendor-drawio.sh from the repository root",
    { cause: error },
  );
}
