import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'dist');
const output = join(root, 'build');

await readFile(join(source, 'index.html'), 'utf8');
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', join(source, entry.name)], { stdio: 'inherit' });
    if (check.status !== 0) process.exit(check.status ?? 1);
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, {
  recursive: true,
  filter: path => !relative(source, path).split(/[\\/]/).includes('.openai'),
});
console.log(`Build locale pronta: ${output}`);
