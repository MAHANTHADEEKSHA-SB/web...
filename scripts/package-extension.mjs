import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { zipSync } from "fflate";

// Ship the optional extension as a separate, user-installed download.
// The website never installs it or asks for browser permissions itself.
const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "extension");
const files = {};
// Recursive, so icons/ and any future sub-folders ship too. ZIP paths use "/".
for (const entry of await readdir(directory, {
  recursive: true,
  withFileTypes: true,
})) {
  if (!entry.isFile() || !/\.(js|html|css|json|md|svg|png)$/.test(entry.name))
    continue;
  const path = resolve(entry.parentPath ?? entry.path, entry.name);
  files[relative(directory, path).split(sep).join("/")] = new Uint8Array(
    await readFile(path),
  );
}
if (!files["manifest.json"]) throw new Error("Extension manifest is missing.");
await mkdir(resolve(root, "public"), { recursive: true });
await writeFile(resolve(root, "public/orbit-extension.zip"), zipSync(files));
console.log(`Packaged Orbit extension (${Object.keys(files).length} files).`);
