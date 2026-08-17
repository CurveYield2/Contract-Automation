import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist', 'web');
await fs.rm(path.join(root, 'dist'), { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await fs.cp(path.join(root, 'apps', 'web', 'public'), output, { recursive: true });
await fs.copyFile(path.join(root, 'apps', 'web', 'src', 'client.mjs'), path.join(output, 'client.js'));
console.log(`Built static Pages site at ${output}`);
