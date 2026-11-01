import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

type DigestBody = {
  night: string;
  rows: { job: string }[];
  counts: { ok: number; retry: number; fail: number };
  badLines: number;
};

const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

function runsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const line = (at: string, job: string, status: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

describe('digest routes', () => {
  it('renders the night, and the JSON has the same jobs in the same order', async () => {
    const app = createApp(config('runs'));
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);

    const html = await page.text();
    const body = (await json.json()) as DigestBody;
    const jobs = body.rows.map((r) => r.job);

    expect(jobs).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    const positions = jobs.map((job) => html.indexOf(job));
    expect(positions.every((at, n) => at > -1 && (n === 0 || at > positions[n - 1]))).toBe(true);
    expect(html).toContain('1 line did not parse');
  });

  it('answers 404 for a night with no file, page and JSON', async () => {
    const app = createApp(config('runs'));
    expect((await app.request('/digest/2026-10-30')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-30')).status).toBe(404);
  });

  it('renders an empty night as "nothing ran"', async () => {
    const app = createApp(config(runsDir({ '2026-10-30.jsonl': '' })));
    const page = await app.request('/digest/2026-10-30');
    const body = (await (await app.request('/api/digest/2026-10-30')).json()) as DigestBody;

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(body.rows).toEqual([]);
    expect(body.counts).toEqual({ ok: 0, retry: 0, fail: 0 });
  });

  it('keeps the good rows of a night with a bad line', async () => {
    const dir = runsDir({
      '2026-10-30.jsonl': [
        line('2026-10-30T23:00:00+01:00', 'lane/sync', 'ok'),
        '{"at":"2026-10-30T23:00:02+01:00","job":"lane/sy',
        line('2026-10-30T23:05:00+01:00', 'notes/backup', 'fail', null),
      ].join('\n'),
    });
    const app = createApp(config(dir));
    const page = await app.request('/digest/2026-10-30');
    const body = (await (await app.request('/api/digest/2026-10-30')).json()) as DigestBody;
    const html = await page.text();

    expect(page.status).toBe(200);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync', 'notes/backup']);
    expect(body.badLines).toBe(1);
    expect(html).toContain('fail · failed');
    expect(html).toContain('—');
  });

  it('does not read outside the runs dir for a night name that is not a date', async () => {
    const app = createApp(config('runs'));
    expect((await app.request('/digest/..%2F..%2Fetc%2Fpasswd')).status).toBe(404);
  });
});
