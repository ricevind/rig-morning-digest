import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';

const [night = '2026-10-28', out = 'var/preview/digest.html'] = process.argv.slice(2);

const res = await createApp(loadConfig()).request(`/digest/${night}`);
if (res.status !== 200) {
  console.error(`no digest for ${night} (${res.status})`);
  process.exit(1);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await res.text());
console.log(`saved ${night} to ${out}`);
