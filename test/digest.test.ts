import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

function runsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const line = (at: string, job: string, status: string, owner: string | null = 'rook', error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

describe('readNight', () => {
  it('reads the night of the 28th into one row per job, sorted by job', () => {
    const night = readNight('runs', '2026-10-28');
    if (!night) throw new Error('2026-10-28 must read');

    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
    expect(night.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('keeps a null owner and the last error a job hit', () => {
    const night = readNight('runs', '2026-10-28');
    if (!night) throw new Error('2026-10-28 must read');

    const [render, refresh, sync, backup] = night.rows;
    expect(render.owner).toBeNull();
    expect(render.runs).toBe(1);

    expect(refresh.runs).toBe(4);
    expect(refresh.retries).toBe(3);
    expect(refresh.lastStatus).toBe('ok');
    expect(refresh.lastError).toBe('upstream 503');

    expect(sync.retries).toBe(1);
    expect(sync.lastError).toBe('lock held');

    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('keeps the log offsets as written', () => {
    const night = readNight('runs', '2026-10-28');
    if (!night) throw new Error('2026-10-28 must read');
    expect(night.rows[0].first).toBe('2026-10-29T05:41:09+01:00');
  });

  it('returns null for a night with no file', () => {
    expect(readNight(runsDir({}), '2026-10-30')).toBeNull();
  });

  it('renders an empty night as no rows', () => {
    const night = readNight(runsDir({ '2026-10-30.jsonl': '' }), '2026-10-30');
    expect(night?.rows).toEqual([]);
    expect(night?.counts).toEqual({ ok: 0, retry: 0, fail: 0 });
    expect(night?.badLines).toBe(0);
  });

  it('counts bad lines and keeps the good ones', () => {
    const dir = runsDir({
      '2026-10-30.jsonl': [line('2026-10-30T23:00:00+01:00', 'lane/sync', 'ok'), '{"at":', 'not json', '{"job":"x"}'].join('\n'),
    });
    const night = readNight(dir, '2026-10-30');
    expect(night?.badLines).toBe(3);
    expect(night?.rows.map((r) => r.job)).toEqual(['lane/sync']);
  });
});
