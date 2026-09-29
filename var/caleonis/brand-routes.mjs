import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Deliberately narrow: replace only the upstream display-name expression.
// Never rename package imports, environment variables, OAuth IDs, or notices.
export function brandRoute(source) {
  return source.replace(/isGeneralServerSide\(\)\s*\?\s*'Postiz'\s*:\s*'Gitroom'/g, "'Caléonis Marketing'");
}

async function walk(directory) {
  let changed = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) changed += await walk(filename);
    else if (entry.isFile() && filename.endsWith('.tsx')) {
      const before = await readFile(filename, 'utf8');
      const after = brandRoute(before);
      if (before !== after) { await writeFile(filename, after); changed++; }
    }
  }
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = fileURLToPath(new URL('../../apps/frontend/src/app/', import.meta.url));
  console.log(`Caléonis: updated display names in ${await walk(directory)} route files.`);
}
