import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '../src/routing-table.yaml');
const dest = join(dirname(fileURLToPath(import.meta.url)), '../dist/routing-table.yaml');
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
